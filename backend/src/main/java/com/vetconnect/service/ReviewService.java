package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.dto.review.CreateReviewRequest;
import com.vetconnect.dto.review.ReviewDto;
import com.vetconnect.repository.AppointmentRepository;
import com.vetconnect.repository.CustomerProfileRepository;
import com.vetconnect.repository.DoctorProfileRepository;
import com.vetconnect.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final AppointmentRepository appointmentRepository;
    private final NotificationService notificationService;

    @Transactional
    public ReviewDto createReview(Long doctorId, Long userId, CreateReviewRequest request) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Only registered customers can leave reviews"));

        DoctorProfile doctor = doctorProfileRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + doctorId));

        Appointment appointment = null;
        if (request.getAppointmentId() != null) {
            appointment = appointmentRepository.findById(request.getAppointmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

            if (!appointment.getCustomer().getId().equals(customer.getId())) {
                throw new UnauthorizedException("You can only review your own appointments");
            }
            if (!appointment.getDoctor().getId().equals(doctor.getId())) {
                throw new BadRequestException("Appointment does not match the reviewed doctor");
            }
            if (appointment.getStatus() != AppointmentStatus.COMPLETED) {
                throw new BadRequestException("Reviews can only be submitted for completed consultations");
            }
            if (reviewRepository.existsByAppointmentId(appointment.getId())) {
                throw new BadRequestException("A review has already been submitted for this appointment");
            }
        }

        Review review = Review.builder()
                .doctor(doctor)
                .customer(customer)
                .appointment(appointment)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        review = reviewRepository.save(review);

        // Update Doctor's rating statistics
        Double avgRating = reviewRepository.calculateAverageRatingForDoctor(doctorId);
        long totalReviews = reviewRepository.countByDoctorId(doctorId);

        doctor.setRatingAvg(BigDecimal.valueOf(avgRating != null ? avgRating : request.getRating())
                .setScale(2, RoundingMode.HALF_UP));
        doctor.setReviewCount((int) totalReviews);
        doctorProfileRepository.save(doctor);

        notificationService.createNotification(
                doctor.getUser(),
                "New Rating & Review Received",
                customer.getFullName() + " left you a " + request.getRating() + "-star review.",
                NotificationType.NEW_REVIEW,
                review.getId().toString()
        );

        log.info("Review created: reviewId={} doctorId={} customerId={} rating={}", review.getId(), doctorId, customer.getId(), request.getRating());
        return toDto(review);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewDto> getDoctorReviews(Long doctorId, Pageable pageable) {
        Page<Review> page = reviewRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId, pageable);
        return PageResponse.of(page.map(this::toDto));
    }

    public ReviewDto toDto(Review r) {
        return ReviewDto.builder()
                .id(r.getId())
                .doctorId(r.getDoctor().getId())
                .doctorName(r.getDoctor().getFullName())
                .customerId(r.getCustomer().getId())
                .customerName(r.getCustomer().getFullName())
                .appointmentId(r.getAppointment() != null ? r.getAppointment().getId() : null)
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
