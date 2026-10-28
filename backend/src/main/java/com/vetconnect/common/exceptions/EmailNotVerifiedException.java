package com.vetconnect.common.exceptions;

/** Login attempted with correct credentials but before the sign-up OTP was confirmed. */
public class EmailNotVerifiedException extends RuntimeException {

    private final String email;

    public EmailNotVerifiedException(String email) {
        super("Please verify your email address to continue. We have sent you a verification code.");
        this.email = email;
    }

    public String getEmail() {
        return email;
    }
}
