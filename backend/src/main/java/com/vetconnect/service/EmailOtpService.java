package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.EmailVerificationOtp;
import com.vetconnect.domain.entities.User;
import com.vetconnect.repository.EmailVerificationOtpRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

/**
 * Issues and checks the 6-digit code that confirms a new account's email address.
 * Codes are stored hashed, expire, are single-use and lock after too many wrong guesses.
 * No mail service is configured, so the code is written to the server log as a simulated email.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailOtpService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    static final String INVALID_MESSAGE = "Invalid or expired verification code.";

    private final EmailVerificationOtpRepository otpRepository;
    private final AppProperties appProperties;

    public int expiryMinutes() {
        return (int) (appProperties.getOtp().getExpirationMs() / 60000);
    }

    /**
     * Creates and "sends" a fresh code, invalidating older ones.
     *
     * @param respectCooldown when true, nothing is sent if the previous code is younger than the cooldown
     * @return true if a code was sent
     */
    // A refused (cooldown) request is an expected outcome: it must not mark the caller's transaction rollback-only.
    @Transactional(noRollbackFor = BadRequestException.class)
    public boolean issue(User user, boolean respectCooldown) {
        var latest = otpRepository.findFirstByUserOrderByIdDesc(user);
        if (latest.isPresent() && latest.get().getCreatedAt() != null) {
            long ageMs = Instant.now().toEpochMilli() - latest.get().getCreatedAt().toEpochMilli();
            long wait = appProperties.getOtp().getResendCooldownMs() - ageMs;
            if (wait > 0) {
                if (respectCooldown) {
                    log.debug("OTP not re-sent to {}: cooldown has {} ms left", user.getEmail(), wait);
                    return false;
                }
                throw new BadRequestException("Please wait " + (wait / 1000 + 1) + " seconds before requesting another code.");
            }
        }

        List<EmailVerificationOtp> previous = otpRepository.findByUserAndUsedFalse(user);
        previous.forEach(o -> o.setUsed(true));
        otpRepository.saveAll(previous);

        String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        otpRepository.save(EmailVerificationOtp.builder()
                .user(user)
                .codeHash(hash(user, code))
                .expiryDate(Instant.now().plusMillis(appProperties.getOtp().getExpirationMs()))
                .build());

        // No SMS provider is configured: the "text message" is written to the server log.
        log.warn("[SIMULATED SMS] Verification code for {} [{}]: {} (valid {} minutes)",
                user.getPhone() != null ? user.getPhone() : user.getEmail(), user.getEmail(), code, expiryMinutes());
        return true;
    }

    /** Checks the code; throws {@link BadRequestException} unless it is the user's current, unexpired code. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void verify(User user, String submitted) {
        EmailVerificationOtp otp = otpRepository.findByUserAndUsedFalse(user).stream()
                .filter(o -> o.getExpiryDate().isAfter(Instant.now()))
                .max(Comparator.comparing(EmailVerificationOtp::getId))
                .orElseThrow(() -> {
                    log.warn("OTP rejected: no active code for userId={}", user.getId());
                    return new BadRequestException(INVALID_MESSAGE);
                });

        String normalized = submitted == null ? "" : submitted.trim();
        boolean match = MessageDigest.isEqual(
                otp.getCodeHash().getBytes(StandardCharsets.UTF_8),
                hash(user, normalized).getBytes(StandardCharsets.UTF_8));

        if (!match) {
            otp.setFailedAttempts(otp.getFailedAttempts() + 1);
            if (otp.getFailedAttempts() >= appProperties.getOtp().getMaxFailedAttempts()) {
                otp.setUsed(true);
                log.warn("OTP locked after too many wrong attempts: userId={}", user.getId());
            }
            otpRepository.save(otp);
            log.warn("OTP rejected: wrong code for userId={} (attempt {})", user.getId(), otp.getFailedAttempts());
            throw new BadRequestException(INVALID_MESSAGE);
        }

        otp.setUsed(true);
        otpRepository.save(otp);
    }

    private static String hash(User user, String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((user.getId() + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
