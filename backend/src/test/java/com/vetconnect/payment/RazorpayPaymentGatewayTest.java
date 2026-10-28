package com.vetconnect.payment;

import com.vetconnect.config.AppProperties;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

class RazorpayPaymentGatewayTest {

    private static final String SECRET = "test_secret_value";

    private RazorpayPaymentGateway gateway(String keyId, String secret) {
        AppProperties props = new AppProperties();
        props.getPayments().getRazorpay().setKeyId(keyId);
        props.getPayments().getRazorpay().setKeySecret(secret);
        return new RazorpayPaymentGateway(props);
    }

    private static String sign(String orderId, String paymentId, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void acceptsTheSignatureRazorpayWouldProduce() throws Exception {
        RazorpayPaymentGateway g = gateway("rzp_test_abc", SECRET);
        assertTrue(g.verifySignature("order_1", "pay_1", sign("order_1", "pay_1", SECRET)));
    }

    @Test
    void rejectsAForgedOrTamperedSignature() throws Exception {
        RazorpayPaymentGateway g = gateway("rzp_test_abc", SECRET);
        assertFalse(g.verifySignature("order_1", "pay_1", sign("order_1", "pay_1", "someone_elses_secret")));
        assertFalse(g.verifySignature("order_1", "pay_2", sign("order_1", "pay_1", SECRET)), "a signature for another payment");
        assertFalse(g.verifySignature("order_2", "pay_1", sign("order_1", "pay_1", SECRET)), "a signature for another order");
        assertFalse(g.verifySignature("order_1", "pay_1", ""));
        assertFalse(g.verifySignature("order_1", "pay_1", null));
        assertFalse(g.verifySignature(null, "pay_1", "x"));
    }

    @Test
    void testKeysAreTestMode() {
        assertTrue(gateway("rzp_test_abc", SECRET).isTestMode());
        assertFalse(gateway("rzp_live_abc", SECRET).isTestMode());
        assertEquals("rzp_test_abc", gateway("rzp_test_abc", SECRET).publicKey());
    }

    @Test
    void refusesToStartWithoutKeys() {
        assertThrows(IllegalStateException.class, () -> gateway("", SECRET).checkKeys());
        assertThrows(IllegalStateException.class, () -> gateway("rzp_test_abc", "").checkKeys());
    }

    @Test
    void amountsAreSentInThePaise() {
        assertEquals(4000L, RazorpayPaymentGateway.toMinorUnits(new BigDecimal("40.00")));
        assertEquals(1667L, RazorpayPaymentGateway.toMinorUnits(new BigDecimal("16.67")));
        assertEquals(1L, RazorpayPaymentGateway.toMinorUnits(new BigDecimal("0.005")));
    }
}
