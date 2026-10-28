package com.vetconnect.common;

/**
 * The one rule for "is this place within reach of this customer", shared by vet clinics and pet-care providers.
 * With a map pin on both sides the distance decides; otherwise the district/city must match, and the country and
 * state must not contradict each other (a missing value counts as unknown, not as a mismatch).
 */
public final class LocationMatch {

    public record Place(String city, String state, String country, Double latitude, Double longitude) {
        public boolean hasPin() {
            return latitude != null && longitude != null;
        }

        public boolean hasAnyLocation() {
            return hasText(city) || hasPin();
        }
    }

    private LocationMatch() {
    }

    public static boolean inArea(Place customer, Place target, double radiusKm) {
        if (customer.hasPin() && target.hasPin()) {
            return GeoUtils.distanceKm(customer.latitude(), customer.longitude(), target.latitude(), target.longitude()) <= radiusKm;
        }
        return hasText(customer.city()) && hasText(target.city())
                && same(customer.city(), target.city())
                && compatible(customer.country(), target.country())
                && compatible(customer.state(), target.state());
    }

    /** Distance in km (one decimal), or null when either side has no pin. */
    public static Double distanceKm(Place customer, Place target) {
        if (customer == null || !customer.hasPin() || !target.hasPin()) return null;
        double km = GeoUtils.distanceKm(customer.latitude(), customer.longitude(), target.latitude(), target.longitude());
        return Math.round(km * 10.0) / 10.0;
    }

    private static boolean compatible(String a, String b) {
        return !hasText(a) || !hasText(b) || same(a, b);
    }

    private static boolean same(String a, String b) {
        return (a == null ? "" : a.trim()).equalsIgnoreCase(b == null ? "" : b.trim());
    }

    private static boolean hasText(String v) {
        return v != null && !v.isBlank();
    }
}
