package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.dto.pet.CreatePetRequest;
import com.vetconnect.dto.pet.PetDto;
import com.vetconnect.dto.pet.UpdatePetRequest;
import com.vetconnect.repository.AppointmentRepository;
import com.vetconnect.repository.CareBookingRepository;
import com.vetconnect.repository.CustomerProfileRepository;
import com.vetconnect.repository.PetRepository;
import com.vetconnect.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PetService {

    private final PetRepository petRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final CareBookingRepository careBookingRepository;

    @Transactional(readOnly = true)
    public List<PetDto> getCustomerPets(Long userId) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer profile not found for user: " + userId));

        return petRepository.findByCustomerId(customer.getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PetDto getPetById(Long petId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found with ID: " + petId));

        // Ownership / Doctor access check
        if (user.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                    .orElseThrow(() -> new UnauthorizedException("Customer profile not found"));
            if (!pet.getCustomer().getId().equals(customer.getId())) {
                throw new UnauthorizedException("You are not authorized to view this pet");
            }
        }

        return toDto(pet);
    }

    @Transactional
    public PetDto createPet(Long userId, CreatePetRequest request) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> {
                    log.warn("Pet creation rejected: userId={} has no customer profile", userId);
                    return new BadRequestException("Only registered pet owners can add pets");
                });

        Pet pet = Pet.builder()
                .customer(customer)
                .name(request.getName().trim())
                .species(request.getSpecies())
                .breed(request.getBreed())
                .dateOfBirth(request.getDateOfBirth())
                .gender(request.getGender())
                .weight(request.getWeight())
                .allergies(request.getAllergies())
                .existingConditions(request.getExistingConditions())
                .microchipNumber(request.getMicrochipNumber())
                .avatarUrl(request.getAvatarUrl())
                .build();

        pet = petRepository.save(pet);
        log.info("Pet created: petId={} customerId={} species={}", pet.getId(), customer.getId(), pet.getSpecies());
        return toDto(pet);
    }

    @Transactional
    public PetDto updatePet(Long petId, Long userId, UpdatePetRequest request) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        Pet pet = petRepository.findByIdAndCustomerId(petId, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found or not owned by you: " + petId));

        pet.setName(request.getName().trim());
        pet.setSpecies(request.getSpecies());
        pet.setBreed(request.getBreed());
        pet.setDateOfBirth(request.getDateOfBirth());
        pet.setGender(request.getGender());
        pet.setWeight(request.getWeight());
        pet.setAllergies(request.getAllergies());
        pet.setExistingConditions(request.getExistingConditions());
        pet.setMicrochipNumber(request.getMicrochipNumber());
        if (request.getAvatarUrl() != null) pet.setAvatarUrl(request.getAvatarUrl());

        pet = petRepository.save(pet);
        log.info("Pet updated: petId={} customerId={}", pet.getId(), customer.getId());
        return toDto(pet);
    }

    @Transactional
    public void deletePet(Long petId, Long userId) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        Pet pet = petRepository.findByIdAndCustomerId(petId, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found or not owned by you: " + petId));

        if (appointmentRepository.existsByPetId(petId) || careBookingRepository.existsByPetId(petId)) {
            log.warn("Pet delete rejected: petId={} has booking history", petId);
            throw new BadRequestException("This pet has appointment or pet-care booking history and cannot be deleted.");
        }
        petRepository.delete(pet);
        log.info("Pet deleted: petId={} customerId={}", petId, customer.getId());
    }

    public PetDto toDto(Pet p) {
        return PetDto.builder()
                .id(p.getId())
                .customerId(p.getCustomer().getId())
                .customerName(p.getCustomer().getFullName())
                .name(p.getName())
                .species(p.getSpecies())
                .breed(p.getBreed())
                .dateOfBirth(p.getDateOfBirth())
                .gender(p.getGender())
                .weight(p.getWeight())
                .allergies(p.getAllergies())
                .existingConditions(p.getExistingConditions())
                .microchipNumber(p.getMicrochipNumber())
                .avatarUrl(p.getAvatarUrl())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
