package com.vetconnect.dto.pet;

import com.vetconnect.domain.enums.Gender;
import com.vetconnect.domain.enums.PetSpecies;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePetRequest {

    @NotBlank(message = "Pet name is required")
    private String name;

    @NotNull(message = "Species is required (DOG, CAT, BIRD, RABBIT, OTHER)")
    private PetSpecies species;

    private String breed;
    private LocalDate dateOfBirth;

    @NotNull(message = "Gender is required (MALE, FEMALE, UNKNOWN)")
    private Gender gender;

    private BigDecimal weight;
    private String allergies;
    private String existingConditions;
    private String microchipNumber;
    private String avatarUrl;
}
