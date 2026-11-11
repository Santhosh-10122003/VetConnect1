package com.vetconnect.dto.pet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What a person who found a pet sees: the pet, and how to reach its owner. */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PetOwnerLookupDto {
    private String petName;
    private String species;
    private String breed;
    private String avatarUrl;
    private String ownerName;
    private String ownerPhone;
    private String ownerAddress;
}
