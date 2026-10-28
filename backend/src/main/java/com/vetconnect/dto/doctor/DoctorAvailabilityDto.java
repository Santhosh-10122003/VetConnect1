package com.vetconnect.dto.doctor;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DoctorAvailabilityDto {
    private Long id;
    private Integer dayOfWeek; // 1 = Mon, 7 = Sun
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;
    @Builder.Default
    private Integer slotDurationMinutes = 30;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime breakStartTime;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime breakEndTime;
    @Builder.Default
    private Boolean isActive = true;
}
