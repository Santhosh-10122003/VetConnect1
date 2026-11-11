package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.TooManyRequestsException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.PetSpecies;
import com.vetconnect.dto.pet.PetOwnerLookupDto;
import com.vetconnect.repository.PetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PetLookupServiceTest {

    @Mock private PetRepository petRepository;
    @Mock private NotificationService notificationService;

    private PetLookupService service;
    private User owner;
    private static final String NUMBER = "999123456789012";

    @BeforeEach
    void setUp() {
        service = new PetLookupService(petRepository, notificationService, Clock.fixed(Instant.parse("2026-11-02T10:00:00Z"), ZoneOffset.UTC));
        owner = User.builder().id(7L).phone("+919876543210").build();
        CustomerProfile profile = CustomerProfile.builder().id(3L).user(owner).fullName("Asha Rao").address("12 Lake Road").city("Coimbatore")
                .state("Tamil Nadu").country("India").postalCode("641001").build();
        Pet pet = Pet.builder().id(9L).customer(profile).name("Bruno").species(PetSpecies.DOG).breed("Labrador").microchipNumber(NUMBER).build();
        when(petRepository.findByMicrochipNumber(NUMBER)).thenReturn(Optional.of(pet));
    }

    @Test
    void theOwnersNameMobileAndAddressComeBackAndTheOwnerIsToldAboutIt() {
        PetOwnerLookupDto r = service.find(1L, "999 1234-56789 012");
        assertEquals("Asha Rao", r.getOwnerName());
        assertEquals("+919876543210", r.getOwnerPhone());
        assertEquals("12 Lake Road, Coimbatore, Tamil Nadu, India, 641001", r.getOwnerAddress());
        assertEquals("Bruno", r.getPetName());
        verify(notificationService).createNotification(eq(owner), any(), any(), eq(NotificationType.GENERAL), eq("9"));
    }

    @Test
    void aNumberThatIsNotFifteenDigitsIsRefusedAndNothingIsLookedUp() {
        for (String bad : new String[]{"12345", "99912345678901A", "", null}) {
            assertThrows(BadRequestException.class, () -> service.find(1L, bad));
        }
        verify(petRepository, never()).findByMicrochipNumber(any());
    }

    @Test
    void anUnknownNumberIsNotFound() {
        assertThrows(ResourceNotFoundException.class, () -> service.find(1L, "999000000000000"));
    }

    @Test
    void aPersonCanOnlyTryTenTimesAnHour() {
        for (int i = 0; i < PetLookupService.MAX_PER_HOUR; i++) service.find(1L, NUMBER);
        assertThrows(TooManyRequestsException.class, () -> service.find(1L, NUMBER));
        // someone else is not held back
        assertNotNull(service.find(2L, NUMBER));
    }

    @Test
    void aQrScanNeedsNoAccountButIsLimitedByWhereItComesFrom() {
        PetOwnerLookupDto r = service.scan("203.0.113.9", NUMBER);
        assertEquals("Asha Rao", r.getOwnerName());
        assertEquals("+919876543210", r.getOwnerPhone());
        verify(notificationService).createNotification(eq(owner), any(), any(), eq(NotificationType.GENERAL), eq("9"));
        for (int i = 1; i < PetLookupService.MAX_SCANS_PER_HOUR; i++) service.scan("203.0.113.9", NUMBER);
        assertThrows(TooManyRequestsException.class, () -> service.scan("203.0.113.9", NUMBER));
        assertNotNull(service.scan("198.51.100.4", NUMBER), "another address is not held back");
        assertThrows(BadRequestException.class, () -> service.scan("198.51.100.4", "123"));
    }
}
