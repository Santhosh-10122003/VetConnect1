package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.dto.admin.AdminDashboardStatsDto;
import com.vetconnect.dto.admin.DoctorVerificationRequest;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administration", description = "Endpoints for platform administration, approvals, and metrics")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/dashboard")
    @Operation(summary = "Get platform statistical overview")
    public ResponseEntity<ApiResponse<AdminDashboardStatsDto>> getDashboardStats() {
        AdminDashboardStatsDto stats = adminService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }

    @GetMapping("/doctors/pending")
    @Operation(summary = "List doctors awaiting professional credential verification")
    public ResponseEntity<ApiResponse<List<DoctorProfileDto>>> getPendingDoctors() {
        List<DoctorProfileDto> pending = adminService.getPendingDoctors();
        return ResponseEntity.ok(ApiResponse.ok(pending));
    }

    @GetMapping("/doctors/resubmitted")
    @Operation(summary = "List rejected doctors who corrected their profile and asked for another review")
    public ResponseEntity<ApiResponse<List<DoctorProfileDto>>> getResubmittedDoctors() {
        List<DoctorProfileDto> resubmitted = adminService.getResubmittedDoctors();
        return ResponseEntity.ok(ApiResponse.ok(resubmitted));
    }

    @GetMapping("/providers/pending")
    @Operation(summary = "Pet-care businesses waiting for their first review")
    public ResponseEntity<ApiResponse<List<com.vetconnect.dto.care.CareDtos.ProviderDto>>> getPendingProviders() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getPendingProviders()));
    }

    @GetMapping("/providers/resubmitted")
    @Operation(summary = "Rejected pet-care businesses that fixed their details and asked again")
    public ResponseEntity<ApiResponse<List<com.vetconnect.dto.care.CareDtos.ProviderDto>>> getResubmittedProviders() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getResubmittedProviders()));
    }

    @PatchMapping("/providers/{providerId}/verification")
    @Operation(summary = "Approve or reject a pet-care business, with a reason")
    public ResponseEntity<ApiResponse<com.vetconnect.dto.care.CareDtos.ProviderDto>> updateProviderVerification(
            @PathVariable Long providerId,
            @Valid @RequestBody DoctorVerificationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok("Verification status updated", adminService.updateProviderVerification(providerId, request)));
    }

    @PatchMapping("/doctors/{doctorId}/verification")
    @Operation(summary = "Approve or reject doctor qualification verification")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> updateDoctorVerification(
            @PathVariable Long doctorId,
            @Valid @RequestBody DoctorVerificationRequest request
    ) {
        DoctorProfileDto updated = adminService.updateDoctorVerification(doctorId, request);
        return ResponseEntity.ok(ApiResponse.ok("Verification status updated", updated));
    }

    @GetMapping("/appointments")
    @Operation(summary = "Monitor all platform appointments")
    public ResponseEntity<ApiResponse<PageResponse<AppointmentDto>>> getAllAppointments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        PageResponse<AppointmentDto> appointments = adminService.getAllAppointments(pageable);
        return ResponseEntity.ok(ApiResponse.ok(appointments));
    }
}
