package com.vetconnect.payment;

import com.vetconnect.domain.entities.CarePayment;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A stand-in gateway for development and demos: nothing is charged. The app shows a clearly marked
 * "test payment" screen and the server settles the payment when the customer presses Pay (or Fail).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "vetconnect.payments.gateway", havingValue = "simulated", matchIfMissing = true)
public class SimulatedPaymentGateway implements PaymentGateway {

    @Override
    public String name() {
        return "simulated";
    }

    @Override
    public boolean isTestMode() {
        return true;
    }

    @Override
    public String publicKey() {
        return null;
    }

    @Override
    public boolean verifySignature(String orderId, String paymentId, String signature) {
        return false;
    }

    @Override
    public String createOrder(String bookingReference, BigDecimal amount, String currency) {
        String orderId = "sim_order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        log.info("[SIMULATED PAYMENT] order {} created for booking {}: {} {}", orderId, bookingReference, amount, currency);
        return orderId;
    }

    @Override
    public String refund(CarePayment payment, BigDecimal amount) {
        String refundId = "sim_refund_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        log.info("[SIMULATED PAYMENT] refund {} of {} {} for order {}", refundId, amount, payment.getCurrency(), payment.getGatewayOrderId());
        return refundId;
    }
}
