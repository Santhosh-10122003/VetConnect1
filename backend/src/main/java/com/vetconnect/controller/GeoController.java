package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.geo.GeoPlace;
import com.vetconnect.geo.GeoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/geo")
@RequiredArgsConstructor
@Tag(name = "Geography", description = "Country / state / district lists and postal-code or map-pin lookups (public: needed while signing up)")
public class GeoController {

    private final GeoService geoService;

    @GetMapping("/countries")
    @Operation(summary = "All countries")
    public ResponseEntity<ApiResponse<List<GeoService.CountryDto>>> countries() {
        return ResponseEntity.ok(ApiResponse.ok(geoService.countries()));
    }

    @GetMapping("/countries/{countryCode}/states")
    @Operation(summary = "States / provinces of a country")
    public ResponseEntity<ApiResponse<List<GeoService.StateDto>>> states(@PathVariable String countryCode) {
        return ResponseEntity.ok(ApiResponse.ok(geoService.states(countryCode)));
    }

    @GetMapping("/countries/{countryCode}/states/{stateCode}/districts")
    @Operation(summary = "Districts / cities of a state")
    public ResponseEntity<ApiResponse<List<String>>> districts(@PathVariable String countryCode, @PathVariable String stateCode) {
        return ResponseEntity.ok(ApiResponse.ok(geoService.districts(countryCode, stateCode)));
    }

    @GetMapping("/postal-code")
    @Operation(summary = "Find the place a postal code belongs to")
    public ResponseEntity<ApiResponse<GeoPlace>> postalCode(@RequestParam String country,
                                                            @RequestParam String code,
                                                            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(geoService.lookupPostalCode(country, code, request.getRemoteAddr())));
    }

    @GetMapping("/place")
    @Operation(summary = "Find the centre of a district on the map (used to open the map at the right place)")
    public ResponseEntity<ApiResponse<GeoPlace>> place(@RequestParam String country,
                                                       @RequestParam(required = false) String state,
                                                       @RequestParam String district,
                                                       HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(geoService.lookupPlace(country, state, district, request.getRemoteAddr())));
    }

    @GetMapping("/reverse")
    @Operation(summary = "Find the address at a map point")
    public ResponseEntity<ApiResponse<GeoPlace>> reverse(@RequestParam double lat,
                                                         @RequestParam double lng,
                                                         HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(geoService.reverse(lat, lng, request.getRemoteAddr())));
    }
}
