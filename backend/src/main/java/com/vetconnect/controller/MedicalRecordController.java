package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.medical.CreateMedicalRecordRequest;
import com.vetconnect.dto.medical.MedicalRecordDto;
import com.vetconnect.dto.medical.PrescriptionDto;
import com.vetconnect.service.MedicalRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pets/{petId}")
@RequiredArgsConstructor
@Tag(name = "Medical Records", description = "Endpoints for pet medical records and prescriptions")
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    @GetMapping("/medical-records")
    @Operation(summary = "Get medical history and clinical notes for a pet")
    public ResponseEntity<ApiResponse<List<MedicalRecordDto>>> getPetMedicalRecords(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        List<MedicalRecordDto> records = medicalRecordService.getMedicalRecordsByPetId(petId, userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(records));
    }

    @PostMapping("/medical-records")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Add medical record and prescriptions for a pet after consultation (Doctor)")
    public ResponseEntity<ApiResponse<MedicalRecordDto>> createMedicalRecord(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateMedicalRecordRequest request
    ) {
        MedicalRecordDto record = medicalRecordService.createMedicalRecord(petId, userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Medical record added", record));
    }

    @GetMapping("/prescriptions")
    @Operation(summary = "Get prescription history for a pet")
    public ResponseEntity<ApiResponse<List<PrescriptionDto>>> getPetPrescriptions(
            @PathVariable Long petId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        List<PrescriptionDto> prescriptions = medicalRecordService.getPrescriptionsByPetId(petId, userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(prescriptions));
    }
}
