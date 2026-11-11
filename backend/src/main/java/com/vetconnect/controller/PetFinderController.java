package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.dto.pet.PetOwnerLookupDto;
import com.vetconnect.service.PetLookupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** What a pet's QR code opens: the owner's contact details, with no sign-in. */
@RestController
@RequestMapping("/api/pet-finder")
@RequiredArgsConstructor
@Tag(name = "Pets", description = "Endpoints for managing pet profiles")
public class PetFinderController {

    private final PetLookupService petLookupService;

    @GetMapping("/{number}")
    @Operation(summary = "A scanned pet QR code: the pet and how to reach its owner (no sign-in; limited per address; the owner is told)")
    public ResponseEntity<ApiResponse<PetOwnerLookupDto>> scan(@PathVariable String number, HttpServletRequest request) {
        return ResponseEntity.ok()
                .header("Cache-Control", "no-store")
                .body(ApiResponse.ok(petLookupService.scan(request.getRemoteAddr(), number)));
    }
}
