package com.vetconnect.domain.entities;

import com.vetconnect.domain.enums.CareCategory;
import com.vetconnect.domain.enums.PetSize;
import com.vetconnect.domain.enums.PricingUnit;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/** One line of a provider's menu: a service, or an add-on that can be booked together with one. */
@Entity
@Table(name = "care_services")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CareService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CareCategory category;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_unit", nullable = false, length = 20)
    @Builder.Default
    private PricingUnit pricingUnit = PricingUnit.PER_SESSION;

    /** How long one session takes (not used for boarding, which is priced per night). */
    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "price_small", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceSmall;

    @Column(name = "price_medium", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceMedium;

    @Column(name = "price_large", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceLarge;

    @Column(name = "price_giant", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceGiant;

    @Column(name = "is_addon", nullable = false)
    @Builder.Default
    private Boolean isAddon = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public BigDecimal priceFor(PetSize size) {
        return switch (size) {
            case SMALL -> priceSmall;
            case MEDIUM -> priceMedium;
            case LARGE -> priceLarge;
            case GIANT -> priceGiant;
        };
    }
}
