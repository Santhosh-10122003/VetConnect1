package com.vetconnect.common.exceptions;

/** Login attempted with correct credentials but before the sign-up code was confirmed. */
public class EmailNotVerifiedException extends RuntimeException {

    private final String email;
    private final String mobile;

    public EmailNotVerifiedException(String email, String mobile) {
        super("Please verify your mobile number to continue. We have sent you a verification code.");
        this.email = email;
        this.mobile = mobile;
    }

    public String getEmail() {
        return email;
    }

    public String getMobile() {
        return mobile;
    }
}
