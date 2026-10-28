package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorServiceLocationTest {

    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private DoctorAvailabilityRepository availabilityRepository;
    @Mock private SpecializationRepository specializationRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    private DoctorService service;
    private DoctorProfile sarah;   // Springfield, ~2 km from the customer
    private DoctorProfile raj;     // West Bay, ~21 km
    private DoctorProfile emily;   // Northview, ~69 km
    private DoctorProfile noGps;   // Springfield, no coordinates
    private CustomerProfile customer;
    private UserPrincipal customerPrincipal;

    @BeforeEach
    void setUp() {
        service = new DoctorService(doctorProfileRepository, availabilityRepository, specializationRepository,
                appointmentRepository, customerProfileRepository, userRepository, notificationService, new AppProperties());
        sarah = doctor(1L, "Dr. Sarah", "Springfield", 39.7817, -89.6501, "4.50");
        raj = doctor(2L, "Dr. Raj", "West Bay", 39.9000, -89.4500, "4.90");
        emily = doctor(3L, "Dr. Emily", "Northview", 40.3000, -89.2000, "5.00");
        noGps = doctor(4L, "Dr. NoGps", "Springfield", null, null, "3.00");
        customer = CustomerProfile.builder().id(10L).fullName("John").city("Springfield")
                .latitude(39.7990).longitude(-89.6440).user(User.builder().id(100L).build()).build();
        customerPrincipal = UserPrincipal.builder().id(100L).email("john@x.com").role(Role.ROLE_CUSTOMER).build();
    }

    private DoctorProfile doctor(Long id, String name, String city, Double lat, Double lon, String rating) {
        return DoctorProfile.builder().id(id).fullName(name).clinicCity(city).latitude(lat).longitude(lon)
                .clinicName("Clinic").clinicAddress("Addr").licenseNumber("L" + id)
                .ratingAvg(new BigDecimal(rating)).consultationFee(BigDecimal.TEN)
                .verificationStatus(VerificationStatus.APPROVED).specializations(new HashSet<>())
                .user(User.builder().id(id + 1000).email(name + "@x.com").build()).build();
    }

    private void allDoctorsInDb() {
        when(doctorProfileRepository.searchDoctors(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(emily, raj, sarah, noGps)));
    }

    private List<Long> ids(PageResponse<DoctorProfileDto> page) {
        return page.getContent().stream().map(DoctorProfileDto::getId).toList();
    }

    @Test
    void customerWithGps_seesOnlyDoctorsInsideTheRadius_nearestFirst() {
        allDoctorsInDb();
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        PageResponse<DoctorProfileDto> page = service.searchDoctors(customerPrincipal, null, null, null, null, null, PageRequest.of(0, 10));

        // default radius 25 km: Sarah (~2 km) and Raj (~21 km); Emily (~69 km) is out. NoGps matches on city.
        assertEquals(List.of(1L, 2L, 4L), ids(page));
        assertNotNull(page.getContent().get(0).getDistanceKm());
        assertTrue(page.getContent().get(0).getDistanceKm() < page.getContent().get(1).getDistanceKm());
        assertNull(page.getContent().get(2).getDistanceKm());
    }

    @Test
    void widerRadiusReachesFurtherClinics_butNeverBeyondTheMaximum() {
        allDoctorsInDb();
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        assertEquals(List.of(1L, 2L, 3L, 4L),
                ids(service.searchDoctors(customerPrincipal, null, null, null, null, 100.0, PageRequest.of(0, 10))));
        // a request above the cap is clamped to 100 km, not honoured
        assertEquals(List.of(1L, 2L, 3L, 4L),
                ids(service.searchDoctors(customerPrincipal, null, null, null, null, 5000.0, PageRequest.of(0, 10))));
        // a very small radius leaves just the closest clinic (plus the city-only match)
        assertEquals(List.of(1L, 4L),
                ids(service.searchDoctors(customerPrincipal, null, null, null, null, 5.0, PageRequest.of(0, 10))));
    }

    @Test
    void customerWithoutGps_isMatchedByCityIgnoringCase() {
        allDoctorsInDb();
        customer.setLatitude(null);
        customer.setLongitude(null);
        customer.setCity("  springfield ");
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        assertEquals(List.of(1L, 4L), ids(service.searchDoctors(customerPrincipal, null, null, null, null, null, PageRequest.of(0, 10))));
    }

    @Test
    void customerWithNoLocationAtAll_seesNobody() {
        allDoctorsInDb();
        customer.setCity(null);
        customer.setLatitude(null);
        customer.setLongitude(null);
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        assertTrue(service.searchDoctors(customerPrincipal, null, null, null, null, null, PageRequest.of(0, 10)).getContent().isEmpty());
    }

    @Test
    void adminsAndDoctorsAreNotLocationRestricted() {
        allDoctorsInDb();
        UserPrincipal admin = UserPrincipal.builder().id(1L).email("a@x.com").role(Role.ROLE_ADMIN).build();

        PageResponse<DoctorProfileDto> page = service.searchDoctors(admin, null, null, null, null, null, PageRequest.of(0, 10));

        assertEquals(4, page.getTotalElements());
    }

    @Test
    void searchResultsArePaged() {
        allDoctorsInDb();
        UserPrincipal admin = UserPrincipal.builder().id(1L).email("a@x.com").role(Role.ROLE_ADMIN).build();

        PageResponse<DoctorProfileDto> second = service.searchDoctors(admin, null, null, null, null, null, PageRequest.of(1, 3));

        assertEquals(1, second.getContent().size());
        assertEquals(2, second.getTotalPages());
        assertTrue(second.isLast());
    }

    @Test
    void customerCannotOpenADoctorOutsideTheirArea() {
        when(doctorProfileRepository.findById(3L)).thenReturn(Optional.of(emily));
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        // Emily is ~69 km away: reachable only up to the 100 km cap, so she IS accessible...
        assertDoesNotThrow(() -> service.getDoctorById(3L, customerPrincipal));

        // ...but a doctor in another country is not.
        DoctorProfile faraway = doctor(9L, "Dr. Far", "Elsewhere", 10.0, 10.0, "5.00");
        when(doctorProfileRepository.findById(9L)).thenReturn(Optional.of(faraway));
        assertThrows(ResourceNotFoundException.class, () -> service.getDoctorById(9L, customerPrincipal));
    }

    @Test
    void customerCannotOpenAnUnapprovedDoctor() {
        sarah.setVerificationStatus(VerificationStatus.PENDING);
        when(doctorProfileRepository.findById(1L)).thenReturn(Optional.of(sarah));
        when(customerProfileRepository.findByUserId(100L)).thenReturn(Optional.of(customer));

        assertThrows(ResourceNotFoundException.class, () -> service.getDoctorById(1L, customerPrincipal));
    }

    @Test
    void publicDtoNeverCarriesTheAdminsReason() {
        sarah.setVerificationReason("secret admin note");

        assertNull(service.toDto(sarah).getVerificationReason());
        assertEquals("secret admin note", service.toOwnerDto(sarah).getVerificationReason());
    }

    @Test
    void changingTheClinicCityDropsTheOldGpsPosition() {
        com.vetconnect.dto.doctor.UpdateDoctorProfileRequest request = com.vetconnect.dto.doctor.UpdateDoctorProfileRequest.builder()
                .fullName("Dr. Sarah").clinicName("Clinic").clinicAddress("New addr").clinicCity("Shelbyville")
                .yearsOfExperience(3).consultationFee(BigDecimal.TEN).build();
        when(doctorProfileRepository.findByUserId(1001L)).thenReturn(Optional.of(sarah));
        when(doctorProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.updateDoctorProfile(1001L, request);

        assertEquals("Shelbyville", sarah.getClinicCity());
        assertNull(sarah.getLatitude());
        assertNull(sarah.getLongitude());
    }

    @Test
    void resubmit_onlyAllowedAfterARejection() {
        when(doctorProfileRepository.findByUserId(1001L)).thenReturn(Optional.of(sarah)); // APPROVED

        assertThrows(BadRequestException.class, () -> service.resubmitForApproval(1001L, new ResubmitRequest("fixed")));
        assertEquals(VerificationStatus.APPROVED, sarah.getVerificationStatus());
    }

    @Test
    void resubmit_movesToResubmittedAndNotifiesEveryAdmin() {
        sarah.setVerificationStatus(VerificationStatus.REJECTED);
        sarah.setVerificationReason("License photo unreadable");
        User admin1 = User.builder().id(1L).email("a1@x.com").build();
        User admin2 = User.builder().id(2L).email("a2@x.com").build();
        when(doctorProfileRepository.findByUserId(1001L)).thenReturn(Optional.of(sarah));
        when(doctorProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userRepository.findByRole(Role.ROLE_ADMIN)).thenReturn(List.of(admin1, admin2));

        DoctorProfileDto dto = service.resubmitForApproval(1001L, new ResubmitRequest("  re-uploaded the license  "));

        assertEquals(VerificationStatus.RESUBMITTED, dto.getVerificationStatus());
        assertEquals("re-uploaded the license", dto.getResubmitNote());
        assertNotNull(dto.getResubmittedAt());
        assertEquals("License photo unreadable", dto.getVerificationReason(), "the earlier reason stays visible");
        verify(notificationService, times(2)).createNotification(any(), any(), any(), eq(NotificationType.DOCTOR_RESUBMITTED), any());
    }

    @Test
    void sameCityNameInAnotherCountryIsADifferentPlace() {
        customer.setLatitude(null);
        customer.setLongitude(null);
        customer.setCountry("United States");
        sarah.setClinicCountry("United Kingdom");
        noGps.setClinicCountry("United States");

        assertFalse(service.isInServiceArea(customer, sarah, 25), "Springfield UK is not Springfield US");
        assertTrue(service.isInServiceArea(customer, noGps, 25));
    }

    @Test
    void sameCityNameInAnotherStateIsADifferentPlace() {
        customer.setLatitude(null);
        customer.setLongitude(null);
        customer.setState("Illinois");
        sarah.setClinicState("Massachusetts");

        assertFalse(service.isInServiceArea(customer, sarah, 25));
    }

    @Test
    void missingCountryOrStateIsTreatedAsUnknownNotAsAMismatch() {
        customer.setLatitude(null);
        customer.setLongitude(null);
        customer.setCountry("India");   // doctor has no country recorded (older accounts)

        assertTrue(service.isInServiceArea(customer, sarah, 25));
    }

    @Test
    void changingOnlyTheStateAlsoDropsTheGpsFix() {
        sarah.setClinicState("Illinois");
        com.vetconnect.dto.doctor.UpdateDoctorProfileRequest request = com.vetconnect.dto.doctor.UpdateDoctorProfileRequest.builder()
                .fullName("Dr. Sarah").clinicName("Clinic").clinicAddress("Addr").clinicCity("Springfield").clinicState("Missouri")
                .yearsOfExperience(3).consultationFee(BigDecimal.TEN).build();
        when(doctorProfileRepository.findByUserId(1001L)).thenReturn(Optional.of(sarah));
        when(doctorProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.updateDoctorProfile(1001L, request);

        assertEquals("Missouri", sarah.getClinicState());
        assertNull(sarah.getLatitude());
    }
}
