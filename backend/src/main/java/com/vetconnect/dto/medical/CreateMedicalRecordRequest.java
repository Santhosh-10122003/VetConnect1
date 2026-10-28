package com.vetconnect.dto.medical;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateMedicalRecordRequest {
    private Long appointmentId;
    private LocalDate visitDate;
    @NotBlank(message = "Diagnosis is required")
    private String diagnosis;
    private String symptoms;
    private String clinicalNotes;
    private String treatmentPlan;
    private BigDecimal weightAtVisit;
    private List<CreatePrescriptionRequest> prescriptions;
}
