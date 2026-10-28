package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.review.CreateReviewRequest;
import com.vetconnect.dto.review.ReviewDto;
import com.vetconnect.service.ReviewService;
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
@RequestMapping("/api/doctors/{doctorId}/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "Endpoints for doctor reviews and feedback")
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping
    @Operation(summary = "Get reviews for a veterinary doctor")
    public ResponseEntity<ApiResponse<PageResponse<ReviewDto>>> getDoctorReviews(
            @PathVariable Long doctorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        PageResponse<ReviewDto> reviews = reviewService.getDoctorReviews(doctorId, pageable);
        return ResponseEntity.ok(ApiResponse.ok(reviews));
    }

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Submit a review and rating for a doctor (Customer)")
    public ResponseEntity<ApiResponse<ReviewDto>> createReview(
            @PathVariable Long doctorId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateReviewRequest request
    ) {
        ReviewDto review = reviewService.createReview(doctorId, userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Review submitted successfully", review));
    }
}
