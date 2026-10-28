package com.vetconnect.geo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A resolved location (from a postal code or a map pin), aligned with the country / state / district lists where possible. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeoPlace {
    private Double latitude;
    private Double longitude;
    private String countryCode;
    private String country;
    private String stateCode;
    private String state;
    /** District (or the closest equivalent: county / city). */
    private String district;
    private String postalCode;
    private String displayName;
}
