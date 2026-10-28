package com.vetconnect.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.CarePayment;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

/**
 * Razorpay Standard Checkout. The server creates an order, the app opens Razorpay's checkout for it, and the checkout
 * returns a signature that only Razorpay (using the secret key) can produce, so a payment is trusted only after
 * {@link #verifySignature} succeeds. Enable with {@code vetconnect.payments.gateway=razorpay} plus the key id and
 * secret (rzp_test_ keys let you try it without real money).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "vetconnect.payments.gateway", havingValue = "razorpay")
public class RazorpayPaymentGateway implements PaymentGateway {

    private final AppProperties.Razorpay config;
    private final RestClient http;

    public RazorpayPaymentGateway(AppProperties props) {
        this.config = props.getPayments().getRazorpay();
        String basic = Base64.getEncoder().encodeToString(
                (config.getKeyId() + ":" + config.getKeySecret()).getBytes(StandardCharsets.UTF_8));
        this.http = RestClient.builder()
                .baseUrl(config.getApiUrl())
                .defaultHeader("Authorization", "Basic " + basic)
                .build();
    }

    @PostConstruct
    void checkKeys() {
        if (config.getKeyId().isBlank() || config.getKeySecret().isBlank()) {
            throw new IllegalStateException("vetconnect.payments.gateway=razorpay needs vetconnect.payments.razorpay.key-id and key-secret.");
        }
        log.info("Razorpay gateway enabled ({} keys)", isTestMode() ? "test" : "live");
    }

    @Override
    public String name() {
        return "razorpay";
    }

    /** Razorpay's own test keys never move real money. */
    @Override
    public boolean isTestMode() {
        return config.getKeyId().startsWith("rzp_test_");
    }

    @Override
    public String publicKey() {
        return config.getKeyId();
    }

    @Override
    public String createOrder(String reference, BigDecimal amount, String currency) {
        Map<String, Object> body = Map.of(
                "amount", toMinorUnits(amount),
                "currency", currency,
                "receipt", reference.length() > 40 ? reference.substring(0, 40) : reference,
                "notes", Map.of("reference", reference));
        String id = post("/orders", body).path("id").asText();
        log.info("[RAZORPAY] order {} created for {}: {} {}", id, reference, amount, currency);
        return id;
    }

    @Override
    public boolean verifySignature(String orderId, String paymentId, String signature) {
        if (orderId == null || paymentId == null || signature == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(config.getKeySecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.toLowerCase().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Could not verify Razorpay signature", e);
            return false;
        }
    }

    @Override
    public String refund(CarePayment payment, BigDecimal amount) {
        if (payment.getGatewayPaymentId() == null) throw new BadRequestException("This payment has no Razorpay payment id to refund.");
        String id = post("/payments/" + payment.getGatewayPaymentId() + "/refund",
                Map.of("amount", toMinorUnits(amount), "notes", Map.of("reference", payment.reference()))).path("id").asText();
        log.info("[RAZORPAY] refund {} of {} {} for payment {}", id, amount, payment.getCurrency(), payment.getGatewayPaymentId());
        return id;
    }

    private JsonNode post(String path, Map<String, Object> body) {
        try {
            JsonNode res = http.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
            if (res == null) throw new BadRequestException("The payment provider returned nothing. Please try again.");
            return res;
        } catch (RestClientResponseException e) {
            log.error("[RAZORPAY] {} failed: HTTP {} {}", path, e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new BadRequestException("The payment provider rejected the request. Please try again in a moment.");
        } catch (ResourceAccessException e) {
            log.error("[RAZORPAY] {} unreachable: {}", path, e.getMessage());
            throw new BadRequestException("The payment provider is not reachable right now. Please try again in a moment.");
        }
    }

    /** Razorpay amounts are in the smallest unit (paise / cents). */
    static long toMinorUnits(BigDecimal amount) {
        return amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}
