package com.vetconnect.service;

import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.PetSpecies;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.dto.pet.CreatePetRequest;
import com.vetconnect.dto.pet.PetDto;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.repository.AppointmentRepository;
import com.vetconnect.repository.CareBookingRepository;
import com.vetconnect.repository.CustomerProfileRepository;
import com.vetconnect.repository.PetRepository;
import com.vetconnect.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PetServiceTest {

    @Mock private PetRepository petRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private UserRepository userRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CareBookingRepository careBookingRepository;

    @InjectMocks private PetService petService;

    private CustomerProfile owner;
    private CustomerProfile stranger;
    private Pet pet;

    @BeforeEach
    void setUp() {
        owner = CustomerProfile.builder().id(1L).fullName("Owner").build();
        stranger = CustomerProfile.builder().id(2L).fullName("Stranger").build();
        pet = Pet.builder().id(10L).customer(owner).name("Bruno").species(PetSpecies.DOG).build();
    }

    @Test
    void createPet_savesPetForTheCallingCustomer() {
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(owner));
        when(petRepository.save(any(Pet.class))).thenAnswer(inv -> {
            Pet p = inv.getArgument(0);
            p.setId(11L);
            return p;
        });

        CreatePetRequest req = CreatePetRequest.builder().name("  Misty ").species(PetSpecies.CAT).build();
        PetDto dto = petService.createPet(100L, req);

        assertEquals(11L, dto.getId());
        assertEquals("Misty", dto.getName());
        assertEquals(owner.getId(), dto.getCustomerId());
    }

    @Test
    void getCustomerPets_returnsOnlyOwnersPets() {
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(owner));
        when(petRepository.findByCustomerId(1L)).thenReturn(List.of(pet));

        List<PetDto> pets = petService.getCustomerPets(100L);

        assertEquals(1, pets.size());
        assertEquals("Bruno", pets.get(0).getName());
    }

    @Test
    void getPetById_rejectsAnotherCustomer() {
        User user = User.builder().id(200L).role(Role.ROLE_CUSTOMER).build();
        when(userRepository.findById(200L)).thenReturn(Optional.of(user));
        when(petRepository.findById(10L)).thenReturn(Optional.of(pet));
        when(customerProfileRepository.findByUserId(200L)).thenReturn(Optional.of(stranger));

        assertThrows(UnauthorizedException.class, () -> petService.getPetById(10L, 200L));
    }

    @Test
    void updatePet_notOwnedByCaller_isNotFound() {
        when(customerProfileRepository.findByUserId(200L)).thenReturn(Optional.of(stranger));
        when(petRepository.findByIdAndCustomerId(10L, 2L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> petService.updatePet(10L, 200L, com.vetconnect.dto.pet.UpdatePetRequest.builder()
                        .name("Hacked").species(PetSpecies.DOG).build()));
        verify(petRepository, never()).save(any());
    }

    @Test
    void deletePet_notOwnedByCaller_neverDeletes() {
        when(customerProfileRepository.findByUserId(200L)).thenReturn(Optional.of(stranger));
        when(petRepository.findByIdAndCustomerId(10L, 2L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> petService.deletePet(10L, 200L));
        verify(petRepository, never()).delete(any());
    }

    @Test
    void deletePet_owner_deletes() {
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(owner));
        when(petRepository.findByIdAndCustomerId(10L, 1L)).thenReturn(Optional.of(pet));

        petService.deletePet(10L, 100L);

        verify(petRepository).delete(pet);
    }

    @Test
    void deletePet_withAppointmentHistory_isRejected() {
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(owner));
        when(petRepository.findByIdAndCustomerId(10L, 1L)).thenReturn(Optional.of(pet));
        when(appointmentRepository.existsByPetId(10L)).thenReturn(true);

        assertThrows(BadRequestException.class, () -> petService.deletePet(10L, 100L));
        verify(petRepository, never()).delete(any());
    }
}
