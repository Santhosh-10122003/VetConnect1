package com.vetconnect.dto.doctor;

import com.vetconnect.domain.enums.VerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DoctorProfileDto {
    private Long id;
    private Long userId;
    private String email;
    private String phone;
    private String fullName;
    private String licenseNumber;
    private String clinicName;
    private String clinicAddress;
    private String clinicCity;
    private String clinicPostalCode;
    private String clinicState;
    private String clinicCountry;
    private Double latitude;
    private Double longitude;
    /** Straight-line distance from the requesting customer; null when it cannot be computed. */
    private Double distanceKm;
    private Integer yearsOfExperience;
    private BigDecimal consultationFee;
    private String bio;
    private BigDecimal ratingAvg;
    private Integer reviewCount;
    private VerificationStatus verificationStatus;
    // Only filled for the doctor themself and for admins, never for customers.
    private String verificationReason;
    private Instant reviewedAt;
    private Instant resubmittedAt;
    private String resubmitNote;
    private String avatarUrl;
    // Only filled for the doctor themself and for admins: where the doctor is paid (the account number is masked)
    private com.vetconnect.domain.enums.PayoutMethod payoutMethod;
    private String upiId;
    private String accountHolderName;
    private String bankAccountMasked;
    private String ifscCode;
    private String bankName;
    private Boolean payoutComplete;
    private List<SpecializationDto> specializations;
    private List<DoctorAvailabilityDto> availabilities;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpecializationDto {
        private Long id;
        private String name;
        private String description;
        private String iconName;
    }
}
