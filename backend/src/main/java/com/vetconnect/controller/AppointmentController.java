package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.appointment.BookAppointmentRequest;
import com.vetconnect.dto.appointment.RescheduleRequest;
import com.vetconnect.dto.appointment.StatusUpdateRequest;
import com.vetconnect.dto.care.CareDtos.CancellationPreviewDto;
import com.vetconnect.dto.care.CareDtos.CheckoutResultRequest;
import com.vetconnect.dto.care.CareDtos.PaymentFailedRequest;
import com.vetconnect.dto.care.CareDtos.SimulatePaymentRequest;
import com.vetconnect.service.AppointmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
@Tag(name = "Appointments", description = "Endpoints for booking, managing, and tracking appointment lifecycle")
public class AppointmentController {

    private final AppointmentService appointmentService;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Book a new veterinary appointment")
    public ResponseEntity<ApiResponse<AppointmentDto>> bookAppointment(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody BookAppointmentRequest request
    ) {
        AppointmentDto booked = appointmentService.bookAppointment(userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Appointment booked successfully", booked));
    }

    @GetMapping("/my")
    @Operation(summary = "Get user's appointments (filtered by UPCOMING, COMPLETED, CANCELLED)")
    public ResponseEntity<ApiResponse<PageResponse<AppointmentDto>>> getMyAppointments(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String tab,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        PageResponse<AppointmentDto> appointments = appointmentService.getMyAppointments(userPrincipal.getId(), tab, pageable);
        return ResponseEntity.ok(ApiResponse.ok(appointments));
    }

    @GetMapping("/{appointmentId}")
    @Operation(summary = "Get detailed information for a specific appointment")
    public ResponseEntity<ApiResponse<AppointmentDto>> getAppointmentById(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        AppointmentDto appt = appointmentService.getAppointmentById(appointmentId, userPrincipal.getId());
        return ResponseEntity.ok(ApiResponse.ok(appt));
    }

    @PostMapping("/{appointmentId}/payment/simulate")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Test mode only: settle the advance as paid or failed")
    public ResponseEntity<ApiResponse<AppointmentDto>> simulatePayment(
            @AuthenticationPrincipal UserPrincipal userPrincipal, @PathVariable Long appointmentId,
            @Valid @RequestBody SimulatePaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(appointmentService.settleTestPayment(userPrincipal.getId(), appointmentId, request.getOutcome())));
    }

    @PostMapping("/{appointmentId}/payment/confirm")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "The checkout reports a successful payment; the signature is verified before the visit is requested")
    public ResponseEntity<ApiResponse<AppointmentDto>> confirmPayment(
            @AuthenticationPrincipal UserPrincipal userPrincipal, @PathVariable Long appointmentId,
            @Valid @RequestBody CheckoutResultRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(appointmentService.confirmCheckout(userPrincipal.getId(), appointmentId, request)));
    }

    @PostMapping("/{appointmentId}/payment/failed")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "The checkout reports a declined payment; the slot stays held")
    public ResponseEntity<ApiResponse<AppointmentDto>> paymentFailed(
            @AuthenticationPrincipal UserPrincipal userPrincipal, @PathVariable Long appointmentId,
            @Valid @RequestBody PaymentFailedRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(appointmentService.paymentFailed(userPrincipal.getId(), appointmentId, request.getReason())));
    }

    @PostMapping("/{appointmentId}/payment/retry")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Open a new payment after a failed one, while the slot is still held")
    public ResponseEntity<ApiResponse<AppointmentDto>> retryPayment(
            @AuthenticationPrincipal UserPrincipal userPrincipal, @PathVariable Long appointmentId) {
        return ResponseEntity.ok(ApiResponse.ok(appointmentService.retryPayment(userPrincipal.getId(), appointmentId)));
    }

    @GetMapping("/{appointmentId}/cancellation-preview")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "What cancelling now would refund")
    public ResponseEntity<ApiResponse<CancellationPreviewDto>> cancellationPreview(
            @AuthenticationPrincipal UserPrincipal userPrincipal, @PathVariable Long appointmentId) {
        return ResponseEntity.ok(ApiResponse.ok(appointmentService.cancellationPreview(userPrincipal.getId(), appointmentId)));
    }

    @PatchMapping("/{appointmentId}/confirm")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    @Operation(summary = "Confirm a pending appointment (Doctor/Admin)")
    public ResponseEntity<ApiResponse<AppointmentDto>> confirmAppointment(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) StatusUpdateRequest request
    ) {
        AppointmentDto updated = appointmentService.confirmAppointment(appointmentId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Appointment confirmed", updated));
    }

    @PatchMapping("/{appointmentId}/reject")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    @Operation(summary = "Reject a pending appointment request (Doctor/Admin)")
    public ResponseEntity<ApiResponse<AppointmentDto>> rejectAppointment(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) StatusUpdateRequest request
    ) {
        AppointmentDto updated = appointmentService.rejectAppointment(appointmentId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Appointment rejected", updated));
    }

    @PatchMapping("/{appointmentId}/cancel")
    @Operation(summary = "Cancel an appointment (Customer or Doctor)")
    public ResponseEntity<ApiResponse<AppointmentDto>> cancelAppointment(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) StatusUpdateRequest request
    ) {
        AppointmentDto updated = appointmentService.cancelAppointment(appointmentId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Appointment cancelled", updated));
    }

    @PatchMapping("/{appointmentId}/complete")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Complete an appointment after consultation (Doctor)")
    public ResponseEntity<ApiResponse<AppointmentDto>> completeAppointment(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) StatusUpdateRequest request
    ) {
        AppointmentDto updated = appointmentService.completeAppointment(appointmentId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Appointment completed", updated));
    }

    @PatchMapping("/{appointmentId}/reschedule/approve")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Approve the owner's reschedule request: the appointment moves to the new time (Doctor)")
    public ResponseEntity<ApiResponse<AppointmentDto>> approveReschedule(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(ApiResponse.ok("Reschedule approved", appointmentService.approveReschedule(appointmentId, userPrincipal.getId())));
    }

    @PatchMapping("/{appointmentId}/reschedule/reject")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Decline the owner's reschedule request with a reason; the appointment keeps its time (Doctor)")
    public ResponseEntity<ApiResponse<AppointmentDto>> rejectReschedule(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) StatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok("Reschedule declined", appointmentService.rejectReschedule(appointmentId, userPrincipal.getId(), request)));
    }

    @PatchMapping("/{appointmentId}/reschedule/withdraw")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Take back a reschedule request that the doctor has not answered (Customer)")
    public ResponseEntity<ApiResponse<AppointmentDto>> withdrawReschedule(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(ApiResponse.ok("Reschedule request withdrawn", appointmentService.withdrawReschedule(appointmentId, userPrincipal.getId())));
    }

    @PatchMapping("/{appointmentId}/reschedule")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Ask to move an appointment to a new date and time; the doctor must approve (Customer)")
    public ResponseEntity<ApiResponse<AppointmentDto>> rescheduleAppointment(
            @PathVariable Long appointmentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody RescheduleRequest request
    ) {
        AppointmentDto updated = appointmentService.rescheduleAppointment(appointmentId, userPrincipal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Reschedule request sent to the doctor", updated));
    }
}
