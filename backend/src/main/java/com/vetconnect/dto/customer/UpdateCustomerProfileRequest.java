package com.vetconnect.dto.customer;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCustomerProfileRequest {
    @NotBlank(message = "Full name is required")
    @jakarta.validation.constraints.Size(max = 60, message = "Name is too long (60 letters at most)")
    @jakarta.validation.constraints.Pattern(regexp = "^[\\p{L}\\p{M}][\\p{L}\\p{M} .'’-]*$", message = "Name can have only letters, spaces and . ' -")
    private String fullName;
    private String phone;
    private String address;
    @NotBlank(message = "City is required")
    private String city;
    private String postalCode;
    private String state;
    private String country;
    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
    private Double latitude;
    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
    private Double longitude;
    private String emergencyContact;
    private String avatarUrl;
}
