package com.vetconnect.dto.appointment;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleRequest {

    @NotNull(message = "New appointment date is required")
    @FutureOrPresent(message = "Date must be today or in the future")
    private LocalDate appointmentDate;

    @NotNull(message = "New start time is required")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;

    @NotNull(message = "New end time is required")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;

    /** Why the owner wants another time (optional, shown to the doctor). */
    @jakarta.validation.constraints.Size(max = 500, message = "Note is too long")
    private String note;
}
