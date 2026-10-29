package com.vetconnect.common;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.domain.enums.PayoutMethod;

import java.util.Locale;
import java.util.regex.Pattern;

/** The rules for "where do you get paid": a UPI id, or a bank account (holder, account number, IFSC). */
public final class PayoutRules {

    private static final Pattern UPI = Pattern.compile("^[A-Za-z0-9._-]{2,100}@[A-Za-z][A-Za-z0-9]{1,63}$");
    private static final Pattern IFSC = Pattern.compile("^[A-Z]{4}0[A-Z0-9]{6}$");
    private static final Pattern ACCOUNT = Pattern.compile("^[0-9]{9,18}$");

    private PayoutRules() {
    }

    /** What to store once the input has been checked and tidied. */
    public record Fields(PayoutMethod method, String upiId, String holder, String account, String ifsc, String bankName) {
    }

    public static final String REQUIRED_MESSAGE =
            "Payment details are required: add a UPI id or a bank account so the advance payments can be paid out to you.";

    public static boolean anySent(PayoutMethod method, String upi, String holder, String account, String ifsc, String bank) {
        return method != null || has(upi) || has(holder) || has(account) || has(ifsc) || has(bank);
    }

    public static boolean complete(PayoutMethod method, String upi, String holder, String account, String ifsc) {
        if (method == PayoutMethod.UPI) return has(upi);
        if (method == PayoutMethod.BANK) return has(holder) && has(account) && has(ifsc);
        return false;
    }

    /**
     * Checks what was sent. {@code savedMethod}/{@code savedAccount} are what is already stored: an empty account
     * number keeps the saved one (it is only ever shown masked, so the person cannot retype it).
     */
    public static Fields normalize(PayoutMethod method, String upi, String holder, String account, String ifsc, String bank,
                                   PayoutMethod savedMethod, String savedAccount) {
        if (method == null) throw new BadRequestException("Choose how you want to be paid: UPI or bank account.");
        if (method == PayoutMethod.UPI) {
            String id = upi == null ? "" : upi.trim();
            if (!UPI.matcher(id).matches()) throw new BadRequestException("Enter a valid UPI id, like name@bank.");
            return new Fields(method, id, null, null, null, null);
        }
        String name = holder == null ? "" : holder.trim();
        if (name.length() < 2) throw new BadRequestException("Enter the account holder's name as it appears at the bank.");
        String code = ifsc == null ? "" : ifsc.replaceAll("\\s", "").toUpperCase(Locale.ROOT);
        if (!IFSC.matcher(code).matches()) throw new BadRequestException("Enter a valid IFSC code, like HDFC0001234.");
        String number = account == null ? "" : account.replaceAll("\\s", "");
        if (number.isEmpty() && method == savedMethod && has(savedAccount)) number = savedAccount;
        if (!ACCOUNT.matcher(number).matches()) throw new BadRequestException("Enter a valid bank account number (9 to 18 digits).");
        return new Fields(method, null, name, number, code, has(bank) ? bank.trim() : null);
    }

    public static String mask(String account) {
        if (account == null) return null;
        if (account.length() < 4) return "****";
        return "*".repeat(account.length() - 4) + account.substring(account.length() - 4);
    }

    private static boolean has(String v) {
        return v != null && !v.isBlank();
    }
}
