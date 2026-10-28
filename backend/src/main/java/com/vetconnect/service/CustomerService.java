package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.dto.customer.CustomerProfileDto;
import com.vetconnect.dto.customer.UpdateCustomerProfileRequest;
import com.vetconnect.repository.CustomerProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerProfileRepository customerProfileRepository;

    @Transactional(readOnly = true)
    public CustomerProfileDto getProfileByUserId(Long userId) {
        CustomerProfile profile = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer profile not found for user ID: " + userId));
        return toDto(profile);
    }

    @Transactional
    public CustomerProfileDto updateProfile(Long userId, UpdateCustomerProfileRequest request) {
        CustomerProfile profile = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer profile not found for user ID: " + userId));

        profile.setFullName(request.getFullName());
        if (request.getPhone() != null) {
            profile.getUser().setPhone(request.getPhone());
        }
        if (request.getAddress() != null) profile.setAddress(request.getAddress());
        if ((request.getLatitude() == null) != (request.getLongitude() == null)) {
            throw new BadRequestException("Latitude and longitude must be provided together.");
        }
        boolean cityChanged = !same(request.getCity(), profile.getCity())
                || (request.getState() != null && !same(request.getState(), profile.getState()))
                || (request.getCountry() != null && !same(request.getCountry(), profile.getCountry()));
        profile.setCity(request.getCity().trim());
        if (request.getState() != null) profile.setState(request.getState().isBlank() ? null : request.getState().trim());
        if (request.getCountry() != null) profile.setCountry(request.getCountry().isBlank() ? null : request.getCountry().trim());
        profile.setPostalCode(request.getPostalCode() != null && !request.getPostalCode().isBlank() ? request.getPostalCode().trim() : null);
        if (request.getLatitude() != null) {
            profile.setLatitude(request.getLatitude());
            profile.setLongitude(request.getLongitude());
        } else if (cityChanged) {
            // The old GPS position no longer describes the new city.
            profile.setLatitude(null);
            profile.setLongitude(null);
        }
        if (request.getEmergencyContact() != null) profile.setEmergencyContact(request.getEmergencyContact());
        if (request.getAvatarUrl() != null) profile.setAvatarUrl(request.getAvatarUrl());

        profile = customerProfileRepository.save(profile);
        log.info("Customer profile updated: userId={} profileId={}", userId, profile.getId());
        return toDto(profile);
    }

    private static boolean same(String a, String b) {
        return (a == null ? "" : a.trim()).equalsIgnoreCase(b == null ? "" : b.trim());
    }

    public CustomerProfileDto toDto(CustomerProfile p) {
        return CustomerProfileDto.builder()
                .id(p.getId())
                .userId(p.getUser().getId())
                .email(p.getUser().getEmail())
                .phone(p.getUser().getPhone())
                .fullName(p.getFullName())
                .address(p.getAddress())
                .city(p.getCity())
                .postalCode(p.getPostalCode())
                .state(p.getState())
                .country(p.getCountry())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .emergencyContact(p.getEmergencyContact())
                .avatarUrl(p.getAvatarUrl())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
