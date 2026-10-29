package com.vetconnect.service;

import com.vetconnect.common.PhoneNumbers;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.EmailNotVerifiedException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.security.JwtTokenProvider;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.auth.*;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final SpecializationRepository specializationRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final AppProperties appProperties;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailOtpService emailOtpService;
    private final ProviderService providerService;
    private final ProviderProfileRepository providerRepository;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike characters

    // ------------------------------------------------------------------ sign-up

    /**
     * Creates the account (unverified) and emails a one-time code. No tokens are issued until
     * {@link #verifyOtp} succeeds.
     */
    @Transactional
    public RegistrationResponse register(RegisterRequest request) {
        // The account is identified by the mobile number; an email is optional.
        String phone = PhoneNumbers.normalize(request.getPhone());
        if (userRepository.existsByPhone(phone)) {
            log.warn("Registration rejected: mobile number already registered ({})", phone);
            throw new BadRequestException("This mobile number is already registered. Please log in instead.");
        }
        String email = hasText(request.getEmail()) ? request.getEmail().toLowerCase().trim() : PhoneNumbers.placeholderEmail(phone);
        if (userRepository.existsByEmail(email)) {
            log.warn("Registration rejected: email already registered ({})", email);
            throw new BadRequestException("Email is already registered: " + email);
        }

        Role role = request.getRole() != null ? request.getRole() : Role.ROLE_CUSTOMER;
        if (role == Role.ROLE_ADMIN) {
            log.warn("Registration rejected: attempt to self-register as admin ({})", email);
            throw new BadRequestException("Admin accounts cannot be self-registered");
        }

        if (hasText(request.getConfirmPassword()) && !request.getConfirmPassword().equals(request.getPassword())) {
            log.warn("Registration rejected: passwords do not match ({})", email);
            throw new BadRequestException("Password and confirm password do not match.");
        }

        // Location is mandatory: customers are only shown veterinarians near them.
        String city = role == Role.ROLE_DOCTOR ? request.getClinicCity() : request.getCity();
        if (!hasText(city)) {
            log.warn("Registration rejected: missing location ({})", email);
            throw new BadRequestException(role == Role.ROLE_DOCTOR
                    ? "Clinic city is required so pet owners nearby can find you."
                    : "City is required so we can show you veterinarians near you.");
        }
        if ((request.getLatitude() == null) != (request.getLongitude() == null)) {
            throw new BadRequestException("Latitude and longitude must be provided together.");
        }
        if (role == Role.ROLE_DOCTOR && request.getLatitude() == null) {
            // Customers use this pin to navigate to the clinic.
            log.warn("Registration rejected: doctor without a pinned clinic location ({})", email);
            throw new BadRequestException("Please pin your clinic on the map so pet owners can find and navigate to you.");
        }

        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(phone)
                .role(role)
                .isActive(true)
                .emailVerified(false)
                .build();
        user = userRepository.save(user);

        Long profileId = null;

        if (role == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = CustomerProfile.builder()
                    .user(user)
                    .fullName(request.getFullName())
                    .address(request.getAddress())
                    .city(city.trim())
                    .postalCode(blankToNull(request.getPostalCode()))
                    .state(blankToNull(request.getState()))
                    .country(blankToNull(request.getCountry()))
                    .latitude(request.getLatitude())
                    .longitude(request.getLongitude())
                    .emergencyContact(request.getEmergencyContact())
                    .build();
            customer = customerProfileRepository.save(customer);
            profileId = customer.getId();
        } else if (role == Role.ROLE_PROVIDER) {
            if (!hasText(request.getBusinessName())) throw new BadRequestException("Business name is required.");
            if (request.getCategories() == null || request.getCategories().isEmpty()) {
                throw new BadRequestException("Choose at least one service type (grooming, boarding or training).");
            }
            if (!hasText(request.getAddress())) throw new BadRequestException("Address is required so pet owners can find you.");
            profileId = providerService.createProfile(user.getId(), com.vetconnect.dto.care.CareDtos.ProviderRequest.builder()
                    .businessName(request.getBusinessName()).description(request.getDescription())
                    .phone(request.getPhone()).registrationNumber(blankToNull(request.getLicenseNumber()))
                    .address(request.getAddress()).city(city.trim()).state(blankToNull(request.getState())).country(blankToNull(request.getCountry()))
                    .postalCode(blankToNull(request.getPostalCode())).latitude(request.getLatitude()).longitude(request.getLongitude())
                    .categories(request.getCategories())
                    .payoutMethod(request.getPayoutMethod()).upiId(request.getUpiId()).accountHolderName(request.getAccountHolderName())
                    .bankAccountNumber(request.getBankAccountNumber()).ifscCode(request.getIfscCode()).bankName(request.getBankName())
                    .build()).getId();
        } else if (role == Role.ROLE_DOCTOR) {
            // The license is optional in the app: a blank value must not be stored (it is UNIQUE).
            String licenseNumber = hasText(request.getLicenseNumber())
                    ? request.getLicenseNumber().trim()
                    : "LIC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            if (doctorProfileRepository.existsByLicenseNumberIgnoreCase(licenseNumber)) {
                log.warn("Registration rejected: license number already registered ({})", licenseNumber);
                throw new BadRequestException("This license number is already registered.");
            }
            // Where the doctor is paid is required at sign-up, like for pet-care businesses.
            if (!com.vetconnect.common.PayoutRules.anySent(request.getPayoutMethod(), request.getUpiId(), request.getAccountHolderName(),
                    request.getBankAccountNumber(), request.getIfscCode(), request.getBankName())) {
                throw new BadRequestException(com.vetconnect.common.PayoutRules.REQUIRED_MESSAGE);
            }
            var payout = com.vetconnect.common.PayoutRules.normalize(request.getPayoutMethod(), request.getUpiId(), request.getAccountHolderName(),
                    request.getBankAccountNumber(), request.getIfscCode(), request.getBankName(), null, null);
            DoctorProfile doctor = DoctorProfile.builder()
                    .user(user)
                    .payoutMethod(payout.method()).upiId(payout.upiId()).accountHolderName(payout.holder())
                    .bankAccountNumber(payout.account()).ifscCode(payout.ifsc()).bankName(payout.bankName())
                    .fullName(request.getFullName())
                    .licenseNumber(licenseNumber)
                    .clinicName(hasText(request.getClinicName()) ? request.getClinicName().trim() : "VetConnect Partner Clinic")
                    .clinicAddress(hasText(request.getClinicAddress()) ? request.getClinicAddress().trim() : city.trim())
                    .clinicCity(city.trim())
                    .clinicPostalCode(blankToNull(hasText(request.getClinicPostalCode()) ? request.getClinicPostalCode() : request.getPostalCode()))
                    .clinicState(blankToNull(request.getState()))
                    .clinicCountry(blankToNull(request.getCountry()))
                    .latitude(request.getLatitude())
                    .longitude(request.getLongitude())
                    .yearsOfExperience(request.getYearsOfExperience() != null ? request.getYearsOfExperience() : 2)
                    .consultationFee(request.getConsultationFee() != null ? request.getConsultationFee() : new java.math.BigDecimal("50.00"))
                    .bio(request.getBio())
                    .verificationStatus(VerificationStatus.PENDING) // Admin must verify the license before the doctor is listed
                    .specializations(new HashSet<>())
                    .build();

            if (request.getSpecializationIds() != null && !request.getSpecializationIds().isEmpty()) {
                doctor.getSpecializations().addAll(specializationRepository.findAllById(request.getSpecializationIds()));
            }

            doctor = doctorProfileRepository.save(doctor);
            profileId = doctor.getId();

            // Setup default Monday to Friday availability (09:00 - 17:00)
            for (int day = 1; day <= 5; day++) {
                DoctorAvailability avail = DoctorAvailability.builder()
                        .doctor(doctor)
                        .dayOfWeek(day)
                        .startTime(LocalTime.of(9, 0))
                        .endTime(LocalTime.of(17, 0))
                        .slotDurationMinutes(30)
                        .breakStartTime(LocalTime.of(13, 0))
                        .breakEndTime(LocalTime.of(14, 0))
                        .isActive(true)
                        .build();
                availabilityRepository.save(avail);
            }
        }

        emailOtpService.issue(user, false);
        log.info("User registered (awaiting mobile verification): userId={} phone={} role={} profileId={} city={}",
                user.getId(), user.getPhone(), role, profileId, city.trim());

        return RegistrationResponse.builder()
                .email(user.getEmail())
                .mobile(user.getPhone())
                .verificationRequired(true)
                .otpExpiresInMinutes(emailOtpService.expiryMinutes())
                .build();
    }

    /** Confirms the emailed code, marks the account verified and signs the user in. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        String who = identifierOf(request.getMobile(), request.getEmail());
        User user = findByIdentifier(request.getMobile(), request.getEmail()).orElseThrow(() -> {
            log.warn("OTP verification rejected: unknown account {}", who);
            return new BadRequestException(EmailOtpService.INVALID_MESSAGE);
        });

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new BadRequestException("This mobile number is already verified. Please log in.");
        }

        emailOtpService.verify(user, request.getOtp());

        user.setEmailVerified(true);
        userRepository.save(user);
        log.info("Mobile verified: userId={} phone={}", user.getId(), user.getPhone());

        String accessToken = tokenProvider.generateTokenFromUserId(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = createRefreshToken(user).getToken();
        return buildAuthResponse(user, accessToken, refreshToken);
    }

    /** Sends a new code. The answer is identical for unknown and already-verified emails. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void resendOtp(ResendOtpRequest request) {
        String who = identifierOf(request.getMobile(), request.getEmail());
        var userOpt = findByIdentifier(request.getMobile(), request.getEmail());
        if (userOpt.isEmpty() || Boolean.TRUE.equals(userOpt.get().getEmailVerified())) {
            log.warn("OTP resend ignored for unknown or already verified account: {}", who);
            return;
        }
        emailOtpService.issue(userOpt.get(), false);
    }

    // ------------------------------------------------------------------ login & tokens

    @Transactional(noRollbackFor = EmailNotVerifiedException.class)
    public AuthResponse login(LoginRequest request) {
        String who = identifierOf(request.getMobile(), request.getEmail());
        if (who.isEmpty()) throw new BadRequestException("Enter your mobile number.");
        log.debug("Login attempt: {}", who);
        User found = findByIdentifier(request.getMobile(), request.getEmail()).orElse(null);
        // Spring Security signs in by the account's internal username (its email); an unknown number fails like a wrong password.
        String principal = found != null ? found.getEmail() : who.toLowerCase();
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(principal, request.getPassword())
            );
        } catch (AuthenticationException ex) {
            log.warn("Login failed: {} reason={}", who, ex.getClass().getSimpleName());
            throw ex;
        }

        User user = found != null ? found : userRepository.findByEmail(principal)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            log.warn("Login blocked: account suspended, userId={}", user.getId());
            throw new BadRequestException("Account has been suspended. Please contact support.");
        }

        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            // Right password, but the sign-up code was never confirmed: send a fresh one (if the last is old enough).
            boolean sent = emailOtpService.issue(user, true);
            log.warn("Login blocked: mobile not verified, userId={} (new code sent: {})", user.getId(), sent);
            throw new EmailNotVerifiedException(user.getEmail(), user.getPhone());
        }

        String accessToken = tokenProvider.generateToken(authentication);
        String refreshToken = createRefreshToken(user).getToken();
        log.info("Login successful: userId={} phone={} role={}", user.getId(), user.getPhone(), user.getRole());
        return buildAuthResponse(user, accessToken, refreshToken);
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken token = refreshTokenRepository.findByTokenAndRevokedFalse(request.getRefreshToken())
                .orElseThrow(() -> {
                    log.warn("Token refresh rejected: invalid or revoked refresh token");
                    return new BadRequestException("Invalid or revoked refresh token");
                });

        if (token.getExpiryDate().isBefore(Instant.now())) {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
            log.warn("Token refresh rejected: expired token for userId={}", token.getUser().getId());
            throw new BadRequestException("Refresh token has expired. Please log in again.");
        }

        User user = token.getUser();
        log.info("Access token refreshed: userId={}", user.getId());
        String newAccessToken = tokenProvider.generateTokenFromUserId(user.getId(), user.getEmail(), user.getRole().name());
        return buildAuthResponse(user, newAccessToken, token.getToken());
    }

    @Transactional
    public void logout(Long userId) {
        userRepository.findById(userId).ifPresent(refreshTokenRepository::deleteByUser);
        log.info("User logged out: userId={}", userId);
    }

    // ------------------------------------------------------------------ password reset

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String who = identifierOf(request.getMobile(), request.getEmail());
        log.info("Password reset requested for: {}", who);

        // Same outward behaviour whether or not the account exists (no account enumeration).
        var userOpt = findByIdentifier(request.getMobile(), request.getEmail());
        if (userOpt.isEmpty() || !Boolean.TRUE.equals(userOpt.get().getIsActive())) {
            log.warn("Password reset requested for unknown or inactive account: {}", who);
            return;
        }
        User user = userOpt.get();

        // Only the newest code is valid.
        var previous = passwordResetTokenRepository.findByUserAndUsedFalse(user);
        previous.forEach(t -> t.setUsed(true));
        passwordResetTokenRepository.saveAll(previous);

        String code = generateResetCode();
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(hash(code))
                .expiryDate(Instant.now().plusMillis(appProperties.getReset().getTokenExpirationMs()))
                .build());

        // No SMS provider is configured: the "text message" is written to the server log.
        log.warn("[SIMULATED SMS] Password reset code for {} [{}]: {} (valid {} minutes)",
                user.getPhone() != null ? user.getPhone() : user.getEmail(), user.getEmail(), code, appProperties.getReset().getTokenExpirationMs() / 60000);
    }

    // Keep the failed-attempt counter even though a BadRequestException is thrown.
    @Transactional(noRollbackFor = BadRequestException.class)
    public void resetPassword(ResetPasswordRequest request) {
        String who = identifierOf(request.getMobile(), request.getEmail());
        final String invalid = "Invalid or expired reset code.";

        User user = findByIdentifier(request.getMobile(), request.getEmail()).orElseThrow(() -> {
            log.warn("Password reset rejected: unknown account {}", who);
            return new BadRequestException(invalid);
        });

        PasswordResetToken token = passwordResetTokenRepository.findByUserAndUsedFalse(user).stream()
                .filter(t -> t.getExpiryDate().isAfter(Instant.now()))
                .max(java.util.Comparator.comparing(PasswordResetToken::getId))
                .orElseThrow(() -> {
                    log.warn("Password reset rejected: no active code for userId={}", user.getId());
                    return new BadRequestException(invalid);
                });

        if (!MessageDigest.isEqual(token.getTokenHash().getBytes(StandardCharsets.UTF_8),
                hash(request.getToken().trim().toUpperCase()).getBytes(StandardCharsets.UTF_8))) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            if (token.getFailedAttempts() >= appProperties.getReset().getMaxFailedAttempts()) {
                token.setUsed(true);
                log.warn("Password reset code locked after too many attempts: userId={}", user.getId());
            }
            passwordResetTokenRepository.save(token);
            log.warn("Password reset rejected: wrong code for userId={} (attempt {})", user.getId(), token.getFailedAttempts());
            throw new BadRequestException(invalid);
        }

        token.setUsed(true);
        passwordResetTokenRepository.save(token);
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        refreshTokenRepository.deleteByUser(user); // sign out all existing sessions
        log.info("Password reset completed: userId={}", user.getId());
    }

    // ------------------------------------------------------------------ helpers

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        String fullName = user.getPhone() != null ? user.getPhone() : user.getEmail();
        Long profileId = null;
        String verificationStatus = null;

        if (user.getRole() == Role.ROLE_CUSTOMER) {
            var customer = customerProfileRepository.findByUser(user);
            if (customer.isPresent()) {
                fullName = customer.get().getFullName();
                profileId = customer.get().getId();
            }
        } else if (user.getRole() == Role.ROLE_DOCTOR) {
            var doctor = doctorProfileRepository.findByUser(user);
            if (doctor.isPresent()) {
                fullName = doctor.get().getFullName();
                profileId = doctor.get().getId();
                verificationStatus = doctor.get().getVerificationStatus().name();
            }
        } else if (user.getRole() == Role.ROLE_PROVIDER) {
            var provider = providerRepository.findByUserId(user.getId());
            if (provider.isPresent()) {
                fullName = provider.get().getBusinessName();
                profileId = provider.get().getId();
                verificationStatus = provider.get().getVerificationStatus().name();
            }
        } else if (user.getRole() == Role.ROLE_ADMIN) {
            fullName = "VetConnect Administrator";
        }

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(user.getId())
                .email(PhoneNumbers.isPlaceholderEmail(user.getEmail()) ? null : user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .fullName(fullName)
                .profileId(profileId)
                .verificationStatus(verificationStatus)
                .build();
    }

    private static boolean hasText(String v) {
        return v != null && !v.isBlank();
    }

    private static String identifierOf(String mobile, String email) {
        if (hasText(mobile)) return mobile.trim();
        return hasText(email) ? email.trim() : "";
    }

    /**
     * Finds an account by its mobile number. Older accounts that never gave a number can still be found by their
     * email, so nobody is locked out by the switch to mobile numbers.
     */
    private java.util.Optional<User> findByIdentifier(String mobile, String email) {
        String id = identifierOf(mobile, email);
        if (id.isEmpty()) return java.util.Optional.empty();
        if (id.contains("@")) return userRepository.findByEmail(id.toLowerCase());
        try {
            return userRepository.findByPhone(PhoneNumbers.normalize(id));
        } catch (BadRequestException e) {
            return java.util.Optional.empty();
        }
    }

    private static String blankToNull(String v) {
        return hasText(v) ? v.trim() : null;
    }

    private String generateResetCode() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(CODE_ALPHABET.charAt(SECURE_RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private RefreshToken createRefreshToken(User user) {
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiryDate(Instant.now().plusMillis(appProperties.getJwt().getRefreshExpirationMs()))
                .revoked(false)
                .build();
        return refreshTokenRepository.save(refreshToken);
    }
}
