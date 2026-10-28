package com.vetconnect.dto.medical;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MedicalRecordDto {
    private Long id;
    private Long petId;
    private String petName;
    private Long appointmentId;
    private String bookingReference;
    private Long doctorId;
    private String doctorName;
    private String clinicName;
    private LocalDate visitDate;
    private String diagnosis;
    private String symptoms;
    private String clinicalNotes;
    private String treatmentPlan;
    private BigDecimal weightAtVisit;
    private List<PrescriptionDto> prescriptions;
    private Instant createdAt;
}
