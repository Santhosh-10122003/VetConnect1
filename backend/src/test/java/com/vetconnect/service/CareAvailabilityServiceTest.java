package com.vetconnect.service;

import com.vetconnect.domain.entities.CareBooking;
import com.vetconnect.domain.entities.ProviderHours;
import com.vetconnect.domain.entities.ProviderProfile;
import com.vetconnect.domain.enums.CareBookingStatus;
import com.vetconnect.dto.care.CareDtos.BoardingNightDto;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.repository.CareBookingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.*;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CareAvailabilityServiceTest {

    /** Monday 1 March 2027, 10:00. */
    private static final Instant NOW = Instant.parse("2027-03-01T10:00:00Z");
    private static final LocalDate MONDAY = LocalDate.of(2027, 3, 8);
    private static final LocalDate SUNDAY = LocalDate.of(2027, 3, 14);

    @Mock private CareBookingRepository bookingRepository;

    private CareAvailabilityService service;
    private ProviderProfile provider;
    private final List<CareBooking> timed = new ArrayList<>();
    private final List<CareBooking> stays = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new CareAvailabilityService(bookingRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        provider = ProviderProfile.builder().id(1L).slotMinutes(30).concurrentCapacity(2).boardingCapacity(3).build();
        for (int day = 1; day <= 7; day++) {
            provider.getHours().add(ProviderHours.builder().provider(provider).dayOfWeek(day)
                    .openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(day <= 6).build());
        }
        when(bookingRepository.findTimedHolding(eq(1L), any(), any(), eq(CareBookingStatus.AWAITING_PAYMENT), any()))
                .thenAnswer(i -> timed.stream().filter(b -> b.getBookingDate().equals(i.getArgument(1))).toList());
        when(bookingRepository.findBoardingHolding(eq(1L), any(), any(), any(), eq(CareBookingStatus.AWAITING_PAYMENT), any()))
                .thenAnswer(i -> stays);
    }

    private void book(LocalDate date, String start, String end) {
        timed.add(CareBooking.builder().bookingDate(date).startTime(LocalTime.parse(start)).endTime(LocalTime.parse(end)).build());
    }

    private AvailableSlotDto slotAt(List<AvailableSlotDto> slots, String time) {
        return slots.stream().filter(s -> s.getStartTime().equals(LocalTime.parse(time))).findFirst().orElseThrow();
    }

    @Test
    void closedDayHasNoSlots() {
        assertTrue(service.slots(provider, 60, SUNDAY).isEmpty());
    }

    @Test
    void slotsRunFromOpeningToClosing_withRoomForTheWholeSession() {
        List<AvailableSlotDto> slots = service.slots(provider, 60, MONDAY);

        assertEquals(LocalTime.of(9, 0), slots.get(0).getStartTime());
        assertEquals(LocalTime.of(17, 0), slots.get(slots.size() - 1).getStartTime(), "a 60 minute session must end by 18:00");
        assertEquals(LocalTime.of(18, 0), slots.get(slots.size() - 1).getEndTime());
        assertTrue(slots.stream().allMatch(AvailableSlotDto::isAvailable));
        assertEquals(17, slots.size());
    }

    @Test
    void aLongerSessionLeavesFewerStartTimes() {
        List<AvailableSlotDto> slots = service.slots(provider, 90, MONDAY);

        assertEquals(LocalTime.of(16, 30), slots.get(slots.size() - 1).getStartTime());
    }

    @Test
    void aSlotStaysOpenUntilTheProviderIsFullyBooked() {
        book(MONDAY, "10:00", "11:00");   // 1 of 2 pets at 10:00
        assertTrue(slotAt(service.slots(provider, 60, MONDAY), "10:00").isAvailable());

        book(MONDAY, "10:00", "11:00");   // 2 of 2
        List<AvailableSlotDto> slots = service.slots(provider, 60, MONDAY);
        assertFalse(slotAt(slots, "10:00").isAvailable());
        assertFalse(slotAt(slots, "09:30").isAvailable(), "a session starting 09:30 would overlap the full 10:00 hour");
        assertFalse(slotAt(slots, "10:30").isAvailable());
        assertTrue(slotAt(slots, "09:00").isAvailable(), "09:00 to 10:00 ends exactly when the full hour starts");
        assertTrue(slotAt(slots, "11:00").isAvailable());
    }

    @Test
    void overlappingBookingsAreCountedAtEachMomentNotJustPerBooking() {
        book(MONDAY, "10:00", "10:30");
        book(MONDAY, "10:30", "11:00");   // never two at the same time

        assertTrue(slotAt(service.slots(provider, 60, MONDAY), "10:00").isAvailable());
    }

    @Test
    void otherDaysAreUnaffected() {
        book(MONDAY, "10:00", "11:00");
        book(MONDAY, "10:00", "11:00");

        assertTrue(slotAt(service.slots(provider, 60, MONDAY.plusDays(1)), "10:00").isAvailable());
    }

    @Test
    void todaysPastSlotsAreNotOffered() {
        // "now" is Monday 1 March 10:00
        List<AvailableSlotDto> slots = service.slots(provider, 30, LocalDate.of(2027, 3, 1));

        assertFalse(slotAt(slots, "09:30").isAvailable());
        assertFalse(slotAt(slots, "10:00").isAvailable(), "a slot starting right now is already too late");
        assertTrue(slotAt(slots, "10:30").isAvailable());
    }

    @Test
    void isSlotFreeOnlyAcceptsRealStartTimes() {
        assertTrue(service.isSlotFree(provider, MONDAY, LocalTime.of(10, 0), 60));
        assertFalse(service.isSlotFree(provider, MONDAY, LocalTime.of(10, 15), 60), "10:15 is not on the 30 minute grid");
        assertFalse(service.isSlotFree(provider, MONDAY, LocalTime.of(8, 0), 60), "before opening");
        assertFalse(service.isSlotFree(provider, MONDAY, LocalTime.of(17, 30), 60), "would run past closing");
        assertFalse(service.isSlotFree(provider, SUNDAY, LocalTime.of(10, 0), 60), "closed on Sunday");
    }

    // ---------------------------------------------------------------- boarding

    private void stay(String checkIn, String checkOut) {
        stays.add(CareBooking.builder().bookingDate(LocalDate.parse(checkIn)).checkOutDate(LocalDate.parse(checkOut)).build());
    }

    @Test
    void boardingPlacesAreCountedPerNight() {
        stay("2027-03-10", "2027-03-13");   // nights 10, 11, 12
        stay("2027-03-11", "2027-03-12");   // night 11
        stay("2027-03-11", "2027-03-14");   // nights 11, 12, 13

        List<BoardingNightDto> nights = service.boardingNights(provider, LocalDate.of(2027, 3, 9), LocalDate.of(2027, 3, 15));

        assertEquals(List.of(3, 2, 0, 1, 2, 3), nights.stream().map(BoardingNightDto::getRemaining).toList());
        assertEquals(List.of(true, true, false, true, true, true), nights.stream().map(BoardingNightDto::isAvailable).toList());
    }

    @Test
    void theCheckOutDayDoesNotUseAPlace() {
        stay("2027-03-10", "2027-03-12");

        List<BoardingNightDto> nights = service.boardingNights(provider, LocalDate.of(2027, 3, 12), LocalDate.of(2027, 3, 13));

        assertEquals(3, nights.get(0).getRemaining());
    }
}
