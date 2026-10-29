package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.security.JwtTokenProvider;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.PasswordResetToken;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.dto.auth.ForgotPasswordRequest;
import com.vetconnect.dto.auth.ResetPasswordRequest;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

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
class AuthServiceResetPasswordTest {

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
    private User user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, customerProfileRepository, doctorProfileRepository,
                specializationRepository, availabilityRepository, refreshTokenRepository, passwordEncoder,
                authenticationManager, tokenProvider, new AppProperties(), passwordResetTokenRepository, emailOtpService, providerService, providerRepository);
        user = User.builder().id(7L).email("a@b.com").password("old").role(Role.ROLE_CUSTOMER).isActive(true).build();
    }

    private static String sha256(String v) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));
    }

    private PasswordResetToken tokenFor(String code, Instant expiry) throws Exception {
        return PasswordResetToken.builder().id(1L).user(user).tokenHash(sha256(code)).expiryDate(expiry).build();
    }

    private ResetPasswordRequest request(String code) {
        return ResetPasswordRequest.builder().email("A@B.com").token(code).newPassword("newpass1").build();
    }

    @Test
    void forgotPassword_unknownEmail_createsNothing() {
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());

        authService.forgotPassword(ForgotPasswordRequest.builder().email("ghost@x.com").build());

        verify(passwordResetTokenRepository, never()).save(any());
    }

    @Test
    void forgotPassword_storesOnlyAHashOfTheCode() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of());

        authService.forgotPassword(ForgotPasswordRequest.builder().email("a@b.com").build());

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(passwordResetTokenRepository).save(captor.capture());
        assertEquals(64, captor.getValue().getTokenHash().length());
        assertTrue(captor.getValue().getExpiryDate().isAfter(Instant.now()));
    }

    @Test
    void resetPassword_correctCode_changesPasswordAndRevokesSessions() throws Exception {
        PasswordResetToken token = tokenFor("ABCD2345", Instant.now().plusSeconds(600));
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(token));
        when(passwordEncoder.encode("newpass1")).thenReturn("encoded");

        authService.resetPassword(request("abcd2345"));

        assertEquals("encoded", user.getPassword());
        assertTrue(token.getUsed());
        verify(refreshTokenRepository).deleteByUser(user);
    }

    @Test
    void resetPassword_wrongCode_isRejectedAndCounted() throws Exception {
        PasswordResetToken token = tokenFor("ABCD2345", Instant.now().plusSeconds(600));
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(token));

        assertThrows(BadRequestException.class, () -> authService.resetPassword(request("WRONG123")));

        assertEquals(1, token.getFailedAttempts());
        assertEquals("old", user.getPassword());
        verify(userRepository, never()).save(any());
    }

    @Test
    void resetPassword_lockedAfterTooManyWrongAttempts() throws Exception {
        PasswordResetToken token = tokenFor("ABCD2345", Instant.now().plusSeconds(600));
        token.setFailedAttempts(4);
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(token));

        assertThrows(BadRequestException.class, () -> authService.resetPassword(request("WRONG123")));

        assertTrue(token.getUsed());
    }

    @Test
    void resetPassword_expiredCode_isRejected() throws Exception {
        PasswordResetToken token = tokenFor("ABCD2345", Instant.now().minusSeconds(5));
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of(token));

        assertThrows(BadRequestException.class, () -> authService.resetPassword(request("ABCD2345")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void resetPassword_emailAsToken_isRejected() {
        // The old implementation accepted the account's email address as the "token".
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.findByUserAndUsedFalse(user)).thenReturn(List.of());

        assertThrows(BadRequestException.class, () -> authService.resetPassword(request("a@b.com")));
        verify(userRepository, never()).save(any());
    }
}
