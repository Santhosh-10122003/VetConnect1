package com.vetconnect.domain.enums;

import java.math.BigDecimal;

public enum PetSize {
    SMALL,
    MEDIUM,
    LARGE,
    GIANT;

    /** A sensible default from the weight in kg (up to 7, 20 or 35 kg, then above); an unknown weight is MEDIUM. */
    public static PetSize fromWeight(BigDecimal kg) {
        if (kg == null) return MEDIUM;
        double w = kg.doubleValue();
        if (w <= 7) return SMALL;
        if (w <= 20) return MEDIUM;
        if (w <= 35) return LARGE;
        return GIANT;
    }
}
