package com.vetconnect.service;

import com.vetconnect.domain.entities.CareBooking;
import com.vetconnect.domain.entities.ProviderHours;
import com.vetconnect.domain.entities.ProviderProfile;
import com.vetconnect.domain.enums.CareBookingStatus;
import com.vetconnect.dto.care.CareDtos.BoardingNightDto;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.repository.CareBookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Works out what is free: time slots for grooming and training (limited by how many pets the provider can handle
 * at once) and overnight places for boarding. An unpaid booking holds its place only until its hold runs out.
 */
@Service
@RequiredArgsConstructor
public class CareAvailabilityService {

    static final Set<CareBookingStatus> SOLID = EnumSet.of(CareBookingStatus.REQUESTED, CareBookingStatus.CONFIRMED);

    private final CareBookingRepository bookingRepository;
    private final Clock clock;

    // ------------------------------------------------------------------ timed services

    @Transactional(readOnly = true)
    public List<AvailableSlotDto> slots(ProviderProfile provider, int durationMinutes, LocalDate date) {
        ProviderHours hours = hoursFor(provider, date);
        if (hours == null) return List.of();

        int step = provider.getSlotMinutes();
        int open = minutes(hours.getOpenTime());
        int close = minutes(hours.getCloseTime());
        LocalDateTime now = LocalDateTime.now(clock);
        List<CareBooking> held = held(provider.getId(), date);

        List<AvailableSlotDto> slots = new ArrayList<>();
        for (int start = open; start + durationMinutes <= close; start += step) {
            boolean past = date.equals(now.toLocalDate()) && start <= minutes(now.toLocalTime());
            boolean free = !past && maxConcurrent(held, start, start + durationMinutes) < provider.getConcurrentCapacity();
            slots.add(AvailableSlotDto.builder()
                    .date(date)
                    .startTime(time(start))
                    .endTime(time(start + durationMinutes))
                    .available(free)
                    .build());
        }
        return slots;
    }

    /** True when a booking of this length starting at {@code start} is a valid slot with room left. */
    @Transactional(readOnly = true)
    public boolean isSlotFree(ProviderProfile provider, LocalDate date, LocalTime start, int durationMinutes) {
        return slots(provider, durationMinutes, date).stream()
                .anyMatch(s -> s.getStartTime().equals(start) && s.isAvailable());
    }

    // ------------------------------------------------------------------ boarding

    /** Free overnight places for each night from {@code from} (inclusive) to {@code toExclusive}. */
    @Transactional(readOnly = true)
    public List<BoardingNightDto> boardingNights(ProviderProfile provider, LocalDate from, LocalDate toExclusive) {
        List<CareBooking> stays = bookingRepository.findBoardingHolding(
                provider.getId(), from, toExclusive, SOLID, CareBookingStatus.AWAITING_PAYMENT, clock.instant());
        List<BoardingNightDto> nights = new ArrayList<>();
        for (LocalDate d = from; d.isBefore(toExclusive); d = d.plusDays(1)) {
            final LocalDate night = d;
            long used = stays.stream()
                    .filter(b -> !night.isBefore(b.getBookingDate()) && night.isBefore(b.getCheckOutDate()))
                    .count();
            int remaining = (int) Math.max(0, provider.getBoardingCapacity() - used);
            nights.add(BoardingNightDto.builder().date(night).remaining(remaining).available(remaining > 0).build());
        }
        return nights;
    }

    // ------------------------------------------------------------------ helpers

    private List<CareBooking> held(Long providerId, LocalDate date) {
        return bookingRepository.findTimedHolding(providerId, date, SOLID, CareBookingStatus.AWAITING_PAYMENT, clock.instant());
    }

    private static ProviderHours hoursFor(ProviderProfile provider, LocalDate date) {
        int day = date.getDayOfWeek().getValue();
        return provider.getHours().stream()
                .filter(h -> h.getDayOfWeek() == day && Boolean.TRUE.equals(h.getIsOpen()))
                .findFirst()
                .orElse(null);
    }

    /** The most bookings that overlap at any single moment inside [from, to). */
    static int maxConcurrent(List<CareBooking> held, int from, int to) {
        List<int[]> ranges = new ArrayList<>();
        for (CareBooking b : held) {
            int s = minutes(b.getStartTime());
            int e = minutes(b.getEndTime());
            if (s < to && e > from) ranges.add(new int[]{s, e});
        }
        int max = 0;
        List<Integer> points = new ArrayList<>();
        points.add(from);
        for (int[] r : ranges) if (r[0] > from) points.add(r[0]);
        for (int p : points) {
            int count = 0;
            for (int[] r : ranges) if (r[0] <= p && p < r[1]) count++;
            max = Math.max(max, count);
        }
        return max;
    }

    private static int minutes(LocalTime t) {
        return t.getHour() * 60 + t.getMinute();
    }

    private static LocalTime time(int minutes) {
        return LocalTime.of(minutes / 60, minutes % 60);
    }
}
