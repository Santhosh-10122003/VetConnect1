package com.vetconnect.domain.entities;

import com.vetconnect.domain.enums.CareCategory;
import com.vetconnect.domain.enums.VerificationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** A pet-care business (groomer, boarding or training centre). A vet clinic can have one too. */
@Entity
@Table(name = "provider_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProviderProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "business_name", nullable = false, length = 150)
    private String businessName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 30)
    private String phone;

    @Column(name = "registration_number", length = 100)
    private String registrationNumber;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(length = 100)
    private String country;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    private Double latitude;

    private Double longitude;

    /** Pets handled at the same time for grooming and training. */
    @Column(name = "concurrent_capacity", nullable = false)
    @Builder.Default
    private Integer concurrentCapacity = 1;

    /** Pets that can stay overnight. */
    @Column(name = "boarding_capacity", nullable = false)
    @Builder.Default
    private Integer boardingCapacity = 0;

    @Column(name = "slot_minutes", nullable = false)
    @Builder.Default
    private Integer slotMinutes = 30;

    /** Share of the price paid up front to book (10 to 100). */
    @Column(name = "advance_percent", nullable = false)
    @Builder.Default
    private Integer advancePercent = 30;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 30)
    @Builder.Default
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @Column(name = "verification_reason", columnDefinition = "TEXT")
    private String verificationReason;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "resubmitted_at")
    private Instant resubmittedAt;

    @Column(name = "resubmit_note", columnDefinition = "TEXT")
    private String resubmitNote;

    @Column(name = "rating_avg", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    @Builder.Default
    private Integer reviewCount = 0;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "provider_categories", joinColumns = @JoinColumn(name = "provider_id"))
    @Column(name = "category", length = 30)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<CareCategory> categories = new LinkedHashSet<>();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProviderHours> hours = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
