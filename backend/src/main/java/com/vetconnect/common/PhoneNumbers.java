package com.vetconnect.common;

import com.vetconnect.common.exceptions.BadRequestException;

import java.util.regex.Pattern;

/** Mobile numbers are stored in international form: a plus sign, the country code and the number, digits only. */
public final class PhoneNumbers {

    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{6,14}$");

    private PhoneNumbers() {
    }

    public static final String INVALID_MESSAGE = "Enter a valid mobile number with the country code, like +91 98765 43210.";

    /** "+91 98765-43210", "0091 98765 43210" and "+919876543210" all become "+919876543210". */
    public static String normalize(String input) {
        if (input == null || input.isBlank()) throw new BadRequestException("Mobile number is required.");
        String s = input.trim().replaceAll("[\\s().-]", "");
        if (s.startsWith("00")) s = "+" + s.substring(2);
        if (!E164.matcher(s).matches()) throw new BadRequestException(INVALID_MESSAGE);
        return s;
    }

    /** What an account without an email uses internally (never shown, never emailed). */
    public static String placeholderEmail(String normalizedPhone) {
        return "m" + normalizedPhone.substring(1) + "@mobile.vetconnect.local";
    }

    public static boolean isPlaceholderEmail(String email) {
        return email != null && email.endsWith("@mobile.vetconnect.local");
    }
}
