package com.vetconnect.geo;

import com.fasterxml.jackson.databind.JsonNode;

/** Source of raw geocoding results (OpenStreetMap Nominatim format). A seam so tests need no network. */
public interface GeocoderClient {

    /** First match for a postal code in a country, or {@code null} when nothing matches. */
    JsonNode searchPostalCode(String countryCode, String postalCode);

    /** First match for a free-text place such as "Coimbatore, Tamil Nadu, India", or {@code null}. */
    JsonNode searchPlace(String query, String countryCode);

    /** Address at a coordinate, or {@code null} when nothing is there (e.g. open sea). */
    JsonNode reverse(double latitude, double longitude);
}
