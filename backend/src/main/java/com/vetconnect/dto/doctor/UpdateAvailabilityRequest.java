package com.vetconnect.dto.doctor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Replaces only the weekly schedule; profile fields are left alone. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAvailabilityRequest {

    @NotNull(message = "Availabilities are required")
    @Valid
    private List<DoctorAvailabilityDto> availabilities;
}
