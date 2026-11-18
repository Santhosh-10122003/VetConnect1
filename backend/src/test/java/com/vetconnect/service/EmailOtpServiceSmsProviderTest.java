package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.EmailVerificationOtp;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.repository.EmailVerificationOtpRepository;
import com.vetconnect.sms.SmsOtpProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** The sign-up code when a real SMS provider is configured: the provider owns the code, we keep its reference. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EmailOtpServiceSmsProviderTest {

    @Mock private EmailVerificationOtpRepository otpRepository;
    @Mock private SmsOtpProvider sms;

    private EmailOtpService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new EmailOtpService(otpRepository, new AppProperties(), sms);
        user = User.builder().id(5L).email("m919876543210@mobile.vetconnect.local").phone("+919876543210")
                .role(Role.ROLE_CUSTOMER).emailVerified(false).build();
        when(otpRepository.findFirstByUserOrderByIdDesc(user)).thenReturn(Optional.empty());
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of());
        when(sms.enabled()).thenReturn(true);
        when(sms.supports("+919876543210")).thenReturn(true);
    }

    private EmailVerificationOtp stored(String hash) {
        return EmailVerificationOtp.builder().id(1L).user(user).codeHash(hash).expiryDate(Instant.now().plusSeconds(300)).build();
    }

    @Test
    void issue_storesOnlyTheProvidersReference() {
        when(sms.send("+919876543210", 6)).thenReturn(Optional.of("4242"));

        assertTrue(service.issue(user, false));

        ArgumentCaptor<EmailVerificationOtp> captor = ArgumentCaptor.forClass(EmailVerificationOtp.class);
        verify(otpRepository).save(captor.capture());
        assertEquals("MC:4242", captor.getValue().getCodeHash());
    }

    @Test
    void issue_fallsBackToALocalCodeWhenTheProviderCannotSend() {
        when(sms.send(any(), anyInt())).thenReturn(Optional.empty());

        assertTrue(service.issue(user, false));

        ArgumentCaptor<EmailVerificationOtp> captor = ArgumentCaptor.forClass(EmailVerificationOtp.class);
        verify(otpRepository).save(captor.capture());
        assertEquals(64, captor.getValue().getCodeHash().length());
        assertFalse(captor.getValue().getCodeHash().startsWith("MC:"));
    }

    @Test
    void issue_neverCallsTheProviderForANumberItDoesNotSupport() {
        when(sms.supports("+919876543210")).thenReturn(false);

        service.issue(user, false);

        verify(sms, never()).send(any(), anyInt());
    }

    @Test
    void verify_acceptsWhatTheProviderAccepts() {
        EmailVerificationOtp otp = stored("MC:4242");
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(otp));
        when(sms.verify("4242", "+919876543210", "123456")).thenReturn(SmsOtpProvider.Result.OK);

        service.verify(user, " 123456 ");

        assertTrue(otp.getUsed());
    }

    @Test
    void verify_countsWrongGuessesAndLocksAfterTooMany() {
        EmailVerificationOtp otp = stored("MC:4242");
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(otp));
        when(sms.verify(any(), any(), any())).thenReturn(SmsOtpProvider.Result.WRONG);
        int max = new AppProperties().getOtp().getMaxFailedAttempts();

        for (int i = 0; i < max; i++) {
            assertThrows(BadRequestException.class, () -> service.verify(user, "000000"));
        }
        assertEquals(max, otp.getFailedAttempts());
        assertTrue(otp.getUsed(), "locked after too many wrong codes");
    }

    @Test
    void verify_anExpiredCodeIsRetiredAndRejected() {
        EmailVerificationOtp otp = stored("MC:4242");
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(otp));
        when(sms.verify(any(), any(), any())).thenReturn(SmsOtpProvider.Result.EXPIRED);

        assertThrows(BadRequestException.class, () -> service.verify(user, "123456"));
        assertTrue(otp.getUsed());
    }

    @Test
    void verify_aProviderOutageIsNotCountedAsAWrongGuess() {
        EmailVerificationOtp otp = stored("MC:4242");
        when(otpRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(otp));
        when(sms.verify(any(), any(), any())).thenReturn(SmsOtpProvider.Result.ERROR);

        BadRequestException e = assertThrows(BadRequestException.class, () -> service.verify(user, "123456"));
        assertTrue(e.getMessage().contains("could not check"));
        assertEquals(0, otp.getFailedAttempts());
        assertFalse(otp.getUsed());
    }
}
