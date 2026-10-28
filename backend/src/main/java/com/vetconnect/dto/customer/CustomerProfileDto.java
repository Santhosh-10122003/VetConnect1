package com.vetconnect.dto.customer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerProfileDto {
    private Long id;
    private Long userId;
    private String email;
    private String phone;
    private String fullName;
    private String address;
    private String city;
    private String postalCode;
    private String state;
    private String country;
    private Double latitude;
    private Double longitude;
    private String emergencyContact;
    private String avatarUrl;
    private Instant createdAt;
}
