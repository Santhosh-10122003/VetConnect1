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
public class LoginRequest {

    /** The mobile number (or, for older accounts, the email) that identifies the account. */
    private String mobile;
    private String email;

    @NotBlank(message = "Password is required")
    private String password;
}
