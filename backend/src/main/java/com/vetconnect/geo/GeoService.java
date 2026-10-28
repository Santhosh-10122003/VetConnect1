package com.vetconnect.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.TooManyRequestsException;
import com.vetconnect.config.AppProperties;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPInputStream;

/**
 * Country / state / district lists (from a bundled dataset) and postal-code or map-pin lookups
 * (via the geocoder). Lookups are cached and rate-limited per client.
 */
@Slf4j
@Service
public class GeoService {

    public record CountryDto(String code, String name, String dialCode) {}
    public record StateDto(String code, String name) {}

    private record StateData(String code, String name, List<String> districts) {}
    private record CountryData(String code, String name, String dialCode, List<StateData> states) {}

    private static final int CACHE_LIMIT = 1000;

    private final GeocoderClient geocoder;
    private final AppProperties properties;
    private final ObjectMapper mapper;

    private List<CountryData> countries = List.of();
    private final Map<String, CountryData> byCode = new HashMap<>();

    private final Map<String, GeoPlace> cache = Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, GeoPlace> eldest) {
            return size() > CACHE_LIMIT;
        }
    });
    private final Map<String, Deque<Long>> recentCalls = new ConcurrentHashMap<>();

    public GeoService(GeocoderClient geocoder, AppProperties properties, ObjectMapper mapper) {
        this.geocoder = geocoder;
        this.properties = properties;
        this.mapper = mapper;
    }

    @PostConstruct
    public void load() {
        try (InputStream raw = new ClassPathResource("geo/world.json.gz").getInputStream();
             GZIPInputStream in = new GZIPInputStream(raw)) {
            JsonNode root = mapper.readTree(in);
            List<CountryData> list = new ArrayList<>();
            for (JsonNode c : root) {
                List<StateData> states = new ArrayList<>();
                for (JsonNode s : c.get("s")) {
                    List<String> districts = new ArrayList<>();
                    s.get("d").forEach(d -> districts.add(d.asText()));
                    states.add(new StateData(s.get("i").asText(), s.get("n").asText(), List.copyOf(districts)));
                }
                list.add(new CountryData(c.get("i").asText(), c.get("n").asText(), c.path("p").asText(""), List.copyOf(states)));
            }
            countries = List.copyOf(list);
            byCode.clear();
            countries.forEach(c -> byCode.put(c.code(), c));
            log.info("Geo dataset loaded: {} countries", countries.size());
        } catch (IOException e) {
            throw new IllegalStateException("Could not load geo/world.json.gz", e);
        }
    }

    // ------------------------------------------------------------------ lists

    public List<CountryDto> countries() {
        return countries.stream().map(c -> new CountryDto(c.code(), c.name(), c.dialCode())).toList();
    }

    public List<StateDto> states(String countryCode) {
        return country(countryCode).states().stream().map(s -> new StateDto(s.code(), s.name())).toList();
    }

    public List<String> districts(String countryCode, String stateCode) {
        return state(country(countryCode), stateCode).districts();
    }

    // ------------------------------------------------------------------ lookups

    public GeoPlace lookupPostalCode(String countryCode, String postalCode, String clientKey) {
        CountryData country = country(countryCode);
        String code = postalCode == null ? "" : postalCode.trim();
        if (!code.matches("[A-Za-z0-9][A-Za-z0-9 -]{1,10}")) {
            throw new BadRequestException("Enter a valid postal code.");
        }
        String cacheKey = "pc:" + country.code() + ":" + code.toUpperCase(Locale.ROOT);
        GeoPlace cached = cache.get(cacheKey);
        if (cached != null) return cached;

        throttle(clientKey);
        JsonNode result = geocoder.searchPostalCode(country.code(), code);
        if (result == null) {
            log.info("Postal code not found: {} {}", country.code(), code);
            throw new ResourceNotFoundException("No location found for postal code " + code + " in " + country.name() + ".");
        }
        GeoPlace place = toPlace(result, parseDouble(result.path("lat").asText(null)), parseDouble(result.path("lon").asText(null)));
        if (place.getPostalCode() == null) place.setPostalCode(code);
        cache.put(cacheKey, place);
        return place;
    }

    /** Where the middle of a chosen district is, so the map can open there instead of on a world view. */
    public GeoPlace lookupPlace(String countryCode, String state, String district, String clientKey) {
        CountryData country = country(countryCode);
        String d = district == null ? "" : district.trim();
        String s = state == null ? "" : state.trim();
        if (d.isEmpty() || d.length() > 100 || s.length() > 100) {
            throw new BadRequestException("Enter a district to look up.");
        }
        String query = d + (s.isEmpty() ? "" : ", " + s) + ", " + country.name();
        String cacheKey = "pl:" + country.code() + ":" + norm(query);
        GeoPlace cached = cache.get(cacheKey);
        if (cached != null) return cached;

        throttle(clientKey);
        JsonNode result = geocoder.searchPlace(query, country.code());
        if (result == null) {
            log.info("Place not found: {}", query);
            throw new ResourceNotFoundException("Could not find " + d + " on the map.");
        }
        GeoPlace place = toPlace(result, parseDouble(result.path("lat").asText(null)), parseDouble(result.path("lon").asText(null)));
        cache.put(cacheKey, place);
        return place;
    }

    public GeoPlace reverse(double latitude, double longitude, String clientKey) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new BadRequestException("Coordinates are out of range.");
        }
        String cacheKey = String.format(Locale.ROOT, "rev:%.4f:%.4f", latitude, longitude);
        GeoPlace cached = cache.get(cacheKey);
        if (cached != null) return cached;

        throttle(clientKey);
        JsonNode result = geocoder.reverse(latitude, longitude);
        if (result == null) {
            throw new ResourceNotFoundException("No address found at that point on the map.");
        }
        // keep the exact pin the user chose rather than the centre of the matched area
        GeoPlace place = toPlace(result, latitude, longitude);
        cache.put(cacheKey, place);
        return place;
    }

    // ------------------------------------------------------------------ mapping (package-private for tests)

    GeoPlace toPlace(JsonNode json, Double latitude, Double longitude) {
        JsonNode a = json.path("address");
        String countryCode = a.path("country_code").asText("").toUpperCase(Locale.ROOT);
        CountryData country = byCode.get(countryCode);

        String rawState = text(a, "state", "province", "region", "state_district");
        String rawDistrict = clean(first(text(a, "state_district"), text(a, "county"), text(a, "city"), text(a, "town"),
                text(a, "village"), text(a, "municipality")));

        StateData state = country == null ? null : matchState(country, rawState);
        String district = rawDistrict;
        if (state != null && rawDistrict != null) {
            district = matchDistrict(state, rawDistrict, text(a, "county"), text(a, "city"));
        }

        return GeoPlace.builder()
                .latitude(latitude)
                .longitude(longitude)
                .countryCode(countryCode.isEmpty() ? null : countryCode)
                .country(country != null ? country.name() : text(a, "country"))
                .stateCode(state != null ? state.code() : null)
                .state(state != null ? state.name() : rawState)
                .district(district)
                .postalCode(text(a, "postcode"))
                .displayName(json.path("display_name").asText(null))
                .build();
    }

    private StateData matchState(CountryData country, String rawState) {
        if (rawState == null) return country.states().size() == 1 ? country.states().get(0) : null;
        String target = norm(rawState);
        for (StateData s : country.states()) if (norm(s.name()).equals(target)) return s;
        for (StateData s : country.states()) {
            String n = norm(s.name());
            if (n.length() >= 4 && target.length() >= 4 && (n.contains(target) || target.contains(n))) return s;
        }
        return country.states().size() == 1 ? country.states().get(0) : null;
    }

    private String matchDistrict(StateData state, String preferred, String... alternatives) {
        List<String> candidates = new ArrayList<>();
        candidates.add(preferred);
        for (String alt : alternatives) if (alt != null) candidates.add(clean(alt));
        for (String c : candidates) {
            String target = norm(c);
            for (String d : state.districts()) if (norm(d).equals(target)) return d;
        }
        for (String c : candidates) {
            String target = norm(c);
            if (target.length() < 4) continue;
            for (String d : state.districts()) {
                String n = norm(d);
                if (n.length() >= 4 && (n.startsWith(target) || target.startsWith(n))) return d;
            }
        }
        return preferred; // not in the list: the app shows it as a custom entry
    }

    // ------------------------------------------------------------------ helpers

    private CountryData country(String code) {
        CountryData c = code == null ? null : byCode.get(code.trim().toUpperCase(Locale.ROOT));
        if (c == null) throw new ResourceNotFoundException("Unknown country: " + code);
        return c;
    }

    private StateData state(CountryData country, String stateCode) {
        return country.states().stream()
                .filter(s -> s.code().equalsIgnoreCase(stateCode))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Unknown state: " + stateCode));
    }

    private void throttle(String clientKey) {
        int limit = properties.getGeo().getRequestsPerMinutePerClient();
        long now = System.currentTimeMillis();
        Deque<Long> calls = recentCalls.computeIfAbsent(clientKey == null ? "?" : clientKey, k -> new ArrayDeque<>());
        synchronized (calls) {
            while (!calls.isEmpty() && now - calls.peekFirst() > 60_000) calls.pollFirst();
            if (calls.size() >= limit) {
                log.warn("Geo lookup rate limit hit for {}", clientKey);
                throw new TooManyRequestsException("Too many location lookups. Please wait a minute and try again.");
            }
            calls.addLast(now);
        }
    }

    static String norm(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
        n = n.replaceAll("\\b(district|division|state|province|region|county|city of|municipality)\\b", "");
        return n.replaceAll("[^a-z0-9]", "");
    }

    static String clean(String s) {
        if (s == null) return null;
        String c = s.replaceAll("(?i)\\s+(district|division)$", "").replaceAll("(?i)^(district of|city of)\\s+", "").trim();
        return c.isEmpty() ? null : c;
    }

    private static String text(JsonNode node, String... fields) {
        for (String f : fields) {
            String v = node.path(f).asText("").trim();
            if (!v.isEmpty()) return v;
        }
        return null;
    }

    private static String first(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static Double parseDouble(String v) {
        try {
            return v == null ? null : Double.valueOf(v);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
