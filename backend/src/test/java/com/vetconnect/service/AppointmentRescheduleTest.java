package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.appointment.RescheduleRequest;
import com.vetconnect.dto.appointment.StatusUpdateRequest;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.*;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** A reschedule is a request: the doctor answers it, and nothing moves until they approve. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppointmentRescheduleTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2030-03-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private PetRepository petRepository;
    @Mock private UserRepository userRepository;
    @Mock private ReviewRepository reviewRepository;
    @Mock private MedicalRecordRepository medicalRecordRepository;
    @Mock private NotificationService notificationService;
    @Mock private DoctorService doctorService;
    @Mock private CarePaymentRepository paymentRepository;

    private AppointmentService service;
    private User customerUser, doctorUser, otherDoctorUser;
    private DoctorProfile doctor, otherDoctor;
    private Appointment appt;
    private final LocalDate oldDate = LocalDate.now().plusDays(10);
    private final LocalDate newDate = LocalDate.now().plusDays(12);

    @BeforeEach
    void setUp() {
        CarePaymentService payments = new CarePaymentService(paymentRepository, new com.vetconnect.payment.SimulatedPaymentGateway(), CLOCK, mock(WalletService.class));
        service = new AppointmentService(appointmentRepository, customerProfileRepository, doctorProfileRepository, petRepository,
                userRepository, reviewRepository, medicalRecordRepository, notificationService, doctorService, payments, new AppProperties(), CLOCK);

        customerUser = User.builder().id(1L).email("c@x.com").role(Role.ROLE_CUSTOMER).isActive(true).build();
        doctorUser = User.builder().id(2L).email("d@x.com").role(Role.ROLE_DOCTOR).isActive(true).build();
        otherDoctorUser = User.builder().id(3L).email("o@x.com").role(Role.ROLE_DOCTOR).isActive(true).build();
        CustomerProfile customer = CustomerProfile.builder().id(10L).user(customerUser).fullName("Cathy").build();
        doctor = DoctorProfile.builder().id(20L).user(doctorUser).fullName("Dr. Test").consultationFee(new BigDecimal("80")).build();
        otherDoctor = DoctorProfile.builder().id(21L).user(otherDoctorUser).fullName("Dr. Other").build();
        Pet pet = Pet.builder().id(30L).customer(customer).name("Fluffy").species(PetSpecies.DOG).build();
        appt = Appointment.builder().id(99L).bookingReference("VC-1").customer(customer).doctor(doctor).pet(pet)
                .appointmentDate(oldDate).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(10, 30)).reason("x")
                .status(AppointmentStatus.CONFIRMED).currency("USD").build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(customerUser));
        when(userRepository.findById(2L)).thenReturn(Optional.of(doctorUser));
        when(doctorProfileRepository.findByUserId(2L)).thenReturn(Optional.of(doctor));
        when(doctorProfileRepository.findByUserId(3L)).thenReturn(Optional.of(otherDoctor));
        when(appointmentRepository.findByIdForUpdate(99L)).thenReturn(Optional.of(appt));
        when(appointmentRepository.findById(99L)).thenReturn(Optional.of(appt));
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(i -> i.getArgument(0));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(anyLong(), any(), any(), any())).thenReturn(false);
        when(paymentRepository.findFirstByAppointmentIdOrderByIdDesc(anyLong())).thenReturn(Optional.empty());
        when(reviewRepository.existsByAppointmentId(anyLong())).thenReturn(false);
    }


    private RescheduleRequest request(String note) {
        return RescheduleRequest.builder().appointmentDate(newDate).startTime(LocalTime.of(14, 0)).endTime(LocalTime.of(14, 30)).note(note).build();
    }

    @Test
    void aRequestLeavesTheAppointmentWhereItIsAndTellsTheDoctor() {
        AppointmentDto dto = service.rescheduleAppointment(99L, 1L, request("Work meeting"));
        assertEquals(oldDate, dto.getAppointmentDate(), "the appointment has not moved");
        assertEquals(LocalTime.of(10, 0), dto.getStartTime());
        assertEquals(AppointmentStatus.CONFIRMED, dto.getStatus());
        assertNotNull(dto.getRescheduleRequest());
        assertEquals(newDate, dto.getRescheduleRequest().getAppointmentDate());
        assertEquals(LocalTime.of(14, 0), dto.getRescheduleRequest().getStartTime());
        assertEquals("Work meeting", dto.getRescheduleRequest().getNote());
        verify(notificationService).createNotification(eq(doctorUser), eq("Reschedule requested"), contains("Work meeting"), any(), anyString());
        verify(notificationService).createNotification(eq(customerUser), eq("Reschedule request sent"), anyString(), any(), anyString());
    }

    @Test
    void onlyTheOwnerCanAsk() {
        assertThrows(BadRequestException.class, () -> service.rescheduleAppointment(99L, 2L, request(null)));
        assertFalse(appt.hasRescheduleRequest());
    }

    @Test
    void aSecondRequestWaitsUntilTheFirstIsAnswered() {
        service.rescheduleAppointment(99L, 1L, request(null));
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.rescheduleAppointment(99L, 1L, request(null)));
        assertTrue(e.getMessage().contains("already have a reschedule request"));
    }

    @Test
    void askingForTheTimeYouAlreadyHaveIsRefused() {
        RescheduleRequest same = RescheduleRequest.builder().appointmentDate(oldDate).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(10, 30)).build();
        assertThrows(BadRequestException.class, () -> service.rescheduleAppointment(99L, 1L, same));
    }

    @Test
    void aTakenSlotCannotBeRequested() {
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(eq(20L), eq(newDate), eq(LocalTime.of(14, 0)), any())).thenReturn(true);
        assertThrows(BookingConflictException.class, () -> service.rescheduleAppointment(99L, 1L, request(null)));
        assertFalse(appt.hasRescheduleRequest());
    }

    @Test
    void approvingMovesTheAppointmentAndConfirmsIt() {
        appt.setStatus(AppointmentStatus.PENDING);
        service.rescheduleAppointment(99L, 1L, request(null));
        AppointmentDto dto = service.approveReschedule(99L, 2L);
        assertEquals(newDate, dto.getAppointmentDate());
        assertEquals(LocalTime.of(14, 0), dto.getStartTime());
        assertEquals(LocalTime.of(14, 30), dto.getEndTime());
        assertEquals(AppointmentStatus.CONFIRMED, dto.getStatus());
        assertNull(dto.getRescheduleRequest());
        verify(notificationService).createNotification(eq(customerUser), eq("Reschedule approved"), anyString(), any(), anyString());
    }

    @Test
    void approvingFailsCleanlyIfSomeoneTookTheSlotMeanwhile() {
        service.rescheduleAppointment(99L, 1L, request(null));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(eq(20L), eq(newDate), eq(LocalTime.of(14, 0)), any())).thenReturn(true);
        assertThrows(BookingConflictException.class, () -> service.approveReschedule(99L, 2L));
        assertEquals(oldDate, appt.getAppointmentDate(), "the appointment did not move");
        assertTrue(appt.hasRescheduleRequest(), "the request is still there to decline");
    }

    @Test
    void decliningKeepsTheTimeAndGivesTheOwnerTheReason() {
        service.rescheduleAppointment(99L, 1L, request(null));
        assertThrows(BadRequestException.class, () -> service.rejectReschedule(99L, 2L, StatusUpdateRequest.builder().reason(" ").build()));
        AppointmentDto dto = service.rejectReschedule(99L, 2L, StatusUpdateRequest.builder().reason("Fully booked that day").build());
        assertEquals(oldDate, dto.getAppointmentDate());
        assertEquals(AppointmentStatus.CONFIRMED, dto.getStatus());
        assertNull(dto.getRescheduleRequest());
        verify(notificationService).createNotification(eq(customerUser), eq("Reschedule declined"), contains("Fully booked that day"), any(), anyString());
    }

    @Test
    void theOwnerCanWithdrawAndTheDoctorIsTold() {
        service.rescheduleAppointment(99L, 1L, request(null));
        AppointmentDto dto = service.withdrawReschedule(99L, 1L);
        assertNull(dto.getRescheduleRequest());
        verify(notificationService).createNotification(eq(doctorUser), eq("Reschedule withdrawn"), anyString(), any(), anyString());
    }

    @Test
    void onlyTheAssignedDoctorCanAnswer() {
        service.rescheduleAppointment(99L, 1L, request(null));
        assertThrows(UnauthorizedException.class, () -> service.approveReschedule(99L, 3L));
        assertThrows(UnauthorizedException.class, () -> service.rejectReschedule(99L, 3L, StatusUpdateRequest.builder().reason("no").build()));
        assertTrue(appt.hasRescheduleRequest());
    }

    @Test
    void answeringWithNoRequestIsRefused() {
        assertThrows(BadRequestException.class, () -> service.approveReschedule(99L, 2L));
        assertThrows(BadRequestException.class, () -> service.withdrawReschedule(99L, 1L));
    }

    @Test
    void cancellingAnAppointmentDropsItsRequest() {
        service.rescheduleAppointment(99L, 1L, request(null));
        service.cancelAppointment(99L, 1L, null);
        assertFalse(appt.hasRescheduleRequest());
        assertEquals(AppointmentStatus.CANCELLED, appt.getStatus());
    }

    @Test
    void aFinishedAppointmentCannotBeRescheduled() {
        appt.setStatus(AppointmentStatus.COMPLETED);
        assertThrows(BadRequestException.class, () -> service.rescheduleAppointment(99L, 1L, request(null)));
    }
}
