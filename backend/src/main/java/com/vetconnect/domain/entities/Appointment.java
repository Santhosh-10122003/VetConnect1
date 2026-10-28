package com.vetconnect.domain.entities;

import com.vetconnect.domain.enums.AppointmentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "appointments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_reference", nullable = false, unique = true, length = 50)
    private String bookingReference;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private CustomerProfile customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private DoctorProfile doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pet_id", nullable = false)
    private Pet pet;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AppointmentStatus status = AppointmentStatus.PENDING;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private java.math.BigDecimal totalAmount = java.math.BigDecimal.ZERO;

    @Column(name = "advance_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private java.math.BigDecimal advanceAmount = java.math.BigDecimal.ZERO;

    @Column(name = "balance_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private java.math.BigDecimal balanceAmount = java.math.BigDecimal.ZERO;

    @Column(length = 3)
    private String currency;

    /** While AWAITING_PAYMENT: when the held slot is released. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    /** A reschedule the customer asked for and the doctor has not answered yet (all null when there is none). */
    @Column(name = "reschedule_date")
    private LocalDate rescheduleDate;

    @Column(name = "reschedule_start_time")
    private LocalTime rescheduleStartTime;

    @Column(name = "reschedule_end_time")
    private LocalTime rescheduleEndTime;

    @Column(name = "reschedule_note", columnDefinition = "TEXT")
    private String rescheduleNote;

    @Column(name = "reschedule_requested_at")
    private Instant rescheduleRequestedAt;

    public boolean hasRescheduleRequest() {
        return rescheduleDate != null;
    }

    public void clearRescheduleRequest() {
        rescheduleDate = null;
        rescheduleStartTime = null;
        rescheduleEndTime = null;
        rescheduleNote = null;
        rescheduleRequestedAt = null;
    }

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
