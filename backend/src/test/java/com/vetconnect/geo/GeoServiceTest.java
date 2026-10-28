package com.vetconnect.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.TooManyRequestsException;
import com.vetconnect.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class GeoServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Trimmed copies of real Nominatim answers for Coimbatore. */
    private static final String POSTCODE_641001 = """
            {"lat":"10.9908477","lon":"76.9742933","display_name":"641001, Ward 74, Central Zone, Coimbatore, Coimbatore North, Coimbatore, Tamil Nadu, India",
             "address":{"postcode":"641001","suburb":"Ward 74","city":"Coimbatore","county":"Coimbatore North","state_district":"Coimbatore","state":"Tamil Nadu","country":"India","country_code":"in"}}""";
    private static final String REVERSE_COIMBATORE = """
            {"lat":"11.0161577","lon":"76.9618816","display_name":"Ward 51, Coimbatore, Tamil Nadu, 641001, India",
             "address":{"suburb":"Ward 51","city":"Coimbatore","county":"Coimbatore North","state_district":"Coimbatore","state":"Tamil Nadu","postcode":"641001","country":"India","country_code":"in"}}""";

    private final AtomicInteger geocoderCalls = new AtomicInteger();
    private JsonNode nextSearch;
    private String lastQuery;
    private JsonNode nextReverse;
    private GeoService service;

    @BeforeEach
    void setUp() throws Exception {
        geocoderCalls.set(0);
        nextSearch = MAPPER.readTree(POSTCODE_641001);
        nextReverse = MAPPER.readTree(REVERSE_COIMBATORE);
        GeocoderClient fake = new GeocoderClient() {
            @Override public JsonNode searchPostalCode(String countryCode, String postalCode) { geocoderCalls.incrementAndGet(); return nextSearch; }
            @Override public JsonNode searchPlace(String query, String countryCode) { geocoderCalls.incrementAndGet(); lastQuery = query; return nextSearch; }
            @Override public JsonNode reverse(double latitude, double longitude) { geocoderCalls.incrementAndGet(); return nextReverse; }
        };
        service = new GeoService(fake, new AppProperties(), MAPPER);
        service.load();
    }

    // ---------------------------------------------------------------- lists

    @Test
    void datasetHasEveryCountryAndTheStatesAndDistrictsOfIndia() {
        assertTrue(service.countries().size() > 200);
        assertTrue(service.countries().stream().anyMatch(c -> c.code().equals("IN") && c.name().equals("India")));
        assertTrue(service.states("IN").stream().anyMatch(s -> s.name().equals("Tamil Nadu")));
        String tn = service.states("in").stream().filter(s -> s.name().equals("Tamil Nadu")).findFirst().orElseThrow().code();
        List<String> districts = service.districts("IN", tn);
        assertTrue(districts.contains("Coimbatore"));
        assertTrue(districts.contains("Chennai"));
    }

    @Test
    void districtListsAreSortedAndFreeOfDuplicates() {
        String tn = service.states("IN").stream().filter(s -> s.name().equals("Tamil Nadu")).findFirst().orElseThrow().code();
        List<String> districts = service.districts("IN", tn);
        assertEquals(districts.stream().distinct().count(), districts.size());
        assertEquals(districts.stream().sorted(String::compareToIgnoreCase).toList().size(), districts.size());
    }

    @Test
    void aCountryWithoutStatesStillOffersAPlaceToPick() {
        // e.g. small countries: one pseudo-state so the three-step picker keeps working
        assertFalse(service.states("SG").isEmpty());
    }

    @Test
    void unknownCountryOrStateIs404() {
        assertThrows(ResourceNotFoundException.class, () -> service.states("ZZ"));
        assertThrows(ResourceNotFoundException.class, () -> service.districts("IN", "NOPE"));
    }

    // ---------------------------------------------------------------- postal code

    @Test
    void postalCodeIsResolvedToTheDistrictStateAndCoordinates() {
        GeoPlace place = service.lookupPostalCode("IN", "641001", "1.1.1.1");

        assertEquals("Coimbatore", place.getDistrict());
        assertEquals("Tamil Nadu", place.getState());
        assertEquals("TN", place.getStateCode());
        assertEquals("IN", place.getCountryCode());
        assertEquals("India", place.getCountry());
        assertEquals("641001", place.getPostalCode());
        assertEquals(10.9908477, place.getLatitude(), 1e-6);
        assertEquals(76.9742933, place.getLongitude(), 1e-6);
    }

    @Test
    void postalCodeLookupsAreCached() {
        service.lookupPostalCode("IN", "641001", "a");
        service.lookupPostalCode("in", " 641001 ", "b");

        assertEquals(1, geocoderCalls.get());
    }

    @Test
    void unknownPostalCodeIs404WithAHelpfulMessage() {
        nextSearch = null;

        ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class, () -> service.lookupPostalCode("IN", "000000", "x"));
        assertTrue(ex.getMessage().contains("000000"));
        assertTrue(ex.getMessage().contains("India"));
    }

    @Test
    void malformedPostalCodesNeverReachTheGeocoder() {
        for (String bad : new String[]{"", " ", "1", "64;DROP", "<script>", "123456789012345"}) {
            assertThrows(BadRequestException.class, () -> service.lookupPostalCode("IN", bad, "x"), bad);
        }
        assertEquals(0, geocoderCalls.get());
    }

    // ---------------------------------------------------------------- district centre

    @Test
    void aDistrictIsFoundByNameWithItsStateAndCountry() {
        GeoPlace place = service.lookupPlace("IN", "Tamil Nadu", "Coimbatore", "x");

        assertEquals("Coimbatore, Tamil Nadu, India", lastQuery);
        assertEquals(10.9908477, place.getLatitude(), 1e-6);
        assertEquals("Coimbatore", place.getDistrict());
    }

    @Test
    void districtLookupsAreCachedAndValidated() {
        service.lookupPlace("IN", "Tamil Nadu", "Coimbatore", "a");
        service.lookupPlace("in", " tamil nadu ", " coimbatore ", "b");
        assertEquals(1, geocoderCalls.get());

        assertThrows(BadRequestException.class, () -> service.lookupPlace("IN", "Tamil Nadu", "  ", "x"));
        assertThrows(BadRequestException.class, () -> service.lookupPlace("IN", "Tamil Nadu", "x".repeat(101), "x"));
        assertThrows(ResourceNotFoundException.class, () -> service.lookupPlace("ZZ", "s", "d", "x"));
    }

    @Test
    void unknownDistrictIs404() {
        nextSearch = null;
        assertThrows(ResourceNotFoundException.class, () -> service.lookupPlace("IN", "Tamil Nadu", "Nowhereville", "x"));
    }

    // ---------------------------------------------------------------- map pin

    @Test
    void mapPinKeepsTheExactPointAndFillsInTheAddress() {
        GeoPlace place = service.reverse(11.0168, 76.9558, "x");

        assertEquals(11.0168, place.getLatitude());
        assertEquals(76.9558, place.getLongitude());
        assertEquals("Coimbatore", place.getDistrict());
        assertEquals("Tamil Nadu", place.getState());
        assertEquals("641001", place.getPostalCode());
    }

    @Test
    void nothingAtThePinIs404_andOutOfRangeIs400() {
        nextReverse = null;
        assertThrows(ResourceNotFoundException.class, () -> service.reverse(0.0, 0.0, "x"));
        assertThrows(BadRequestException.class, () -> service.reverse(91, 0, "x"));
        assertThrows(BadRequestException.class, () -> service.reverse(0, 181, "x"));
    }

    // ---------------------------------------------------------------- name alignment

    @Test
    void districtNamesAreAlignedWithTheDatasetSpelling() throws Exception {
        JsonNode json = MAPPER.readTree("""
                {"address":{"state_district":"Coimbatore District","state":"Tamil Nadu","country":"India","country_code":"in"}}""");

        assertEquals("Coimbatore", service.toPlace(json, 1.0, 2.0).getDistrict());
    }

    @Test
    void stateNamesWithExtraWordsStillMatch() throws Exception {
        JsonNode json = MAPPER.readTree("""
                {"address":{"city":"New Delhi","state":"National Capital Territory of Delhi","country":"India","country_code":"in"}}""");

        GeoPlace place = service.toPlace(json, 1.0, 2.0);

        assertNotNull(place.getStateCode(), "Delhi should be recognised: " + place);
        assertEquals("IN", place.getCountryCode());
    }

    @Test
    void aDistrictNotInTheListIsKeptAsGiven() throws Exception {
        JsonNode json = MAPPER.readTree("""
                {"address":{"state_district":"Totally New District","state":"Tamil Nadu","country":"India","country_code":"in"}}""");

        assertEquals("Totally New", service.toPlace(json, 1.0, 2.0).getDistrict());
    }

    // ---------------------------------------------------------------- abuse protection

    @Test
    void aSingleClientCannotHammerTheGeocoder() {
        AppProperties props = new AppProperties();
        props.getGeo().setRequestsPerMinutePerClient(3);
        GeoService limited = new GeoService(new GeocoderClient() {
            @Override public JsonNode searchPostalCode(String c, String p) { return nextSearch; }
            @Override public JsonNode searchPlace(String q, String c) { return nextSearch; }
            @Override public JsonNode reverse(double a, double b) { return nextReverse; }
        }, props, MAPPER);
        limited.load();

        limited.lookupPostalCode("IN", "641001", "greedy");
        limited.lookupPostalCode("IN", "641002", "greedy");
        limited.lookupPostalCode("IN", "641003", "greedy");
        assertThrows(TooManyRequestsException.class, () -> limited.lookupPostalCode("IN", "641004", "greedy"));
        assertDoesNotThrow(() -> limited.lookupPostalCode("IN", "641005", "someone-else"));
    }
}
