package com.vetconnect.sms;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.vetconnect.config.AppProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Talks to a small fake Message Central server, so no account or real SMS is needed. */
class MessageCentralOtpProviderTest {

    private HttpServer server;
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private final List<String> requests = new CopyOnWriteArrayList<>();
    private volatile String sendBody = "{\"responseCode\":200,\"message\":\"SUCCESS\",\"data\":{\"verificationId\":\"4242\",\"responseCode\":\"200\",\"timeout\":\"60\"}}";
    private volatile String validateBody = "{\"responseCode\":200,\"message\":\"SUCCESS\",\"data\":{\"verificationStatus\":\"VERIFICATION_COMPLETED\"}}";
    private volatile int refuseTokenOnce = 0;
    private volatile boolean validateOnlyPost = false;
    private MessageCentralOtpProvider provider;
    private AppProperties props;

    private static String jwtExpiringInSeconds(long seconds) {
        String h = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"HS512\"}".getBytes(StandardCharsets.UTF_8));
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(("{\"exp\":" + (System.currentTimeMillis() / 1000 + seconds) + "}").getBytes(StandardCharsets.UTF_8));
        return h + "." + p + ".sig";
    }

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/auth/v1/authentication/token", ex -> {
            tokenCalls.incrementAndGet();
            requests.add("TOKEN " + ex.getRequestURI().getRawQuery());
            reply(ex, 200, "{\"status\":200,\"token\":\"" + jwtExpiringInSeconds(3600) + "\"}");
        });
        server.createContext("/verification/v3/send", ex -> {
            requests.add(ex.getRequestMethod() + " send " + ex.getRequestURI().getRawQuery() + " auth=" + (ex.getRequestHeaders().getFirst("authToken") != null));
            if (refuseTokenOnce > 0) { refuseTokenOnce--; reply(ex, 401, "{\"responseCode\":401,\"message\":\"unauthorized\"}"); return; }
            reply(ex, 200, sendBody);
        });
        server.createContext("/verification/v3/validateOtp", ex -> {
            requests.add(ex.getRequestMethod() + " validate " + ex.getRequestURI().getRawQuery());
            if (validateOnlyPost && !"POST".equals(ex.getRequestMethod())) { reply(ex, 405, "{\"responseCode\":405,\"message\":\"METHOD_NOT_ALLOWED\"}"); return; }
            reply(ex, 200, validateBody);
        });
        server.start();

        props = new AppProperties();
        props.getSms().setProvider("messagecentral");
        props.getSms().setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        props.getSms().setCustomerId("C-TEST");
        props.getSms().setKey("a2V5");
        provider = new MessageCentralOtpProvider(props, new ObjectMapper());
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static void reply(com.sun.net.httpserver.HttpExchange ex, int status, String body) throws java.io.IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, b.length);
        ex.getResponseBody().write(b);
        ex.close();
    }

    @Test
    void isOnlyEnabledWhenConfigured() {
        assertTrue(provider.enabled());
        props.getSms().setProvider("simulated");
        assertFalse(provider.enabled());
        props.getSms().setProvider("messagecentral");
        props.getSms().setKey("");
        assertFalse(provider.enabled());
    }

    @Test
    void supportsOnlyIndianMobiles() {
        assertTrue(provider.supports("+919876543210"));
        assertFalse(provider.supports("+15550100"));
        assertFalse(provider.supports("9876543210"));
        assertFalse(provider.supports(null));
    }

    @Test
    void send_returnsTheVerificationIdAndSendsTheRightRequest() {
        var ref = provider.send("+919876543210", 6);
        assertEquals("4242", ref.orElseThrow());
        String send = requests.stream().filter(r -> r.contains("send")).findFirst().orElseThrow();
        assertTrue(send.startsWith("POST"));
        assertTrue(send.contains("countryCode=91") && send.contains("mobileNumber=9876543210") && send.contains("flowType=SMS")
                && send.contains("otpLength=6") && send.contains("customerId=C-TEST"));
        assertTrue(send.endsWith("auth=true"));
    }

    @Test
    void send_failureGivesEmptySoTheCallerCanFallBack() {
        sendBody = "{\"responseCode\":511,\"message\":\"INVALID_COUNTRY_CODE\",\"data\":null}";
        assertTrue(provider.send("+919876543210", 6).isEmpty());
        assertTrue(provider.send("+15550100", 6).isEmpty()); // not an Indian mobile: never calls the provider
    }

    @Test
    void theAuthTokenIsReusedAndRenewedWhenRefused() {
        provider.send("+919876543210", 6);
        provider.send("+919876543210", 6);
        assertEquals(1, tokenCalls.get(), "one token serves several calls");

        refuseTokenOnce = 1;
        assertEquals("4242", provider.send("+919876543210", 6).orElseThrow());
        assertEquals(2, tokenCalls.get(), "a refused token is replaced once and the call retried");
    }

    @Test
    void verify_mapsTheProviderAnswers() {
        assertEquals(SmsOtpProvider.Result.OK, provider.verify("4242", "+919876543210", "123456"));
        String v = requests.stream().filter(r -> r.contains("validate")).findFirst().orElseThrow();
        assertTrue(v.startsWith("GET") && v.contains("verificationId=4242") && v.contains("code=123456"));

        validateBody = "{\"responseCode\":702,\"message\":\"WRONG_OTP_PROVIDED\",\"data\":null}";
        assertEquals(SmsOtpProvider.Result.WRONG, provider.verify("4242", "+919876543210", "000000"));
        validateBody = "{\"responseCode\":705,\"message\":\"VERIFICATION_EXPIRED\",\"data\":null}";
        assertEquals(SmsOtpProvider.Result.EXPIRED, provider.verify("4242", "+919876543210", "123456"));
        validateBody = "{\"responseCode\":500,\"message\":\"SERVER_ERROR\",\"data\":null}";
        assertEquals(SmsOtpProvider.Result.ERROR, provider.verify("4242", "+919876543210", "123456"));
        assertEquals(SmsOtpProvider.Result.ERROR, provider.verify("4242", "+919876543210", ""));
    }

    @Test
    void verify_triesPostWhenTheServerRefusesGet() {
        validateOnlyPost = true;
        assertEquals(SmsOtpProvider.Result.OK, provider.verify("4242", "+919876543210", "123456"));
        assertTrue(requests.stream().anyMatch(r -> r.startsWith("GET validate")));
        assertTrue(requests.stream().anyMatch(r -> r.startsWith("POST validate")));
    }

    @Test
    void anUnreachableProviderIsAnErrorNotAnException() {
        server.stop(0);
        assertTrue(provider.send("+919876543210", 6).isEmpty());
        assertEquals(SmsOtpProvider.Result.ERROR, provider.verify("4242", "+919876543210", "123456"));
    }

    @Test
    void tokenExpiryIsReadFromTheJwt() {
        var at = provider.expiryOf(jwtExpiringInSeconds(120));
        long secs = at.getEpochSecond() - java.time.Instant.now().getEpochSecond();
        assertTrue(secs > 100 && secs <= 121, "expires about 120 s from now, was " + secs);
        assertTrue(provider.expiryOf("not-a-jwt").isAfter(java.time.Instant.now().plusSeconds(60)));
    }
}
