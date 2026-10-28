package com.vetconnect.dto.appointment;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.vetconnect.domain.enums.AppointmentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RescheduleDto {
        private LocalDate appointmentDate;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime startTime;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime endTime;
        private String note;
        private Instant requestedAt;
    }

    private Long id;
    private String bookingReference;
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private Long doctorId;
    private String doctorName;
    private String clinicName;
    private String clinicAddress;
    private String clinicCity;
    private Double clinicLatitude;
    private Double clinicLongitude;
    private BigDecimal consultationFee;
    /** What the visit costs, what was (or must be) paid up front, and what is left to pay at the clinic. */
    private BigDecimal totalAmount;
    private BigDecimal advanceAmount;
    private BigDecimal balanceAmount;
    private String currency;
    /** While waiting for the advance: when the held slot is released. */
    private Instant expiresAt;
    private com.vetconnect.dto.care.CareDtos.PaymentDto payment;
    private Long petId;
    private String petName;
    private String petSpecies;
    private String petBreed;
    private LocalDate appointmentDate;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;
    private String reason;
    private AppointmentStatus status;
    private String cancellationReason;
    private String notes;
    /** The reschedule the owner asked for, waiting for the doctor's answer; null when there is none. */
    private RescheduleDto rescheduleRequest;
    private boolean hasReview;
    private boolean hasMedicalRecord;
    private Instant createdAt;
}
