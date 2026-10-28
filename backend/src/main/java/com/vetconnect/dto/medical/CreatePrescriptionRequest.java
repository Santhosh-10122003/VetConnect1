package com.vetconnect.dto.medical;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePrescriptionRequest {
    @NotBlank(message = "Medication name is required")
    private String medicationName;
    @NotBlank(message = "Dosage is required")
    private String dosage;
    @NotBlank(message = "Frequency is required")
    private String frequency;
    @NotNull(message = "Duration in days is required")
    private Integer durationDays;
    private String instructions;
}
