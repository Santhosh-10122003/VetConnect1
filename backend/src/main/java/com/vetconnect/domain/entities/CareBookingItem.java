package com.vetconnect.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/** A service (or add-on) on a booking, with the price that applied when it was booked. */
@Entity
@Table(name = "care_booking_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CareBookingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private CareBooking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private CareService service;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "is_main", nullable = false)
    @Builder.Default
    private Boolean isMain = false;
}
