package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.pet.CreatePetRequest;
import com.vetconnect.dto.pet.PetDto;
import com.vetconnect.dto.pet.UpdatePetRequest;
import com.vetconnect.service.PetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pets")
@RequiredArgsConstructor
@Tag(name = "Pets", description = "Endpoints for managing pet profiles")
public class PetController {

    private final PetService petService;

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "List all pets belonging to the authenticated customer")
    public ResponseEntity<ApiResponse<List<PetDto>>> getMyPets(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        List<PetDto> pets = petService.getCustomerPets(userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(pets));
    }

    @GetMapping("/{petId}")
    @Operation(summary = "Get pet details by ID")
    public ResponseEntity<ApiResponse<PetDto>> getPetById(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        PetDto pet = petService.getPetById(petId, userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(pet));
    }

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Register a new pet")
    public ResponseEntity<ApiResponse<PetDto>> createPet(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreatePetRequest request
    ) {
        PetDto created = petService.createPet(userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Pet registered successfully", created));
    }

    @PutMapping("/{petId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Update an existing pet profile")
    public ResponseEntity<ApiResponse<PetDto>> updatePet(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdatePetRequest request
    ) {
        PetDto updated = petService.updatePet(petId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Pet updated successfully", updated));
    }

    @DeleteMapping("/{petId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Delete a pet profile")
    public ResponseEntity<ApiResponse<Void>> deletePet(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        petService.deletePet(petId, userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Pet deleted successfully", null));
    }
}
