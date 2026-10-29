package com.vetconnect.dto.doctor;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDoctorProfileRequest {
    @NotBlank(message = "Full name is required")
    private String fullName;
    private String phone;
    @NotBlank(message = "Clinic name is required")
    private String clinicName;
    @NotBlank(message = "Clinic address is required")
    private String clinicAddress;

    @NotBlank(message = "Clinic city is required")
    private String clinicCity;
    private String clinicPostalCode;
    private String clinicState;
    private String clinicCountry;
    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
    private Double latitude;
    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
    private Double longitude;
    @NotNull(message = "Years of experience is required")
    private Integer yearsOfExperience;
    @NotNull(message = "Consultation fee is required")
    private BigDecimal consultationFee;
    private String bio;
    private String avatarUrl;
    // Where the doctor gets paid: required unless complete details are already saved
    private com.vetconnect.domain.enums.PayoutMethod payoutMethod;
    private String upiId;
    private String accountHolderName;
    private String bankAccountNumber;
    private String ifscCode;
    private String bankName;
    private Set<Long> specializationIds;
    private List<DoctorAvailabilityDto> availabilities;
}
