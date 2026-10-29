package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.PetSpecies;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.dto.doctor.DoctorScheduleDtos.BlockSlotRequest;
import com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto;
import com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** The doctor's day: what customers booked is locked, what the doctor blocks is theirs to undo. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DoctorSlotsTest {

    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private DoctorAvailabilityRepository availabilityRepository;
    @Mock private SpecializationRepository specializationRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private DoctorBlockedSlotRepository blockedRepository;

    private final List<DoctorBlockedSlot> blocks = new ArrayList<>();
    private final List<Appointment> appointments = new ArrayList<>();
    private DoctorService service;
    private DoctorProfile doctor, other;
    private final LocalDate day = nextWeekday();

    private static LocalDate nextWeekday() {
        LocalDate d = LocalDate.now().plusDays(5);
        while (d.getDayOfWeek().getValue() > 5) d = d.plusDays(1);
        return d;
    }

    @BeforeEach
    void setUp() {
        service = new DoctorService(doctorProfileRepository, availabilityRepository, specializationRepository, appointmentRepository,
                customerProfileRepository, userRepository, notificationService, new AppProperties(), blockedRepository);
        doctor = DoctorProfile.builder().id(20L).fullName("Dr. T").user(User.builder().id(2L).build()).build();
        other = DoctorProfile.builder().id(21L).fullName("Dr. Other").user(User.builder().id(3L).build()).build();
        when(doctorProfileRepository.findByUserId(2L)).thenReturn(Optional.of(doctor));
        when(doctorProfileRepository.findByUserId(3L)).thenReturn(Optional.of(other));
        when(doctorProfileRepository.findById(20L)).thenReturn(Optional.of(doctor));
        // 09:00 to 12:00 in 30-minute slots, break 10:00 to 10:30
        DoctorAvailability avail = DoctorAvailability.builder().doctor(doctor).dayOfWeek(day.getDayOfWeek().getValue())
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(12, 0)).slotDurationMinutes(30)
                .breakStartTime(LocalTime.of(10, 0)).breakEndTime(LocalTime.of(10, 30)).isActive(true).build();
        when(availabilityRepository.findByDoctorIdAndDayOfWeek(20L, day.getDayOfWeek().getValue())).thenReturn(Optional.of(avail));
        when(appointmentRepository.findByDoctorIdAndAppointmentDateAndStatusNotIn(anyLong(), any(), any())).thenAnswer(i -> new ArrayList<>(appointments));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(anyLong(), any(), any(), any()))
                .thenAnswer(i -> appointments.stream().anyMatch(a -> a.getStartTime().equals(i.getArgument(2))));
        when(blockedRepository.findByDoctorIdAndDate(anyLong(), any())).thenAnswer(i -> new ArrayList<>(blocks));
        when(blockedRepository.existsByDoctorIdAndDateAndStartTime(anyLong(), any(), any()))
                .thenAnswer(i -> blocks.stream().anyMatch(b -> b.getStartTime().equals(i.getArgument(2))));
        when(blockedRepository.save(any(DoctorBlockedSlot.class))).thenAnswer(i -> {
            DoctorBlockedSlot b = i.getArgument(0);
            b.setId(100L + blocks.size());
            blocks.add(b);
            return b;
        });
        when(blockedRepository.findByIdAndDoctorId(anyLong(), anyLong())).thenAnswer(i ->
                blocks.stream().filter(b -> b.getId().equals(i.getArgument(0)) && b.getDoctor().getId().equals(i.getArgument(1))).findFirst());
        doAnswer(i -> blocks.remove(i.getArgument(0))).when(blockedRepository).delete(any(DoctorBlockedSlot.class));
    }

    private Appointment customerBooking(LocalTime start, AppointmentStatus status) {
        Appointment a = Appointment.builder().id(7L).bookingReference("VC-1").doctor(doctor).appointmentDate(day)
                .startTime(start).endTime(start.plusMinutes(30)).status(status).reason("x")
                .pet(Pet.builder().id(1L).name("Rex").species(PetSpecies.DOG).build())
                .customer(CustomerProfile.builder().id(5L).fullName("Cathy").user(User.builder().id(9L).phone("+919000000001").build()).build()).build();
        appointments.add(a);
        return a;
    }


    private BlockSlotRequest block(LocalTime start) {
        return BlockSlotRequest.builder().date(day).startTime(start).reason("Errand").build();
    }

    private ScheduleSlotDto slot(List<ScheduleSlotDto> day, LocalTime start) {
        return day.stream().filter(s -> s.getStartTime().equals(start)).findFirst().orElseThrow();
    }

    @Test
    void theDayShowsFreeBookedBlockedAndBreakSlots() {
        customerBooking(LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        service.blockSlot(2L, block(LocalTime.of(9, 30)));
        List<ScheduleSlotDto> schedule = service.getMySchedule(2L, day);

        assertEquals(6, schedule.size());
        ScheduleSlotDto booked = slot(schedule, LocalTime.of(9, 0));
        assertEquals(SlotStatus.BOOKED, booked.getStatus());
        assertEquals("Rex", booked.getPetName());
        assertEquals("Cathy", booked.getCustomerName());
        assertEquals("+919000000001", booked.getCustomerPhone(), "the doctor can call the customer");
        assertFalse(booked.isCanBlock());
        assertFalse(booked.isCanUnblock(), "a customer's booking cannot be undone by the doctor");
        ScheduleSlotDto mine = slot(schedule, LocalTime.of(9, 30));
        assertEquals(SlotStatus.BLOCKED, mine.getStatus());
        assertTrue(mine.isCanUnblock());
        assertEquals("Errand", mine.getReason());
        assertEquals(SlotStatus.BREAK, slot(schedule, LocalTime.of(10, 0)).getStatus());
        ScheduleSlotDto free = slot(schedule, LocalTime.of(10, 30));
        assertEquals(SlotStatus.AVAILABLE, free.getStatus());
        assertTrue(free.isCanBlock());
    }

    @Test
    void aSlotWaitingForTheCustomersAdvanceIsBookedButShowsNoCustomerDetails() {
        customerBooking(LocalTime.of(11, 0), AppointmentStatus.AWAITING_PAYMENT);
        ScheduleSlotDto s = slot(service.getMySchedule(2L, day), LocalTime.of(11, 0));
        assertEquals(SlotStatus.BOOKED, s.getStatus());
        assertNull(s.getCustomerName());
        assertTrue(s.getNote().contains("pays"));
        assertFalse(s.isCanUnblock());
    }

    @Test
    void aBlockedSlotIsNotAvailableToCustomers() {
        service.blockSlot(2L, block(LocalTime.of(11, 0)));
        List<AvailableSlotDto> slots = service.getAvailableSlots(20L, day, null);
        assertFalse(slots.stream().filter(s -> s.getStartTime().equals(LocalTime.of(11, 0))).findFirst().orElseThrow().isAvailable());
        assertTrue(slots.stream().filter(s -> s.getStartTime().equals(LocalTime.of(11, 30))).findFirst().orElseThrow().isAvailable());
        assertTrue(service.isSlotBlocked(20L, day, LocalTime.of(11, 0)));
        assertFalse(service.isSlotBlocked(20L, day, LocalTime.of(11, 30)));
    }

    @Test
    void aSlotACustomerHoldsCannotBeBlocked() {
        customerBooking(LocalTime.of(9, 0), AppointmentStatus.PENDING);
        BookingConflictException e = assertThrows(BookingConflictException.class, () -> service.blockSlot(2L, block(LocalTime.of(9, 0))));
        assertTrue(e.getMessage().contains("booked by a customer"));
        assertTrue(blocks.isEmpty());
    }

    @Test
    void blockingTwiceBreaksOrOffTheGridIsRefused() {
        service.blockSlot(2L, block(LocalTime.of(9, 30)));
        assertThrows(BadRequestException.class, () -> service.blockSlot(2L, block(LocalTime.of(9, 30))));
        assertThrows(BadRequestException.class, () -> service.blockSlot(2L, block(LocalTime.of(10, 0))), "the break");
        assertThrows(BadRequestException.class, () -> service.blockSlot(2L, block(LocalTime.of(9, 15))), "not a slot");
        assertThrows(BadRequestException.class, () -> service.blockSlot(2L, BlockSlotRequest.builder().date(LocalDate.now().minusDays(1)).startTime(LocalTime.of(9, 0)).build()));
        assertThrows(BadRequestException.class, () -> service.blockSlot(2L, BlockSlotRequest.builder().date(LocalDate.now().plusDays(400)).startTime(LocalTime.of(9, 0)).build()));
        assertEquals(1, blocks.size());
    }

    @Test
    void theDoctorCanUndoTheirOwnBlockAndTheSlotIsFreeAgain() {
        ScheduleSlotDto made = service.blockSlot(2L, block(LocalTime.of(11, 0)));
        service.unblockSlot(2L, made.getBlockId());
        assertTrue(blocks.isEmpty());
        assertEquals(SlotStatus.AVAILABLE, slot(service.getMySchedule(2L, day), LocalTime.of(11, 0)).getStatus());
    }

    @Test
    void aDoctorCannotUndoAnotherDoctorsBlockOrAnythingThatIsNotABlock() {
        ScheduleSlotDto made = service.blockSlot(2L, block(LocalTime.of(11, 0)));
        assertThrows(ResourceNotFoundException.class, () -> service.unblockSlot(3L, made.getBlockId()));
        assertThrows(ResourceNotFoundException.class, () -> service.unblockSlot(2L, 9999L), "a customer's appointment has no block id to undo");
        assertEquals(1, blocks.size());
    }

    @Test
    void aSlotCanBeBookedForANamedCustomerWithAMobileNumber() {
        ScheduleSlotDto saved = service.blockSlot(2L, BlockSlotRequest.builder().date(day).startTime(LocalTime.of(9, 30))
                .customerName(" Ravi Kumar ").customerPhone("+91 98765-43210").build());
        assertEquals("Ravi Kumar", saved.getBlockedForName());
        assertEquals("+919876543210", saved.getBlockedForPhone());
    }

    @Test
    void theCustomerNameAndMobileGoTogetherAndTheNumberMustBeValid() {
        assertThrows(com.vetconnect.common.exceptions.BadRequestException.class, () -> service.blockSlot(2L,
                BlockSlotRequest.builder().date(day).startTime(LocalTime.of(9, 30)).customerName("Ravi").build()));
        assertThrows(com.vetconnect.common.exceptions.BadRequestException.class, () -> service.blockSlot(2L,
                BlockSlotRequest.builder().date(day).startTime(LocalTime.of(9, 30)).customerName("Ravi").customerPhone("12").build()));
    }
}
