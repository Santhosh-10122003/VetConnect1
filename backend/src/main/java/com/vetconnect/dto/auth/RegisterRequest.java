package com.vetconnect.dto.auth;

import com.vetconnect.domain.enums.Role;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 254, message = "Email is too long")
    @Pattern(regexp = "^(?!.*\\.\\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,24}$", message = "Enter a valid email address, like name@example.com")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    /** When supplied it must equal the password (the app always sends it). */
    private String confirmPassword;

    private String phone;

    @NotNull(message = "Role is required (ROLE_CUSTOMER or ROLE_DOCTOR)")
    private Role role;

    @NotBlank(message = "Full name is required")
    private String fullName;

    // Pet-care business fields (role ROLE_PROVIDER); the address / city / pin fields below describe the business
    private String businessName;
    private String description;
    private java.util.Set<com.vetconnect.domain.enums.CareCategory> categories;

    // Doctor specific fields (optional during registration if customer)
    private String licenseNumber;
    private String clinicName;
    private String clinicAddress;
    private String clinicCity;
    private String clinicPostalCode;
    private Integer yearsOfExperience;
    private BigDecimal consultationFee;
    private String bio;
    private Set<Long> specializationIds;

    // Customer specific fields
    private String address;
    private String city;
    private String postalCode;
    private String state;
    private String country;
    private String emergencyContact;

    // Optional GPS position (customer home / doctor clinic)
    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
    private Double latitude;
    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
    private Double longitude;
}
