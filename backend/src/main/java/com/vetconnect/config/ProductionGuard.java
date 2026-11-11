package com.vetconnect.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** In the prod profile the server refuses to start with settings that would be unsafe on the internet. */
@Slf4j
@Component
@Profile("prod")
@RequiredArgsConstructor
public class ProductionGuard {

    private static final String DEV_SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private final AppProperties props;

    @PostConstruct
    void check() {
        String secret = props.getJwt().getSecret();
        if (secret == null || secret.length() < 32 || DEV_SECRET.equals(secret)) {
            throw new IllegalStateException("JWT_SECRET must be set to your own long random value (32+ characters) in production.");
        }
        if (props.getSeed().isDemoData()) {
            throw new IllegalStateException("SEED_DEMO_DATA must be false in production: the demo accounts have well-known passwords.");
        }
        if ("*".equals(props.getCors().getAllowedOrigins())) {
            log.warn("CORS_ALLOWED_ORIGINS is '*'. Native apps do not need CORS; set your web origin(s) if you serve a web build.");
        }
        if ("simulated".equalsIgnoreCase(props.getPayments().getGateway())) {
            log.warn("PAYMENT_GATEWAY is 'simulated': payments are test buttons and no money moves.");
        }
    }
}
