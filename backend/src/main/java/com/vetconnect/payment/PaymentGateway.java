package com.vetconnect.payment;

import com.vetconnect.domain.entities.CarePayment;

import java.math.BigDecimal;

/**
 * The seam between VetConnect and a payment provider. Everything the app needs from a gateway is here, so adding
 * another provider means writing one implementation and setting {@code vetconnect.payments.gateway}.
 */
public interface PaymentGateway {

    /** Short stable name stored with each payment, e.g. "simulated" or "razorpay". */
    String name();

    /** True when no real money moves (the app then offers test pay / fail buttons for the simulated gateway). */
    boolean isTestMode();

    /** The public key the app needs to open the provider's checkout; null when there is no checkout (simulated). */
    String publicKey();

    /** Registers a payment of {@code amount} with the provider and returns its order id. */
    String createOrder(String reference, BigDecimal amount, String currency);

    /** True when {@code signature} proves the checkout really paid {@code orderId} with {@code paymentId}. */
    boolean verifySignature(String orderId, String paymentId, String signature);

    /** Sends money back to the customer. Returns the provider's refund id. */
    String refund(CarePayment payment, BigDecimal amount);
}
