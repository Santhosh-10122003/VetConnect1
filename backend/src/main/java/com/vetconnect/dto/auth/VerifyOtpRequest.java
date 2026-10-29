package com.vetconnect.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyOtpRequest {

    /** The mobile number (or, for older accounts, the email) that identifies the account. */
    private String mobile;
    private String email;

    @NotBlank(message = "Verification code is required")
    private String otp;
}
