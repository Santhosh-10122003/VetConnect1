package com.vetconnect.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductionGuardTest {

    private static AppProperties props(String secret, boolean demo) {
        AppProperties p = new AppProperties();
        p.getJwt().setSecret(secret);
        p.getSeed().setDemoData(demo);
        return p;
    }

    private static final String GOOD = "a-long-random-production-secret-value-0123456789";

    @Test
    void theBuiltInDevelopmentSecretIsRefused() {
        assertThrows(IllegalStateException.class, () -> new ProductionGuard(new AppProperties()).check());
    }

    @Test
    void aShortSecretIsRefused() {
        assertThrows(IllegalStateException.class, () -> new ProductionGuard(props("short", false)).check());
    }

    @Test
    void demoDataIsRefusedInProduction() {
        assertThrows(IllegalStateException.class, () -> new ProductionGuard(props(GOOD, true)).check());
    }

    @Test
    void ownSecretWithoutDemoDataStarts() {
        assertDoesNotThrow(() -> new ProductionGuard(props(GOOD, false)).check());
    }
}
