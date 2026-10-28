package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.EmailNotVerifiedException;
import com.vetconnect.common.security.JwtTokenProvider;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.RefreshToken;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.auth.*;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceOtpTest {

    @Mock private UserRepository userRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private SpecializationRepository specializationRepository;
    @Mock private DoctorAvailabilityRepository availabilityRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private JwtTokenProvider tokenProvider;
    @Mock private EmailOtpService emailOtpService;
    @Mock private ProviderService providerService;
    @Mock private ProviderProfileRepository providerRepository;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, customerProfileRepository, doctorProfileRepository,
                specializationRepository, availabilityRepository, refreshTokenRepository, passwordEncoder,
                authenticationManager, tokenProvider, new AppProperties(), passwordResetTokenRepository, emailOtpService, providerService, providerRepository);
    }

    private RegisterRequest.RegisterRequestBuilder customerRequest() {
        return RegisterRequest.builder().email("New@Example.com").password("secret1").fullName("New Customer")
                .role(Role.ROLE_CUSTOMER).city("Springfield");
    }

    private void stubSaveUser() {
        when(passwordEncoder.encode(any())).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(11L);
            return u;
        });
        lenient().when(customerProfileRepository.save(any())).thenAnswer(i -> {
            CustomerProfile c = i.getArgument(0);
            c.setId(21L);
            return c;
        });
    }

    @Test
    void register_createsAnUnverifiedAccountAndSendsACode_withoutIssuingTokens() {
        stubSaveUser();
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(emailOtpService.expiryMinutes()).thenReturn(10);

        RegistrationResponse response = authService.register(customerRequest().latitude(39.8).longitude(-89.6).build());

        assertTrue(response.isVerificationRequired());
        assertEquals("new@example.com", response.getEmail());
        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(user.capture());
        assertFalse(user.getValue().getEmailVerified());
        verify(emailOtpService).issue(any(User.class), eq(false));
        verifyNoInteractions(tokenProvider);
        verify(refreshTokenRepository, never()).save(any());
        ArgumentCaptor<CustomerProfile> profile = ArgumentCaptor.forClass(CustomerProfile.class);
        verify(customerProfileRepository).save(profile.capture());
        assertEquals("Springfield", profile.getValue().getCity());
        assertEquals(39.8, profile.getValue().getLatitude());
    }

    @Test
    void register_duplicateEmailIsDetectedRegardlessOfCase() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(true);

        assertThrows(BadRequestException.class, () -> authService.register(customerRequest().build()));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_withoutACity_isRejected_forBothRoles() {
        when(userRepository.existsByEmail(any())).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(customerRequest().city("  ").build()));
        assertThrows(BadRequestException.class, () -> authService.register(
                customerRequest().role(Role.ROLE_DOCTOR).city(null).clinicCity(null).build()));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_latitudeWithoutLongitude_isRejected() {
        when(userRepository.existsByEmail(any())).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(customerRequest().latitude(39.8).build()));
    }

    @Test
    void register_doctorStartsPending_andIsLocatedByTheClinicCity() {
        stubSaveUser();
        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(doctorProfileRepository.existsByLicenseNumberIgnoreCase(any())).thenReturn(false);
        when(doctorProfileRepository.save(any())).thenAnswer(i -> {
            DoctorProfile d = i.getArgument(0);
            d.setId(31L);
            return d;
        });

        authService.register(customerRequest().role(Role.ROLE_DOCTOR).city(null).clinicCity("West Bay")
                .country("India").state("Tamil Nadu").latitude(11.0).longitude(76.9).build());

        ArgumentCaptor<DoctorProfile> doctor = ArgumentCaptor.forClass(DoctorProfile.class);
        verify(doctorProfileRepository).save(doctor.capture());
        assertEquals(VerificationStatus.PENDING, doctor.getValue().getVerificationStatus());
        assertEquals("West Bay", doctor.getValue().getClinicCity());
        assertEquals("India", doctor.getValue().getClinicCountry());
        assertEquals("Tamil Nadu", doctor.getValue().getClinicState());
        assertEquals(11.0, doctor.getValue().getLatitude());
    }

    @Test
    void register_doctorMustPinTheClinicOnTheMap() {
        when(userRepository.existsByEmail(any())).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.register(
                customerRequest().role(Role.ROLE_DOCTOR).city(null).clinicCity("West Bay").build()));

        assertTrue(ex.getMessage().toLowerCase().contains("pin"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_passwordsThatDoNotMatchAreRejected() {
        when(userRepository.existsByEmail(any())).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(customerRequest().confirmPassword("different").build()));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_matchingConfirmPasswordIsAccepted() {
        stubSaveUser();
        when(userRepository.existsByEmail(any())).thenReturn(false);

        assertDoesNotThrow(() -> authService.register(customerRequest().confirmPassword("secret1").build()));
    }

    @Test
    void register_storesTheCountryAndStateOfACustomer() {
        stubSaveUser();
        when(userRepository.existsByEmail(any())).thenReturn(false);

        authService.register(customerRequest().country("India").state("Tamil Nadu").postalCode(" 641001 ").build());

        ArgumentCaptor<CustomerProfile> profile = ArgumentCaptor.forClass(CustomerProfile.class);
        verify(customerProfileRepository).save(profile.capture());
        assertEquals("India", profile.getValue().getCountry());
        assertEquals("Tamil Nadu", profile.getValue().getState());
        assertEquals("641001", profile.getValue().getPostalCode());
    }

    @Test
    void login_rightPasswordButUnverified_isBlockedAndANewCodeIsOffered() {
        User user = User.builder().id(11L).email("new@example.com").role(Role.ROLE_CUSTOMER)
                .isActive(true).emailVerified(false).build();
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken("new@example.com", "x"));
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.of(user));

        assertThrows(EmailNotVerifiedException.class,
                () -> authService.login(LoginRequest.builder().email("New@example.com").password("secret1").build()));

        verify(emailOtpService).issue(user, true);
        verifyNoInteractions(tokenProvider);
    }

    @Test
    void verifyOtp_correctCode_verifiesTheAccountAndSignsIn() {
        User user = User.builder().id(11L).email("new@example.com").role(Role.ROLE_CUSTOMER)
                .isActive(true).emailVerified(false).build();
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.of(user));
        when(tokenProvider.generateTokenFromUserId(11L, "new@example.com", "ROLE_CUSTOMER")).thenReturn("jwt");
        when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(customerProfileRepository.findByUser(user)).thenReturn(Optional.of(
                CustomerProfile.builder().id(21L).fullName("New Customer").build()));

        AuthResponse response = authService.verifyOtp(VerifyOtpRequest.builder().email("New@example.com").otp("123456").build());

        verify(emailOtpService).verify(user, "123456");
        assertTrue(user.getEmailVerified());
        assertEquals("jwt", response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        assertEquals("New Customer", response.getFullName());
    }

    @Test
    void verifyOtp_wrongCode_leavesTheAccountUnverified() {
        User user = User.builder().id(11L).email("new@example.com").role(Role.ROLE_CUSTOMER)
                .isActive(true).emailVerified(false).build();
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.of(user));
        doThrow(new BadRequestException("Invalid or expired verification code.")).when(emailOtpService).verify(any(), any());

        assertThrows(BadRequestException.class,
                () -> authService.verifyOtp(VerifyOtpRequest.builder().email("new@example.com").otp("000000").build()));

        assertFalse(user.getEmailVerified());
        verifyNoInteractions(tokenProvider);
    }

    @Test
    void verifyOtp_alreadyVerifiedAccount_isRejected() {
        User user = User.builder().id(11L).email("new@example.com").role(Role.ROLE_CUSTOMER).emailVerified(true).build();
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.of(user));

        assertThrows(BadRequestException.class,
                () -> authService.verifyOtp(VerifyOtpRequest.builder().email("new@example.com").otp("123456").build()));
        verify(emailOtpService, never()).verify(any(), any());
    }

    @Test
    void resendOtp_forAnUnknownOrVerifiedAccount_sendsNothing() {
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());
        User verified = User.builder().id(1L).email("v@x.com").emailVerified(true).build();
        when(userRepository.findByEmail("v@x.com")).thenReturn(Optional.of(verified));

        authService.resendOtp(ResendOtpRequest.builder().email("ghost@x.com").build());
        authService.resendOtp(ResendOtpRequest.builder().email("v@x.com").build());

        verify(emailOtpService, never()).issue(any(), anyBoolean());
    }
}
