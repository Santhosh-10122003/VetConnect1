package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.service.CareBookingService;
import com.vetconnect.service.ProviderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The pet-care business side: its profile, menu, opening hours and the bookings it receives. */
@RestController
@RequestMapping("/api/provider")
@PreAuthorize("hasAnyRole('PROVIDER', 'DOCTOR')")
@RequiredArgsConstructor
@Tag(name = "Pet-care provider", description = "Business profile, services, hours and booking requests")
public class ProviderController {

    private final ProviderService providerService;
    private final CareBookingService bookingService;

    // ------------------------------------------------------------------ profile

    @GetMapping("/profile/me")
    @Operation(summary = "My pet-care profile (404 until a doctor sets one up)")
    public ResponseEntity<ApiResponse<ProviderDto>> me(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.getMine(user.getId())));
    }

    @PostMapping("/profile")
    @Operation(summary = "Set up a pet-care profile (for veterinarians who also offer grooming, boarding or training)")
    public ResponseEntity<ApiResponse<ProviderDto>> create(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody ProviderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Pet-care profile created. An admin will review it.", providerService.createProfile(user.getId(), request)));
    }

    @PutMapping("/profile")
    @Operation(summary = "Update my pet-care profile")
    public ResponseEntity<ApiResponse<ProviderDto>> update(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody ProviderRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Profile updated", providerService.updateMine(user.getId(), request)));
    }

    @PutMapping("/hours")
    @Operation(summary = "Replace my weekly opening hours")
    public ResponseEntity<ApiResponse<ProviderDto>> hours(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody HoursRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Opening hours updated", providerService.updateHours(user.getId(), request)));
    }

    @PostMapping("/profile/resubmit")
    @Operation(summary = "Ask the admins to review a rejected profile again")
    public ResponseEntity<ApiResponse<ProviderDto>> resubmit(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody(required = false) ResubmitRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Your profile has been sent for another review", providerService.resubmit(user.getId(), request)));
    }

    // ------------------------------------------------------------------ menu

    @GetMapping("/services")
    @Operation(summary = "My menu (including switched-off entries)")
    public ResponseEntity<ApiResponse<List<CareServiceDto>>> services(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.myServices(user.getId())));
    }

    @PostMapping("/services")
    @Operation(summary = "Add a service or an add-on")
    public ResponseEntity<ApiResponse<CareServiceDto>> addService(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Service added", providerService.addService(user.getId(), request)));
    }

    @PutMapping("/services/{serviceId}")
    @Operation(summary = "Change a service")
    public ResponseEntity<ApiResponse<CareServiceDto>> updateService(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long serviceId, @Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Service updated", providerService.updateService(user.getId(), serviceId, request)));
    }

    @DeleteMapping("/services/{serviceId}")
    @Operation(summary = "Remove a service from the menu (existing bookings keep their copy)")
    public ResponseEntity<ApiResponse<Void>> removeService(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long serviceId) {
        providerService.removeService(user.getId(), serviceId);
        return ResponseEntity.ok(ApiResponse.ok("Service removed", null));
    }

    // ------------------------------------------------------------------ bookings

    @GetMapping("/bookings")
    @Operation(summary = "Bookings I received: REQUESTED, CONFIRMED, COMPLETED or CANCELLED")
    public ResponseEntity<ApiResponse<PageResponse<BookingDto>>> bookings(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "REQUESTED") String group,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.providerBookings(user.getId(), group, PageRequest.of(page, size))));
    }

    @PostMapping("/bookings/{bookingId}/accept")
    @Operation(summary = "Accept a new request")
    public ResponseEntity<ApiResponse<BookingDto>> accept(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok("Booking confirmed", bookingService.accept(user.getId(), bookingId)));
    }

    @PostMapping("/bookings/{bookingId}/reject")
    @Operation(summary = "Reject a new request (the advance is refunded in full)")
    public ResponseEntity<ApiResponse<BookingDto>> reject(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Booking rejected", bookingService.reject(user.getId(), bookingId, request.getReason())));
    }

    @PostMapping("/bookings/{bookingId}/cancel")
    @Operation(summary = "Cancel a confirmed booking (the advance is refunded in full)")
    public ResponseEntity<ApiResponse<BookingDto>> cancel(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Booking cancelled", bookingService.cancelByProvider(user.getId(), bookingId, request.getReason())));
    }

    @PostMapping("/bookings/{bookingId}/complete")
    @Operation(summary = "Mark a confirmed booking as done")
    public ResponseEntity<ApiResponse<BookingDto>> complete(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok("Booking completed", bookingService.complete(user.getId(), bookingId)));
    }
}
