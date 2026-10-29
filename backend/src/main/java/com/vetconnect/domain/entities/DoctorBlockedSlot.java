package com.vetconnect.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/** A slot the doctor marked as booked themselves. Only the doctor can undo it; a customer's booking is never one of these. */
@Entity
@Table(name = "doctor_blocked_slots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DoctorBlockedSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private DoctorProfile doctor;

    @Column(name = "slot_date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(length = 255)
    private String reason;

    /** Who the doctor booked it for (a walk-in or phone booking). Optional. */
    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "customer_phone", length = 20)
    private String customerPhone;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
