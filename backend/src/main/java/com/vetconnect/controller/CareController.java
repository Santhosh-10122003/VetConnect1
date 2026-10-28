package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.domain.enums.CareCategory;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.service.CareBookingService;
import com.vetconnect.service.ProviderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Pet owners: find grooming, boarding and training providers, book them, pay the advance, cancel, review. */
@RestController
@RequestMapping("/api/care")
@RequiredArgsConstructor
@Tag(name = "Pet care", description = "Grooming, boarding and training: discovery, bookings and advance payments")
public class CareController {

    private final ProviderService providerService;
    private final CareBookingService bookingService;

    @GetMapping("/config")
    @Operation(summary = "Currency, payment hold and cancellation rules")
    public ResponseEntity<ApiResponse<ConfigDto>> config() {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.config()));
    }

    // ------------------------------------------------------------------ discovery

    @GetMapping("/providers")
    @Operation(summary = "Providers near the customer (admins see all), optionally by category")
    public ResponseEntity<ApiResponse<PageResponse<ProviderDto>>> providers(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) CareCategory category,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.search(user, category, query, radiusKm, PageRequest.of(page, size))));
    }

    @GetMapping("/providers/{providerId}")
    @Operation(summary = "A provider with its menu and opening hours")
    public ResponseEntity<ApiResponse<ProviderDto>> provider(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long providerId) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.detail(providerId, user)));
    }

    @GetMapping("/providers/{providerId}/slots")
    @Operation(summary = "Time slots for a grooming or training service on a date")
    public ResponseEntity<ApiResponse<List<AvailableSlotDto>>> slots(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long providerId,
            @RequestParam Long serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.slots(providerId, serviceId, date, user)));
    }

    @GetMapping("/providers/{providerId}/boarding-availability")
    @Operation(summary = "Free boarding places for each night in a range")
    public ResponseEntity<ApiResponse<List<BoardingNightDto>>> boarding(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long providerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.boardingAvailability(providerId, from, to, user)));
    }

    @GetMapping("/providers/{providerId}/reviews")
    @Operation(summary = "Reviews of a provider")
    public ResponseEntity<ApiResponse<PageResponse<ReviewDto>>> reviews(
            @PathVariable Long providerId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.reviews(providerId, PageRequest.of(page, size))));
    }

    // ------------------------------------------------------------------ bookings

    @PostMapping("/bookings")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Book a service: holds the slot and opens the advance payment")
    public ResponseEntity<ApiResponse<BookingDto>> create(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody CreateBookingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Slot held. Pay the advance to send your request.", bookingService.create(user.getId(), request)));
    }

    @GetMapping("/bookings/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "My pet-care bookings (UPCOMING, COMPLETED or CANCELLED)")
    public ResponseEntity<ApiResponse<PageResponse<BookingDto>>> mine(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "UPCOMING") String tab,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.myBookings(user.getId(), tab, PageRequest.of(page, size))));
    }

    @GetMapping("/bookings/{bookingId}")
    @Operation(summary = "One booking (the customer, the provider or an admin)")
    public ResponseEntity<ApiResponse<BookingDto>> get(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.get(user, bookingId)));
    }

    @PostMapping("/bookings/{bookingId}/payment/simulate")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Test mode only: settle the advance as paid or failed")
    public ResponseEntity<ApiResponse<BookingDto>> simulate(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody SimulatePaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.settleTestPayment(user.getId(), bookingId, request.getOutcome())));
    }

    @PostMapping("/bookings/{bookingId}/payment/confirm")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "The checkout reports a successful payment; the signature is verified before the booking is requested")
    public ResponseEntity<ApiResponse<BookingDto>> confirmPayment(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody CheckoutResultRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.confirmCheckout(user.getId(), bookingId, request)));
    }

    @PostMapping("/bookings/{bookingId}/payment/failed")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "The checkout reports a declined payment; the slot stays held")
    public ResponseEntity<ApiResponse<BookingDto>> paymentFailed(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody PaymentFailedRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.paymentFailed(user.getId(), bookingId, request.getReason())));
    }

    @PostMapping("/bookings/{bookingId}/payment/retry")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Open a new payment after a failed one, while the slot is still held")
    public ResponseEntity<ApiResponse<BookingDto>> retry(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.retryPayment(user.getId(), bookingId)));
    }

    @GetMapping("/bookings/{bookingId}/cancellation-preview")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "What a cancellation would refund")
    public ResponseEntity<ApiResponse<CancellationPreviewDto>> preview(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(bookingService.cancellationPreview(user.getId(), bookingId)));
    }

    @PostMapping("/bookings/{bookingId}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Cancel a booking; the advance is refunded when cancelled early enough")
    public ResponseEntity<ApiResponse<BookingDto>> cancel(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody(required = false) ReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Booking cancelled", bookingService.cancelByCustomer(user.getId(), bookingId, request == null ? null : request.getReason())));
    }

    @PostMapping("/bookings/{bookingId}/review")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Review a completed booking")
    public ResponseEntity<ApiResponse<ReviewDto>> review(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long bookingId, @Valid @RequestBody ReviewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Review submitted", bookingService.review(user.getId(), bookingId, request)));
    }
}
