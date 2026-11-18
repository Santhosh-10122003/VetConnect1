package com.vetconnect.sms;

import java.util.Optional;

/**
 * A service that texts a one-time code and later checks it. With these services (Message Central "VerifyNow") the
 * provider makes up the code, so we keep only the reference it returns and ask it to check what the person typed.
 */
public interface SmsOtpProvider {

    enum Result { OK, WRONG, EXPIRED, ERROR }

    /** True when a real provider is configured; otherwise callers fall back to the simulated (logged) code. */
    boolean enabled();

    /** True when this provider can text the number (Message Central here handles +91 mobile numbers). */
    boolean supports(String e164Phone);

    /**
     * Texts a code of the given length to the number.
     *
     * @return the provider's reference for this attempt, or empty if nothing could be sent
     */
    Optional<String> send(String e164Phone, int codeLength);

    /** Asks the provider whether {@code code} is the right code for the attempt {@code reference}. */
    Result verify(String reference, String e164Phone, String code);
}
