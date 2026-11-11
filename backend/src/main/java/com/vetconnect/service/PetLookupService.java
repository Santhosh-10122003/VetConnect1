package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.TooManyRequestsException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.dto.pet.PetOwnerLookupDto;
import com.vetconnect.repository.PetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * "Find a pet's owner": someone who found a pet types its ID number and gets the owner's name, mobile number and address
 * so they can return it. That is personal information, so it is kept hard to abuse: the numbers are long and random,
 * a person can only try a few per hour, every lookup is logged, and the owner is told that their pet's number was looked up.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PetLookupService {

    static final int MAX_PER_HOUR = 10;
    private static final long HOUR_MS = 3_600_000L;

    private final PetRepository petRepository;
    private final NotificationService notificationService;
    private final Clock clock;
    private final Map<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

    /** A QR scan needs no sign-in, so it is limited by where it comes from instead (a little more room: a family may scan several tags). */
    static final int MAX_SCANS_PER_HOUR = 20;

    private void throttle(String key, int max) {
        long now = clock.millis();
        Deque<Long> q = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > HOUR_MS) q.pollFirst();
            if (q.size() >= max) {
                log.warn("Pet lookup throttled: {}", key);
                throw new TooManyRequestsException("Too many lookups from here. Please try again in an hour.");
            }
            q.addLast(now);
        }
    }

    /** A signed-in person typing a number. */
    @Transactional
    public PetOwnerLookupDto find(Long userId, String rawNumber) {
        return lookup("user:" + userId, MAX_PER_HOUR, rawNumber, "entered");
    }

    /** Someone who scanned the pet's QR code: no account needed, so it is limited by where the request comes from. */
    @Transactional
    public PetOwnerLookupDto scan(String clientAddress, String rawNumber) {
        return lookup("scan:" + clientAddress, MAX_SCANS_PER_HOUR, rawNumber, "scanned");
    }

    private PetOwnerLookupDto lookup(String key, int max, String rawNumber, String how) {
        String number = rawNumber == null ? "" : rawNumber.replaceAll("[\\s-]", "");
        if (!number.matches("\\d{15}")) throw new BadRequestException("Enter the 15-digit pet ID number.");
        throttle(key, max);

        Pet pet = petRepository.findByMicrochipNumber(number).orElse(null);
        if (pet == null) {
            log.info("Pet lookup: {} found nothing", key);
            throw new ResourceNotFoundException("No pet was found with that number. Check it and try again.");
        }
        CustomerProfile owner = pet.getCustomer();
        User ownerUser = owner.getUser();
        log.info("Pet lookup: {} {} petId={}", key, how, pet.getId());
        notificationService.createNotification(ownerUser, "Someone " + how + " " + pet.getName() + "'s QR code or ID number",
                "Someone " + how + " " + pet.getName() + "'s number to find you. If your pet is missing, they may be calling you.",
                NotificationType.GENERAL, String.valueOf(pet.getId()));

        String address = Stream.of(owner.getAddress(), owner.getCity(), owner.getState(), owner.getCountry(), owner.getPostalCode())
                .filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(", "));
        return PetOwnerLookupDto.builder()
                .petName(pet.getName()).species(pet.getSpecies() == null ? null : pet.getSpecies().name()).breed(pet.getBreed()).avatarUrl(pet.getAvatarUrl())
                .ownerName(owner.getFullName()).ownerPhone(ownerUser.getPhone()).ownerAddress(address.isEmpty() ? null : address)
                .build();
    }
}
