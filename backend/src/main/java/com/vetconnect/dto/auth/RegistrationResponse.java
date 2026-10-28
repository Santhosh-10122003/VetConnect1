package com.vetconnect.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Returned by sign-up: the account exists but must confirm the emailed OTP before it can log in. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationResponse {
    private String email;
    private boolean verificationRequired;
    private int otpExpiresInMinutes;
}
