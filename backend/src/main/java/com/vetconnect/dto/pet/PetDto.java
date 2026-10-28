package com.vetconnect.dto.pet;

import com.vetconnect.domain.enums.Gender;
import com.vetconnect.domain.enums.PetSpecies;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PetDto {
    private Long id;
    private Long customerId;
    private String customerName;
    private String name;
    private PetSpecies species;
    private String breed;
    private LocalDate dateOfBirth;
    private Gender gender;
    private BigDecimal weight;
    private String allergies;
    private String existingConditions;
    private String microchipNumber;
    private String avatarUrl;
    private Instant createdAt;
}
