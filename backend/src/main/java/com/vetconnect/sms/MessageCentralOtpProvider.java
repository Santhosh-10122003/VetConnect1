package com.vetconnect.sms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Message Central "VerifyNow" (https://www.messagecentral.com/product/verify-now/api):
 * <ol>
 *   <li>GET /auth/v1/authentication/token gives an authToken (a JWT; cached until shortly before it expires)</li>
 *   <li>POST /verification/v3/send texts the code and returns a verificationId</li>
 *   <li>GET /verification/v3/validateOtp checks the code for that verificationId</li>
 * </ol>
 * Active only when SMS_PROVIDER=messagecentral and the customer id and key are set. Secrets are never logged.
 * A failure of the provider never breaks sign-up: the caller falls back to the simulated (logged) code.
 */
@Slf4j
@Component
public class MessageCentralOtpProvider implements SmsOtpProvider {

    private static final Pattern INDIA_MOBILE = Pattern.compile("^\\+91([0-9]{10})$");
    private static final Duration DEFAULT_TOKEN_LIFETIME = Duration.ofMinutes(30);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http;

    private volatile String token;
    private volatile Instant tokenExpires = Instant.EPOCH;

    public MessageCentralOtpProvider(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(props.getSms().getTimeoutMs())).build();
    }

    @Override
    public boolean enabled() {
        AppProperties.Sms c = props.getSms();
        return "messagecentral".equalsIgnoreCase(c.getProvider()) && has(c.getCustomerId()) && has(c.getKey());
    }

    @Override
    public boolean supports(String e164Phone) {
        return e164Phone != null && INDIA_MOBILE.matcher(e164Phone).matches();
    }

    @Override
    public Optional<String> send(String e164Phone, int codeLength) {
        var m = INDIA_MOBILE.matcher(e164Phone == null ? "" : e164Phone);
        if (!enabled() || !m.matches()) return Optional.empty();
        String url = "/verification/v3/send?countryCode=91&customerId=" + enc(props.getSms().getCustomerId())
                + "&flowType=SMS&mobileNumber=" + m.group(1) + "&otpLength=" + Math.max(4, Math.min(8, codeLength));
        try {
            JsonNode body = callWithToken("POST", url);
            if (body != null && body.path("responseCode").asInt() == 200) {
                String id = body.path("data").path("verificationId").asText("");
                if (!id.isBlank()) {
                    log.info("SMS code sent to {} via Message Central (verificationId={})", mask(e164Phone), id);
                    return Optional.of(id);
                }
            }
            log.error("Message Central did not send the code to {}: {}", mask(e164Phone), summary(body));
        } catch (Exception e) {
            log.error("Message Central send failed for {}: {}", mask(e164Phone), e.toString());
        }
        return Optional.empty();
    }

    @Override
    public Result verify(String reference, String e164Phone, String code) {
        var m = INDIA_MOBILE.matcher(e164Phone == null ? "" : e164Phone);
        if (!enabled() || reference == null || code == null || code.isBlank()) return Result.ERROR;
        String url = "/verification/v3/validateOtp?verificationId=" + enc(reference) + "&code=" + enc(code.trim())
                + "&customerId=" + enc(props.getSms().getCustomerId()) + "&flowType=SMS"
                + (m.matches() ? "&countryCode=91&mobileNumber=" + m.group(1) : "");
        try {
            // the docs show GET (sample request and FAQ) but label the call POST in one table: try GET, then POST on a 405
            Answer a = exchange("GET", url);
            if (a.status() == 405) a = exchange("POST", url);
            JsonNode body = a.body();
            if (body == null) return Result.ERROR;
            int rc = body.path("responseCode").asInt();
            String status = body.path("data").path("verificationStatus").asText("");
            if (rc == 200 && "VERIFICATION_COMPLETED".equalsIgnoreCase(status)) return Result.OK;
            return switch (rc) {
                case 702, 800 -> Result.WRONG;         // wrong code / too many tries
                case 703, 705 -> Result.EXPIRED;       // already verified / expired
                default -> {
                    log.error("Message Central could not check a code: {}", summary(body));
                    yield Result.ERROR;
                }
            };
        } catch (Exception e) {
            log.error("Message Central verify failed: {}", e.toString());
            return Result.ERROR;
        }
    }

    // ------------------------------------------------------------------ http

    /** Calls the API with a valid authToken; if the token was refused, gets a new one and tries once more. */
    private record Answer(int status, JsonNode body) { }

    private JsonNode callWithToken(String method, String pathAndQuery) throws IOException, InterruptedException {
        return exchange(method, pathAndQuery).body();
    }

    private Answer exchange(String method, String pathAndQuery) throws IOException, InterruptedException {
        for (int attempt = 0; attempt < 2; attempt++) {
            String t = authToken(attempt > 0);
            HttpRequest.Builder rb = HttpRequest.newBuilder(URI.create(base() + pathAndQuery))
                    .timeout(Duration.ofMillis(props.getSms().getTimeoutMs()))
                    .header("authToken", t).header("accept", "*/*");
            HttpRequest req = "POST".equals(method) ? rb.POST(HttpRequest.BodyPublishers.noBody()).build() : rb.GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode body = parse(res.body());
            boolean refused = res.statusCode() == 401 || (body != null && body.path("responseCode").asInt() == 401);
            if (refused && attempt == 0) {
                log.warn("Message Central refused the authToken; getting a new one");
                continue;
            }
            return new Answer(res.statusCode(), body);
        }
        return new Answer(0, null);
    }

    private synchronized String authToken(boolean force) throws IOException, InterruptedException {
        if (!force && token != null && Instant.now().isBefore(tokenExpires)) return token;
        AppProperties.Sms c = props.getSms();
        StringBuilder q = new StringBuilder("/auth/v1/authentication/token?customerId=").append(enc(c.getCustomerId()))
                .append("&key=").append(enc(c.getKey())).append("&scope=NEW&country=91");
        if (has(c.getEmail())) q.append("&email=").append(enc(c.getEmail()));
        HttpRequest req = HttpRequest.newBuilder(URI.create(base() + q))
                .timeout(Duration.ofMillis(c.getTimeoutMs())).header("accept", "*/*").GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode body = parse(res.body());
        String t = body == null ? "" : body.path("token").asText("");
        if (t.isBlank()) {
            // say why (e.g. wrong customer id or key), without ever logging the key itself
            throw new IOException("Message Central refused the login (HTTP " + res.statusCode() + "): " + summary(body)
                    + " - check MESSAGECENTRAL_CUSTOMER_ID and MESSAGECENTRAL_KEY (customerId length " + (c.getCustomerId() == null ? 0 : c.getCustomerId().length())
                    + ", key length " + (c.getKey() == null ? 0 : c.getKey().length()) + ")");
        }
        token = t;
        tokenExpires = expiryOf(t).minusSeconds(60);
        return t;
    }

    /** The token is a JWT; read its "exp" so it is renewed before it runs out. Unreadable: assume 30 minutes. */
    Instant expiryOf(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length >= 2) {
                JsonNode payload = mapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
                long exp = payload.path("exp").asLong(0);
                if (exp > 0) return Instant.ofEpochSecond(exp);
            }
        } catch (Exception ignored) {
            // fall through
        }
        return Instant.now().plus(DEFAULT_TOKEN_LIFETIME);
    }

    // ------------------------------------------------------------------ helpers

    private String base() {
        String b = props.getSms().getBaseUrl();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }

    private JsonNode parse(String text) {
        try {
            return text == null || text.isBlank() ? null : mapper.readTree(text);
        } catch (Exception e) {
            return null;
        }
    }

    private static String summary(JsonNode body) {
        if (body == null) return "no readable answer";
        return "responseCode=" + body.path("responseCode").asText("?") + " message=" + body.path("message").asText("")
                + (body.path("data").has("errorMessage") ? " error=" + body.path("data").path("errorMessage").asText("") : "");
    }

    private static boolean has(String s) {
        return s != null && !s.isBlank();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** +91 98xxxxxx21 style, so logs never hold a whole number. */
    private static String mask(String phone) {
        return phone == null || phone.length() < 6 ? "***" : phone.substring(0, 5) + "xxxxx" + phone.substring(phone.length() - 2);
    }
}
