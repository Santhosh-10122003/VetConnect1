package com.vetconnect.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.common.exceptions.ExternalServiceException;
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
import java.util.Locale;

/**
 * Talks to OpenStreetMap's public Nominatim service. Its usage policy asks for an identifying User-Agent and
 * at most one request per second, so calls are serialised and spaced out here. Results are cached by the caller.
 */
@Slf4j
@Component
public class NominatimClient implements GeocoderClient {

    private static final long MIN_GAP_MS = 1100;

    private final AppProperties.Geo config;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private long lastCallAt = 0;

    public NominatimClient(AppProperties appProperties, ObjectMapper mapper) {
        this.config = appProperties.getGeo();
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(config.getTimeoutMs())).build();
    }

    @Override
    public JsonNode searchPostalCode(String countryCode, String postalCode) {
        String url = config.getNominatimUrl() + "/search?format=jsonv2&addressdetails=1&limit=1"
                + "&countrycodes=" + enc(countryCode.toLowerCase(Locale.ROOT))
                + "&postalcode=" + enc(postalCode);
        JsonNode result = get(url);
        return result != null && result.isArray() && !result.isEmpty() ? result.get(0) : null;
    }

    @Override
    public JsonNode searchPlace(String query, String countryCode) {
        String url = config.getNominatimUrl() + "/search?format=jsonv2&addressdetails=1&limit=1"
                + (countryCode == null ? "" : "&countrycodes=" + enc(countryCode.toLowerCase(Locale.ROOT)))
                + "&q=" + enc(query);
        JsonNode result = get(url);
        return result != null && result.isArray() && !result.isEmpty() ? result.get(0) : null;
    }

    @Override
    public JsonNode reverse(double latitude, double longitude) {
        String url = config.getNominatimUrl() + "/reverse?format=jsonv2&addressdetails=1&zoom=14"
                + "&lat=" + latitude + "&lon=" + longitude;
        JsonNode result = get(url);
        return result == null || result.has("error") ? null : result;
    }

    private synchronized JsonNode get(String url) {
        try {
            long wait = MIN_GAP_MS - (System.currentTimeMillis() - lastCallAt);
            if (wait > 0) Thread.sleep(wait);
            lastCallAt = System.currentTimeMillis();

            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMillis(config.getTimeoutMs()))
                    .header("User-Agent", config.getUserAgent())
                    .header("Accept", "application/json")
                    .header("Accept-Language", "en")
                    .GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.error("Geocoder returned HTTP {} for {}", response.statusCode(), url);
                throw new ExternalServiceException("Location lookup is unavailable right now. Please pin the location on the map or type your city.");
            }
            return mapper.readTree(response.body());
        } catch (IOException e) {
            log.error("Geocoder call failed: {}", e.toString());
            throw new ExternalServiceException("Location lookup is unavailable right now. Please pin the location on the map or type your city.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExternalServiceException("Location lookup was interrupted. Please try again.");
        }
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }
}
