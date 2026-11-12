package com.vetconnect.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.common.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * A small per-client request limiter (token bucket, in memory).
 * <ul>
 *   <li>"auth" calls (login, sign-up, OTP, password reset) get a strict limit: brute-force and OTP/email abuse.</li>
 *   <li>every other /api call gets a looser limit, so one runaway client cannot use up the DB pool and threads.</li>
 * </ul>
 * Counts are per instance. With several instances behind a load balancer the effective limit is multiplied by the
 * instance count; use a shared store (Redis) if you need an exact global limit. The client is the address Tomcat
 * reports, which is the X-Forwarded-For address when server.forward-headers-strategy is set.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10) // right after request logging, before Spring Security and the database
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> AUTH_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/verify-otp", "/api/auth/resend-otp",
            "/api/auth/forgot-password", "/api/auth/reset-password");
    private static final long IDLE_EVICT_NANOS = 5L * 60 * 1_000_000_000L;
    private static final long SWEEP_EVERY_NANOS = 60L * 1_000_000_000L;

    private final AppProperties props;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastSweep = new AtomicLong(System.nanoTime());

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !props.getRateLimit().isEnabled()
                || !request.getRequestURI().startsWith("/api/")
                || HttpMethod.OPTIONS.matches(request.getMethod()); // CORS preflight
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean auth = HttpMethod.POST.matches(request.getMethod()) && AUTH_PATHS.contains(request.getRequestURI());
        int perMinute = auth ? props.getRateLimit().getAuthPerMinute() : props.getRateLimit().getApiPerMinute();
        String key = (auth ? "auth|" : "api|") + request.getRemoteAddr();

        sweepIfDue();
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(perMinute));
        long retryAfterSeconds = bucket.tryConsume(perMinute);
        if (retryAfterSeconds == 0) {
            chain.doFilter(request, response);
            return;
        }

        log.warn("Rate limit exceeded: {} {} from {} (limit {}/min)", request.getMethod(), request.getRequestURI(), request.getRemoteAddr(), perMinute);
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error("Too many requests. Please wait " + retryAfterSeconds + " seconds and try again.")));
    }

    /** Drops clients that have been quiet for a while, so the map cannot grow without bound. */
    private void sweepIfDue() {
        long now = System.nanoTime();
        long last = lastSweep.get();
        if (now - last > SWEEP_EVERY_NANOS && lastSweep.compareAndSet(last, now)) {
            buckets.entrySet().removeIf(e -> now - e.getValue().lastSeen > IDLE_EVICT_NANOS);
        }
    }

    /** Holds up to "perMinute" tokens and refills them evenly over a minute. */
    static final class Bucket {
        private double tokens;
        private long lastRefill = System.nanoTime();
        volatile long lastSeen = lastRefill;

        Bucket(int perMinute) {
            this.tokens = perMinute;
        }

        /** @return 0 when the request may go ahead, otherwise how many seconds until a token is free. */
        synchronized long tryConsume(int perMinute) {
            long now = System.nanoTime();
            double refillPerNano = perMinute / 60_000_000_000.0;
            tokens = Math.min(perMinute, tokens + (now - lastRefill) * refillPerNano);
            lastRefill = now;
            lastSeen = now;
            if (tokens >= 1) {
                tokens -= 1;
                return 0;
            }
            return Math.max(1, (long) Math.ceil((1 - tokens) / refillPerNano / 1_000_000_000.0));
        }
    }
}
