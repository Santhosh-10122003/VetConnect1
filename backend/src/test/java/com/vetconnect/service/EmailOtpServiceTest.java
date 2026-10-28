package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.EmailVerificationOtp;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.repository.EmailVerificationOtpRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailOtpServiceTest {

    @Mock private EmailVerificationOtpRepository otpRepository;

    private EmailOtpService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new EmailOtpService(otpRepository, new AppProperties());
        user = User.builder().id(5L).email("a@b.com").role(Role.ROLE_CUSTOMER).emailVerified(false).build();
    }

    private static String hash(User u, String code) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((u.getId() + ":" + code).getBytes(StandardCharsets.UTF_8)));
    }

    private EmailVerificationOtp otp(String code, Instant expiry) throws Exception {
        return EmailVerificationOtp.builder().id(1L).user(user).codeHash(hash(user, code)).expiryDate(expiry).build();
    }

    @Test
    void issue_storesOnlyAHashedSixDigitCode() {
        when(otpRepository.findFirstByUserOrderByIdDesc(user)).thenReturn(Optional.empty());
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of());

        assertTrue(service.issue(user, false));

        ArgumentCaptor<EmailVerificationOtp> captor = ArgumentCaptor.forClass(EmailVerificationOtp.class);
        verify(otpRepository).save(captor.capture());
        assertEquals(64, captor.getValue().getCodeHash().length());
        assertTrue(captor.getValue().getExpiryDate().isAfter(Instant.now()));
    }

    @Test
    void issue_invalidatesOlderCodes() {
        EmailVerificationOtp old = EmailVerificationOtp.builder().id(1L).user(user).codeHash("x")
                .expiryDate(Instant.now().plusSeconds(60)).createdAt(Instant.now().minusSeconds(600)).build();
        when(otpRepository.findFirstByUserOrderByIdDesc(user)).thenReturn(Optional.of(old));
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(old));

        service.issue(user, false);

        assertTrue(old.getUsed());
    }

    @Test
    void issue_withinCooldown_explicitResendIsRejected() {
        EmailVerificationOtp recent = EmailVerificationOtp.builder().id(1L).user(user).codeHash("x")
                .expiryDate(Instant.now().plusSeconds(60)).createdAt(Instant.now()).build();
        when(otpRepository.findFirstByUserOrderByIdDesc(user)).thenReturn(Optional.of(recent));

        assertThrows(BadRequestException.class, () -> service.issue(user, false));
        verify(otpRepository, never()).save(any());
    }

    @Test
    void issue_withinCooldown_automaticSendIsSkippedSilently() {
        EmailVerificationOtp recent = EmailVerificationOtp.builder().id(1L).user(user).codeHash("x")
                .expiryDate(Instant.now().plusSeconds(60)).createdAt(Instant.now()).build();
        when(otpRepository.findFirstByUserOrderByIdDesc(user)).thenReturn(Optional.of(recent));

        assertFalse(service.issue(user, true));
        verify(otpRepository, never()).save(any());
    }

    @Test
    void verify_correctCode_marksItUsed() throws Exception {
        EmailVerificationOtp o = otp("123456", Instant.now().plusSeconds(300));
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(o));

        service.verify(user, " 123456 ");

        assertTrue(o.getUsed());
    }

    @Test
    void verify_wrongCode_isRejectedAndCounted() throws Exception {
        EmailVerificationOtp o = otp("123456", Instant.now().plusSeconds(300));
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(o));

        assertThrows(BadRequestException.class, () -> service.verify(user, "000000"));

        assertEquals(1, o.getFailedAttempts());
        assertFalse(o.getUsed());
    }

    @Test
    void verify_lockedAfterTooManyWrongGuesses() throws Exception {
        EmailVerificationOtp o = otp("123456", Instant.now().plusSeconds(300));
        o.setFailedAttempts(4);
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(o));

        assertThrows(BadRequestException.class, () -> service.verify(user, "000000"));

        assertTrue(o.getUsed());
    }

    @Test
    void verify_expiredCode_isRejected() throws Exception {
        EmailVerificationOtp o = otp("123456", Instant.now().minusSeconds(1));
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(o));

        assertThrows(BadRequestException.class, () -> service.verify(user, "123456"));
    }

    @Test
    void verify_codeOfAnotherUser_isRejected() throws Exception {
        User other = User.builder().id(99L).email("o@b.com").role(Role.ROLE_CUSTOMER).build();
        // Hash was produced for a different user id, so the same digits must not match.
        EmailVerificationOtp o = EmailVerificationOtp.builder().id(1L).user(user)
                .codeHash(hash(other, "123456")).expiryDate(Instant.now().plusSeconds(300)).build();
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(o));

        assertThrows(BadRequestException.class, () -> service.verify(user, "123456"));
    }
}
