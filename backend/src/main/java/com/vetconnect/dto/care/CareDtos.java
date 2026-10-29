package com.vetconnect.dto.care;

import com.vetconnect.domain.enums.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/** Request and response shapes for the pet-care (grooming / boarding / training) feature. */
public final class CareDtos {

    private CareDtos() {
    }

    // ------------------------------------------------------------------ catalogue

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CareServiceDto {
        private Long id;
        private Long providerId;
        private CareCategory category;
        private String name;
        private String description;
        private PricingUnit pricingUnit;
        private Integer durationMinutes;
        private BigDecimal priceSmall;
        private BigDecimal priceMedium;
        private BigDecimal priceLarge;
        private BigDecimal priceGiant;
        private Boolean isAddon;
        private Boolean isActive;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HoursDto {
        @NotNull(message = "Day of week is required")
        @Min(value = 1, message = "Day of week must be 1 (Monday) to 7 (Sunday)")
        @Max(value = 7, message = "Day of week must be 1 (Monday) to 7 (Sunday)")
        private Integer dayOfWeek;
        @NotNull(message = "Opening time is required")
        private LocalTime openTime;
        @NotNull(message = "Closing time is required")
        private LocalTime closeTime;
        private Boolean isOpen;
    }

    /** A provider as customers see it; the owner and admins also get the review fields and operating settings. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProviderDto {
        private Long id;
        private Long userId;
        private String businessName;
        private String description;
        private String phone;
        private String email;
        private String registrationNumber;
        private String address;
        private String city;
        private String state;
        private String country;
        private String postalCode;
        private Double latitude;
        private Double longitude;
        private Double distanceKm;
        private Set<CareCategory> categories;
        private BigDecimal ratingAvg;
        private Integer reviewCount;
        private Integer advancePercent;
        private Integer boardingCapacity;
        private Integer concurrentCapacity;
        private Integer slotMinutes;
        private String avatarUrl;
        /** The cheapest main service, to show "from" prices in lists. */
        private BigDecimal fromPrice;
        private List<CareServiceDto> services;
        private List<HoursDto> hours;
        private VerificationStatus verificationStatus;
        // owner / admin only
        private String verificationReason;
        private Instant reviewedAt;
        private Instant resubmittedAt;
        private String resubmitNote;
        private String ownerName;
        // owner / admin only: where the business is paid (the account number is masked)
        private com.vetconnect.domain.enums.PayoutMethod payoutMethod;
        private String upiId;
        private String accountHolderName;
        private String bankAccountMasked;
        private String ifscCode;
        private String bankName;
        private Boolean payoutComplete;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProviderRequest {
        @NotBlank(message = "Business name is required")
        @Size(max = 150, message = "Business name is too long")
        private String businessName;
        @Size(max = 2000, message = "Description is too long")
        private String description;
        private String phone;
        private String registrationNumber;
        @NotBlank(message = "Address is required")
        private String address;
        @NotBlank(message = "City is required")
        private String city;
        private String state;
        private String country;
        private String postalCode;
        @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
        @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
        private Double latitude;
        @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
        @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
        private Double longitude;
        @NotEmpty(message = "Choose at least one service type (grooming, boarding or training)")
        private Set<CareCategory> categories;
        @Min(value = 10, message = "Advance must be between 10% and 100%")
        @Max(value = 100, message = "Advance must be between 10% and 100%")
        private Integer advancePercent;
        @Min(value = 1, message = "Capacity must be at least 1")
        @Max(value = 50, message = "Capacity is too large")
        private Integer concurrentCapacity;
        @Min(value = 0, message = "Boarding capacity cannot be negative")
        @Max(value = 500, message = "Boarding capacity is too large")
        private Integer boardingCapacity;
        @Min(value = 15, message = "Slots must be at least 15 minutes")
        @Max(value = 240, message = "Slots must be at most 240 minutes")
        private Integer slotMinutes;
        private String avatarUrl;
        // Where the business gets paid: required when creating a profile; when updating, leave them all empty to keep what is saved
        private com.vetconnect.domain.enums.PayoutMethod payoutMethod;
        @Size(max = 100, message = "UPI id is too long")
        private String upiId;
        @Size(max = 100, message = "Account holder name is too long")
        private String accountHolderName;
        @Size(max = 30, message = "Account number is too long")
        private String bankAccountNumber;
        @Size(max = 15, message = "IFSC code is too long")
        private String ifscCode;
        @Size(max = 100, message = "Bank name is too long")
        private String bankName;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ServiceRequest {
        @NotNull(message = "Category is required")
        private CareCategory category;
        @NotBlank(message = "Name is required")
        @Size(max = 150, message = "Name is too long")
        private String name;
        @Size(max = 1000, message = "Description is too long")
        private String description;
        /** Optional: boarding defaults to per night, everything else to per session. */
        private PricingUnit pricingUnit;
        @Min(value = 5, message = "Duration must be at least 5 minutes")
        @Max(value = 720, message = "Duration is too long")
        private Integer durationMinutes;
        @NotNull(message = "Price for small pets is required")
        @DecimalMin(value = "0.00", message = "Price cannot be negative")
        @Digits(integer = 8, fraction = 2, message = "Price has too many digits")
        private BigDecimal priceSmall;
        @NotNull(message = "Price for medium pets is required")
        @DecimalMin(value = "0.00", message = "Price cannot be negative")
        @Digits(integer = 8, fraction = 2, message = "Price has too many digits")
        private BigDecimal priceMedium;
        @NotNull(message = "Price for large pets is required")
        @DecimalMin(value = "0.00", message = "Price cannot be negative")
        @Digits(integer = 8, fraction = 2, message = "Price has too many digits")
        private BigDecimal priceLarge;
        @NotNull(message = "Price for giant pets is required")
        @DecimalMin(value = "0.00", message = "Price cannot be negative")
        @Digits(integer = 8, fraction = 2, message = "Price has too many digits")
        private BigDecimal priceGiant;
        private Boolean isAddon;
        private Boolean isActive;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HoursRequest {
        @NotEmpty(message = "Opening hours are required")
        @Valid
        private List<HoursDto> hours;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BoardingNightDto {
        private LocalDate date;
        private int remaining;
        private boolean available;
    }

    // ------------------------------------------------------------------ bookings

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateBookingRequest {
        @NotNull(message = "Provider is required")
        private Long providerId;
        @NotNull(message = "Service is required")
        private Long serviceId;
        private List<Long> addonIds;
        @NotNull(message = "Pet is required")
        private Long petId;
        /** Optional: taken from the pet's weight when omitted. */
        private PetSize petSize;
        @NotNull(message = "Date is required")
        private LocalDate date;
        /** Grooming and training only. */
        private LocalTime startTime;
        /** Boarding only. */
        private LocalDate checkOutDate;
        @Size(max = 1000, message = "Notes are too long")
        private String notes;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BookingItemDto {
        private String name;
        private BigDecimal price;
        private boolean main;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PaymentDto {
        private Long id;
        private Long bookingId;
        /** Set instead of bookingId for the advance of a vet appointment. */
        private Long appointmentId;
        /** Public key for opening the provider's checkout (Razorpay); null for the simulated gateway. */
        private String keyId;
        private BigDecimal amount;
        private String currency;
        private PaymentStatus status;
        private String gateway;
        private String gatewayOrderId;
        private BigDecimal refundedAmount;
        private String failureReason;
        /** True for the simulated gateway: no real money moves. */
        private boolean testMode;
        private Instant paidAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BookingDto {
        private Long id;
        private String reference;
        private CareBookingStatus status;
        private CareCategory category;
        private Long providerId;
        private String providerName;
        private String providerPhone;
        private String providerAddress;
        private String providerCity;
        private Double providerLatitude;
        private Double providerLongitude;
        private Long customerId;
        private String customerName;
        private String customerPhone;
        private Long petId;
        private String petName;
        private String petSpecies;
        private String petBreed;
        private String petAllergies;
        private PetSize petSize;
        private LocalDate date;
        private LocalTime startTime;
        private LocalTime endTime;
        private LocalDate checkOutDate;
        private Integer nights;
        private String notes;
        private List<BookingItemDto> items;
        private BigDecimal totalAmount;
        private BigDecimal advanceAmount;
        private BigDecimal balanceAmount;
        private String currency;
        /** When an unpaid booking stops holding its slot. */
        private Instant expiresAt;
        private String cancellationReason;
        private String cancelledBy;
        private PaymentDto payment;
        private boolean canReview;
        private boolean reviewed;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReasonRequest {
        @Size(max = 1000, message = "Reason is too long")
        private String reason;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SimulatePaymentRequest {
        @NotNull(message = "Outcome is required (SUCCESS or FAILURE)")
        private Outcome outcome;

        public enum Outcome { SUCCESS, FAILURE }
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CancellationPreviewDto {
        private boolean refundable;
        private BigDecimal refundAmount;
        private BigDecimal paidAmount;
        private String currency;
        private int windowHours;
        private String message;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReviewRequest {
        @NotNull(message = "Rating is required")
        @Min(value = 1, message = "Rating must be between 1 and 5")
        @Max(value = 5, message = "Rating must be between 1 and 5")
        private Integer rating;
        @Size(max = 1000, message = "Comment is too long")
        private String comment;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReviewDto {
        private Long id;
        private Long bookingId;
        private String customerName;
        private Integer rating;
        private String comment;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ConfigDto {
        private String currency;
        private String currencySymbol;
        private int holdMinutes;
        private int cancellationWindowHours;
        private int maxBoardingNights;
        private boolean paymentsTestMode;
        /** "simulated" or "razorpay". */
        private String paymentGateway;
        private int clinicAdvancePercent;
    }

    /** What the Razorpay checkout hands back after a successful payment. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CheckoutResultRequest {
        @NotBlank(message = "Order id is required")
        private String razorpayOrderId;
        @NotBlank(message = "Payment id is required")
        private String razorpayPaymentId;
        @NotBlank(message = "Signature is required")
        private String razorpaySignature;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PaymentFailedRequest {
        @Size(max = 255, message = "Reason is too long")
        private String reason;
    }
}
