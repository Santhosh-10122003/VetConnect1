package com.vetconnect.service;

import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.appointment.BookAppointmentRequest;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private CustomerProfileRepository customerProfileRepository;

    @Mock
    private DoctorProfileRepository doctorProfileRepository;

    @Mock
    private PetRepository petRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private MedicalRecordRepository medicalRecordRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private DoctorService doctorService;

    @Mock
    private CarePaymentService paymentService;

    @Spy
    private com.vetconnect.config.AppProperties appProperties = new com.vetconnect.config.AppProperties();

    @Spy
    private java.time.Clock clock = java.time.Clock.systemDefaultZone();

    @InjectMocks
    private AppointmentService appointmentService;

    private CustomerProfile customer;
    private DoctorProfile doctor;
    private Pet pet;

    @BeforeEach
    void setUp() {
        User userCust = User.builder().id(1L).email("cust@test.com").role(Role.ROLE_CUSTOMER).isActive(true).build();
        customer = CustomerProfile.builder().id(10L).user(userCust).fullName("Test Customer").build();

        User userDoc = User.builder().id(2L).email("doc@test.com").role(Role.ROLE_DOCTOR).isActive(true).build();
        doctor = DoctorProfile.builder()
                .id(20L)
                .user(userDoc)
                .fullName("Dr. Test")
                .clinicName("Clinic")
                .clinicAddress("Address")
                .consultationFee(new BigDecimal("50.00"))
                .verificationStatus(VerificationStatus.APPROVED)
                .build();

        pet = Pet.builder()
                .id(30L)
                .customer(customer)
                .name("Fluffy")
                .species(PetSpecies.DOG)
                .gender(Gender.FEMALE)
                .build();
    }

    @Test
    void bookAppointment_Success() {
        BookAppointmentRequest request = BookAppointmentRequest.builder()
                .doctorId(20L)
                .petId(30L)
                .appointmentDate(LocalDate.now().plusDays(2))
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(10, 30))
                .reason("Vaccination")
                .build();

        when(customerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(customer));
        when(doctorProfileRepository.findById(20L)).thenReturn(Optional.of(doctor));
        when(petRepository.findByIdAndCustomerId(30L, 10L)).thenReturn(Optional.of(pet));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(
                eq(20L), eq(request.getAppointmentDate()), eq(request.getStartTime()), anyCollection()))
                .thenReturn(false);

        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(invocation -> {
            Appointment a = invocation.getArgument(0);
            a.setId(99L);
            return a;
        });

        AppointmentDto result = appointmentService.bookAppointment(1L, request);

        assertNotNull(result);
        assertEquals("Fluffy", result.getPetName());
        assertEquals("Dr. Test", result.getDoctorName());
        // a 50 fee takes an advance first, so the doctor is not told yet
        assertEquals(AppointmentStatus.AWAITING_PAYMENT, result.getStatus());
        assertEquals(new BigDecimal("25.00"), result.getAdvanceAmount());
        verify(paymentService).createAdvance(any(Appointment.class));
        verify(notificationService, never()).createNotification(any(), anyString(), anyString(), any(), anyString());
    }

    @Test
    void bookAppointment_Conflict_ThrowsBookingConflictException() {
        BookAppointmentRequest request = BookAppointmentRequest.builder()
                .doctorId(20L)
                .petId(30L)
                .appointmentDate(LocalDate.now().plusDays(2))
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(10, 30))
                .reason("Vaccination")
                .build();

        when(customerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(customer));
        when(doctorProfileRepository.findById(20L)).thenReturn(Optional.of(doctor));
        when(petRepository.findByIdAndCustomerId(30L, 10L)).thenReturn(Optional.of(pet));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(
                eq(20L), eq(request.getAppointmentDate()), eq(request.getStartTime()), anyCollection()))
                .thenReturn(true); // Slot conflict simulated!

        assertThrows(BookingConflictException.class, () -> appointmentService.bookAppointment(1L, request));
        verify(appointmentRepository, never()).save(any());
    }
}
