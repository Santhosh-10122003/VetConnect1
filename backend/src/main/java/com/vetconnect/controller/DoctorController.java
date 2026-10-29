package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.dto.doctor.UpdateAvailabilityRequest;
import com.vetconnect.dto.doctor.UpdateDoctorProfileRequest;
import com.vetconnect.service.AppointmentService;
import com.vetconnect.service.DoctorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
@Tag(name = "Veterinarians", description = "Endpoints for doctor discovery, profiles, availability, and schedules")
public class DoctorController {

    private final DoctorService doctorService;
    private final AppointmentService appointmentService;

    @GetMapping
    @Operation(summary = "Search veterinary doctors. Customers only see doctors in their area (radiusKm applies when GPS is known).")
    public ResponseEntity<ApiResponse<PageResponse<DoctorProfileDto>>> searchDoctors(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long specializationId,
            @RequestParam(required = false) BigDecimal maxFee,
            @RequestParam(required = false) BigDecimal minRating,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        PageResponse<DoctorProfileDto> results = doctorService.searchDoctors(userPrincipal, query, specializationId, maxFee, minRating, radiusKm, pageable);
        return ResponseEntity.ok(ApiResponse.ok(results));
    }

    @GetMapping("/{doctorId}")
    @Operation(summary = "Get detailed profile of a veterinary doctor")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> getDoctorById(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long doctorId) {
        DoctorProfileDto doctor = doctorService.getDoctorById(doctorId, userPrincipal);
        return ResponseEntity.ok(ApiResponse.ok(doctor));
    }

    @GetMapping("/{doctorId}/availability")
    @Operation(summary = "Get available appointment time slots for a doctor on a given date")
    public ResponseEntity<ApiResponse<List<AvailableSlotDto>>> getDoctorAvailability(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        List<AvailableSlotDto> slots = doctorService.getAvailableSlots(doctorId, date, userPrincipal);
        return ResponseEntity.ok(ApiResponse.ok(slots));
    }

    @GetMapping("/me/schedule")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "My day: every slot with what is on it (free, booked by a customer, marked as booked by me, break)")
    public ResponseEntity<ApiResponse<List<com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto>>> getMySchedule(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(ApiResponse.ok(doctorService.getMySchedule(userPrincipal.getId(), date)));
    }

    @PostMapping("/me/blocked-slots")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Mark a free slot as booked (customers cannot take it)")
    public ResponseEntity<ApiResponse<com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto>> blockSlot(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody com.vetconnect.dto.doctor.DoctorScheduleDtos.BlockSlotRequest request
    ) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.ok("Slot marked as booked", doctorService.blockSlot(userPrincipal.getId(), request)));
    }

    @DeleteMapping("/me/blocked-slots/{blockId}")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Undo a slot I marked as booked (a customer's booking can never be undone here)")
    public ResponseEntity<ApiResponse<Void>> unblockSlot(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long blockId
    ) {
        doctorService.unblockSlot(userPrincipal.getId(), blockId);
        return ResponseEntity.ok(ApiResponse.ok("Slot is free again", null));
    }

    @GetMapping("/profile/me")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Get current authenticated doctor's profile")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> getMyDoctorProfile(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        DoctorProfileDto profile = doctorService.getDoctorByUserId(userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Update current authenticated doctor's profile and availability")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> updateDoctorProfile(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateDoctorProfileRequest request
    ) {
        DoctorProfileDto updated = doctorService.updateDoctorProfile(userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Doctor profile updated successfully", updated));
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Create or update doctor profile")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> saveDoctorProfile(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateDoctorProfileRequest request
    ) {
        DoctorProfileDto updated = doctorService.updateDoctorProfile(userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Doctor profile saved successfully", updated));
    }

    @PostMapping("/profile/resubmit")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Ask the admins to review a rejected profile again after fixing the details")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> resubmitForApproval(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody(required = false) ResubmitRequest request
    ) {
        DoctorProfileDto updated = doctorService.resubmitForApproval(userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Your profile has been sent for another review", updated));
    }

    @PutMapping("/availability")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Update doctor working hours and slot availability")
    public ResponseEntity<ApiResponse<DoctorProfileDto>> updateAvailability(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateAvailabilityRequest request
    ) {
        DoctorProfileDto updated = doctorService.updateAvailability(userPrincipal.getId(), request.getAvailabilities());
        return ResponseEntity.ok(ApiResponse.ok("Availability updated successfully", updated));
    }

    @GetMapping("/appointments")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Get authenticated doctor's appointments")
    public ResponseEntity<ApiResponse<PageResponse<AppointmentDto>>> getDoctorAppointments(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        PageResponse<AppointmentDto> appointments = appointmentService.getMyAppointments(userPrincipal.getId(), status, pageable);
        return ResponseEntity.ok(ApiResponse.ok(appointments));
    }
}
