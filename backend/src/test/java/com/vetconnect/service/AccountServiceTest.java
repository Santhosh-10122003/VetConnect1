package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.domain.enums.WalletTxnType;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccountServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private ProviderProfileRepository providerProfileRepository;
    @Mock private DoctorAvailabilityRepository availabilityRepository;
    @Mock private CareServiceRepository careServiceRepository;
    @Mock private PetRepository petRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CareBookingRepository careBookingRepository;
    @Mock private MedicalRecordRepository medicalRecordRepository;
    @Mock private WalletTransactionRepository walletTransactionRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private DocumentService documentService;
    @Mock private ProviderService providerService;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private AccountService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AccountService(userRepository, encoder, customerProfileRepository, doctorProfileRepository, providerProfileRepository,
                availabilityRepository, careServiceRepository, petRepository, appointmentRepository, careBookingRepository,
                medicalRecordRepository, walletTransactionRepository, notificationRepository, refreshTokenRepository, documentService, providerService);
        user = User.builder().id(5L).email("a@b.com").phone("+919876543210").password(encoder.encode("Secret1!")).role(Role.ROLE_CUSTOMER).build();
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(walletTransactionRepository.total(anyLong(), any())).thenReturn(BigDecimal.ZERO);
    }

    @Test
    void theWrongPasswordDeletesNothing() {
        assertTrue(assertThrows(BadRequestException.class, () -> service.deleteAccount(5L, "nope")).getMessage().contains("not correct"));
        assertTrue(user.getIsActive());
    }

    @Test
    void anAdminAccountCannotBeDeleted() {
        user.setRole(Role.ROLE_ADMIN);
        assertTrue(assertThrows(BadRequestException.class, () -> service.deleteAccount(5L, "Secret1!")).getMessage().contains("admin"));
    }

    @Test
    void aCustomerWithUpcomingBookingsMustCancelThemFirst() {
        CustomerProfile c = CustomerProfile.builder().id(11L).user(user).fullName("Cathy").build();
        when(customerProfileRepository.findByUserId(5L)).thenReturn(Optional.of(c));
        when(appointmentRepository.countByCustomerIdAndStatusInAndAppointmentDateGreaterThanEqual(anyLong(), any(), any())).thenReturn(2L);
        assertTrue(assertThrows(BadRequestException.class, () -> service.deleteAccount(5L, "Secret1!")).getMessage().contains("2 upcoming bookings"));
        assertTrue(user.getIsActive());
    }

    @Test
    void aDoctorWithMoneyInTheWalletIsToldToGetPaidFirst() {
        user.setRole(Role.ROLE_DOCTOR);
        DoctorProfile d = DoctorProfile.builder().id(20L).user(user).fullName("Dr X").build();
        when(doctorProfileRepository.findByUserId(5L)).thenReturn(Optional.of(d));
        when(walletTransactionRepository.total(5L, WalletTxnType.CREDIT)).thenReturn(new BigDecimal("500"));
        when(walletTransactionRepository.total(5L, WalletTxnType.DEBIT)).thenReturn(new BigDecimal("100"));
        assertTrue(assertThrows(BadRequestException.class, () -> service.deleteAccount(5L, "Secret1!")).getMessage().contains("wallet"));
        assertEquals("Dr X", d.getFullName());
    }

    @Test
    void deletingRemovesWhoThePersonWasAndFreesTheNumber() {
        CustomerProfile c = CustomerProfile.builder().id(11L).user(user).fullName("Cathy").address("1 Road").city("Town").emergencyContact("999").build();
        when(customerProfileRepository.findByUserId(5L)).thenReturn(Optional.of(c));
        Pet withHistory = Pet.builder().id(1L).name("Rex").microchipNumber("123").allergies("pollen").build();
        Pet noHistory = Pet.builder().id(2L).name("Tom").build();
        when(petRepository.findByCustomerId(11L)).thenReturn(List.of(withHistory, noHistory));
        when(appointmentRepository.existsByPetId(1L)).thenReturn(true);

        service.deleteAccount(5L, "Secret1!");

        assertEquals("Deleted user", c.getFullName());
        assertNull(c.getAddress()); assertNull(c.getEmergencyContact());
        assertEquals("Pet", withHistory.getName()); assertNull(withHistory.getMicrochipNumber()); assertNull(withHistory.getAllergies());
        verify(petRepository).delete(noHistory);
        assertFalse(user.getIsActive());
        assertEquals("deleted-5", user.getPhone());
        assertTrue(user.getEmail().endsWith("@deleted.invalid"));
        assertFalse(encoder.matches("Secret1!", user.getPassword()), "the old password no longer works");
        verify(notificationRepository).deleteAllForUser(5L);
        verify(refreshTokenRepository).deleteByUser(user);
    }

    @Test
    void aDeletedDoctorIsHiddenAndLosesTheirDetailsAndDocuments() {
        user.setRole(Role.ROLE_DOCTOR);
        DoctorProfile d = DoctorProfile.builder().id(20L).user(user).fullName("Dr X").licenseNumber("TN-1").upiId("x@okaxis").clinicName("C").bio("hi")
                .verificationStatus(VerificationStatus.APPROVED).build();
        when(doctorProfileRepository.findByUserId(5L)).thenReturn(Optional.of(d));
        service.deleteAccount(5L, "Secret1!");
        assertEquals("Deleted doctor", d.getFullName());
        assertEquals("DELETED-20", d.getLicenseNumber());
        assertNull(d.getUpiId()); assertNull(d.getBio());
        assertEquals(VerificationStatus.REJECTED, d.getVerificationStatus(), "never listed again");
        verify(documentService).deleteAllFor("DOCTOR", 20L);
    }

    @Test
    void aPetOwnerCanTurnTheAccountIntoABusinessOnlyWithNothingUpcoming() {
        CustomerProfile c = CustomerProfile.builder().id(11L).user(user).fullName("Cathy").build();
        when(customerProfileRepository.findByUserId(5L)).thenReturn(Optional.of(c));
        var request = com.vetconnect.dto.care.CareDtos.ProviderRequest.builder().businessName("Happy Paws").build();

        when(careBookingRepository.countByCustomerIdAndStatusIn(anyLong(), any())).thenReturn(1L);
        assertTrue(assertThrows(BadRequestException.class, () -> service.becomeBusiness(5L, request)).getMessage().contains("1 upcoming booking"));
        assertEquals(Role.ROLE_CUSTOMER, user.getRole());

        when(careBookingRepository.countByCustomerIdAndStatusIn(anyLong(), any())).thenReturn(0L);
        when(providerService.createProfile(any(), any())).thenReturn(com.vetconnect.dto.care.CareDtos.ProviderDto.builder().id(40L).build());
        service.becomeBusiness(5L, request);
        assertEquals(Role.ROLE_PROVIDER, user.getRole());
        verify(providerService).createProfile(5L, request);
    }

    @Test
    void onlyAPetOwnerAccountCanBecomeABusiness() {
        user.setRole(Role.ROLE_DOCTOR);
        assertThrows(BadRequestException.class, () -> service.becomeBusiness(5L, com.vetconnect.dto.care.CareDtos.ProviderRequest.builder().build()));
    }
}
