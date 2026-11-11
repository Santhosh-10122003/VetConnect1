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
    private final com.vetconnect.service.PetLookupService petLookupService;

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "List all pets belonging to the authenticated customer")
    public ResponseEntity<ApiResponse<List<PetDto>>> getMyPets(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        List<PetDto> pets = petService.getCustomerPets(userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(pets));
    }

    @GetMapping("/lookup")
    @Operation(summary = "Find a pet's owner from the pet's ID number (limited to a few tries per hour; the owner is told)")
    public ResponseEntity<ApiResponse<com.vetconnect.dto.pet.PetOwnerLookupDto>> lookup(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam String number
    ) {
        return ResponseEntity.ok(ApiResponse.ok(petLookupService.find(userPrincipal.getId(), number)));
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

    @PostMapping(value = "/{petId}/photo", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Set my pet's profile photo (JPG or PNG, up to 5 MB)")
    public ResponseEntity<ApiResponse<PetDto>> setPhoto(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.ok("Photo saved", petService.setPhoto(petId, userPrincipal.getId(), file)));
    }

    @DeleteMapping("/{petId}/photo")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Remove my pet's profile photo")
    public ResponseEntity<ApiResponse<PetDto>> removePhoto(@PathVariable Long petId, @AuthenticationPrincipal UserPrincipal userPrincipal) {
        return ResponseEntity.ok(ApiResponse.ok("Photo removed", petService.removePhoto(petId, userPrincipal.getId())));
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
