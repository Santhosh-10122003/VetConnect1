package com.vetconnect.service;

import com.vetconnect.common.LocationMatch;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.Appointment;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.DoctorAvailability;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.dto.doctor.DoctorAvailabilityDto;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.dto.doctor.UpdateDoctorProfileRequest;
import com.vetconnect.repository.AppointmentRepository;
import com.vetconnect.repository.CustomerProfileRepository;
import com.vetconnect.repository.DoctorAvailabilityRepository;
import com.vetconnect.repository.DoctorProfileRepository;
import com.vetconnect.repository.SpecializationRepository;
import com.vetconnect.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorProfileRepository doctorProfileRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final SpecializationRepository specializationRepository;
    private final AppointmentRepository appointmentRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AppProperties appProperties;

    // ------------------------------------------------------------------ discovery (location aware)

    /**
     * Customers only get veterinarians in their own area; admins and doctors see everyone approved.
     *
     * @param radiusKm search radius used when both the customer and a clinic have GPS coordinates
     */
    @Transactional(readOnly = true)
    public PageResponse<DoctorProfileDto> searchDoctors(UserPrincipal viewer,
                                                        String query,
                                                        Long specializationId,
                                                        BigDecimal maxFee,
                                                        BigDecimal minRating,
                                                        Double radiusKm,
                                                        Pageable pageable) {
        List<DoctorProfile> candidates = doctorProfileRepository.searchDoctors(
                VerificationStatus.APPROVED,
                query != null && !query.isBlank() ? query.trim() : null,
                specializationId,
                maxFee,
                minRating,
                Pageable.unpaged()
        ).getContent();

        List<DoctorProfileDto> results;
        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(viewer.getId()).orElse(null);
            double radius = effectiveRadius(radiusKm);
            if (customer == null || (!hasText(customer.getCity()) && !hasCoordinates(customer))) {
                log.warn("Doctor search: customer userId={} has no location, returning nothing", viewer.getId());
                results = List.of();
            } else {
                results = candidates.stream()
                        .filter(d -> isInServiceArea(customer, d, radius))
                        .map(d -> toDto(d, distanceKm(customer, d)))
                        .sorted(Comparator
                                .comparing(DoctorProfileDto::getDistanceKm, Comparator.nullsLast(Comparator.naturalOrder()))
                                .thenComparing(DoctorProfileDto::getRatingAvg, Comparator.reverseOrder()))
                        .collect(Collectors.toList());
                log.debug("Doctor search for customerId={} city={} radius={}km: {} of {} doctors in range",
                        customer.getId(), customer.getCity(), radius, results.size(), candidates.size());
            }
        } else {
            results = candidates.stream()
                    .map(d -> toDto(d, null))
                    .sorted(Comparator.comparing(DoctorProfileDto::getRatingAvg, Comparator.reverseOrder()))
                    .collect(Collectors.toList());
        }

        int from = (int) Math.min((long) pageable.getPageNumber() * pageable.getPageSize(), results.size());
        int to = Math.min(from + pageable.getPageSize(), results.size());
        int totalPages = pageable.getPageSize() == 0 ? 0 : (int) Math.ceil(results.size() / (double) pageable.getPageSize());
        return PageResponse.<DoctorProfileDto>builder()
                .content(results.subList(from, to))
                .pageNumber(pageable.getPageNumber())
                .pageSize(pageable.getPageSize())
                .totalElements(results.size())
                .totalPages(totalPages)
                .last(to >= results.size())
                .build();
    }

    @Transactional(readOnly = true)
    public DoctorProfileDto getDoctorById(Long doctorId, UserPrincipal viewer) {
        DoctorProfile doctor = doctorProfileRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + doctorId));

        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(viewer.getId()).orElse(null);
            assertCustomerCanAccess(customer, doctor);
            return toDto(doctor, distanceKm(customer, doctor));
        }
        return toDto(doctor, null);
    }

    @Transactional(readOnly = true)
    public List<AvailableSlotDto> getAvailableSlots(Long doctorId, LocalDate date, UserPrincipal viewer) {
        DoctorProfile doctor = doctorProfileRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + doctorId));
        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            assertCustomerCanAccess(customerProfileRepository.findByUserId(viewer.getId()).orElse(null), doctor);
        }
        return computeSlots(doctor, date);
    }

    /**
     * A customer may only open or book a veterinarian that is approved and inside their reach
     * (the same set the search can return, i.e. up to the maximum radius).
     */
    public void assertCustomerCanAccess(CustomerProfile customer, DoctorProfile doctor) {
        boolean ok = customer != null
                && doctor.getVerificationStatus() == VerificationStatus.APPROVED
                && isInServiceArea(customer, doctor, appProperties.getLocation().getMaxRadiusKm());
        if (!ok) {
            log.warn("Doctor access denied: doctorId={} is not available to customerId={}",
                    doctor.getId(), customer != null ? customer.getId() : null);
            throw new ResourceNotFoundException("This veterinarian is not available in your area.");
        }
    }

    /** The shared rule (see LocationMatch): a pin on both sides decides by distance, otherwise the place names must agree. */
    boolean isInServiceArea(CustomerProfile customer, DoctorProfile doctor, double radiusKm) {
        return LocationMatch.inArea(placeOf(customer), placeOf(doctor), radiusKm);
    }

    private Double distanceKm(CustomerProfile customer, DoctorProfile doctor) {
        return customer == null ? null : LocationMatch.distanceKm(placeOf(customer), placeOf(doctor));
    }

    private static LocationMatch.Place placeOf(CustomerProfile c) {
        return new LocationMatch.Place(c.getCity(), c.getState(), c.getCountry(), c.getLatitude(), c.getLongitude());
    }

    private static LocationMatch.Place placeOf(DoctorProfile d) {
        return new LocationMatch.Place(d.getClinicCity(), d.getClinicState(), d.getClinicCountry(), d.getLatitude(), d.getLongitude());
    }

    private static boolean sameText(String a, String b) {
        return (a == null ? "" : a.trim()).equalsIgnoreCase(b == null ? "" : b.trim());
    }

    private double effectiveRadius(Double requested) {
        AppProperties.Location cfg = appProperties.getLocation();
        if (requested == null) return cfg.getDefaultRadiusKm();
        return Math.max(1, Math.min(requested, cfg.getMaxRadiusKm()));
    }

    // ------------------------------------------------------------------ doctor's own profile

    @Transactional(readOnly = true)
    public DoctorProfileDto getDoctorByUserId(Long userId) {
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for user ID: " + userId));
        return toOwnerDto(doctor);
    }

    @Transactional
    public DoctorProfileDto updateDoctorProfile(Long userId, UpdateDoctorProfileRequest request) {
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for user ID: " + userId));

        if ((request.getLatitude() == null) != (request.getLongitude() == null)) {
            throw new BadRequestException("Latitude and longitude must be provided together.");
        }

        doctor.setFullName(request.getFullName());
        if (request.getPhone() != null) doctor.getUser().setPhone(request.getPhone());
        doctor.setClinicName(request.getClinicName());
        doctor.setClinicAddress(request.getClinicAddress());

        boolean cityChanged = !sameText(request.getClinicCity(), doctor.getClinicCity())
                || (request.getClinicState() != null && !sameText(request.getClinicState(), doctor.getClinicState()))
                || (request.getClinicCountry() != null && !sameText(request.getClinicCountry(), doctor.getClinicCountry()));
        doctor.setClinicCity(request.getClinicCity().trim());
        if (request.getClinicState() != null) doctor.setClinicState(hasText(request.getClinicState()) ? request.getClinicState().trim() : null);
        if (request.getClinicCountry() != null) doctor.setClinicCountry(hasText(request.getClinicCountry()) ? request.getClinicCountry().trim() : null);
        doctor.setClinicPostalCode(hasText(request.getClinicPostalCode()) ? request.getClinicPostalCode().trim() : null);
        if (request.getLatitude() != null) {
            doctor.setLatitude(request.getLatitude());
            doctor.setLongitude(request.getLongitude());
        } else if (cityChanged) {
            // Old GPS position no longer describes the new city.
            doctor.setLatitude(null);
            doctor.setLongitude(null);
        }

        doctor.setYearsOfExperience(request.getYearsOfExperience());
        doctor.setConsultationFee(request.getConsultationFee());
        if (request.getBio() != null) doctor.setBio(request.getBio());
        if (request.getAvatarUrl() != null) doctor.setAvatarUrl(request.getAvatarUrl());

        if (request.getSpecializationIds() != null) {
            doctor.getSpecializations().clear();
            doctor.getSpecializations().addAll(specializationRepository.findAllById(request.getSpecializationIds()));
        }

        if (request.getAvailabilities() != null) {
            replaceAvailabilities(doctor, request.getAvailabilities());
        }

        doctor = doctorProfileRepository.save(doctor);
        log.info("Doctor profile updated: doctorId={} status={} city={}", doctor.getId(), doctor.getVerificationStatus(), doctor.getClinicCity());
        return toOwnerDto(doctor);
    }

    /** Replaces the weekly schedule without touching any profile field. */
    @Transactional
    public DoctorProfileDto updateAvailability(Long userId, List<DoctorAvailabilityDto> availabilities) {
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for user ID: " + userId));
        replaceAvailabilities(doctor, availabilities);
        doctor = doctorProfileRepository.save(doctor);
        log.info("Doctor availability updated: doctorId={} days={}", doctor.getId(), availabilities.size());
        return toOwnerDto(doctor);
    }

    private void replaceAvailabilities(DoctorProfile doctor, List<DoctorAvailabilityDto> dtos) {
        availabilityRepository.deleteAll(doctor.getAvailabilities());
        doctor.getAvailabilities().clear();
        for (DoctorAvailabilityDto dto : dtos) {
            DoctorAvailability avail = DoctorAvailability.builder()
                    .doctor(doctor)
                    .dayOfWeek(dto.getDayOfWeek())
                    .startTime(dto.getStartTime())
                    .endTime(dto.getEndTime())
                    .slotDurationMinutes(dto.getSlotDurationMinutes() != null ? dto.getSlotDurationMinutes() : 30)
                    .breakStartTime(dto.getBreakStartTime())
                    .breakEndTime(dto.getBreakEndTime())
                    .isActive(Boolean.TRUE.equals(dto.getIsActive()))
                    .build();
            doctor.getAvailabilities().add(avail);
        }
    }

    /** A rejected doctor, having fixed their details, asks the admins to review the profile again. */
    @Transactional
    public DoctorProfileDto resubmitForApproval(Long userId, ResubmitRequest request) {
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for user ID: " + userId));

        if (doctor.getVerificationStatus() != VerificationStatus.REJECTED) {
            log.warn("Resubmission rejected: doctorId={} has status {}", doctor.getId(), doctor.getVerificationStatus());
            throw new BadRequestException("Only a rejected profile can be resubmitted for approval.");
        }

        doctor.setVerificationStatus(VerificationStatus.RESUBMITTED);
        doctor.setResubmittedAt(Instant.now());
        doctor.setResubmitNote(request != null && hasText(request.getNote()) ? request.getNote().trim() : null);
        doctor = doctorProfileRepository.save(doctor);
        log.info("Doctor resubmitted for approval: doctorId={}", doctor.getId());

        final DoctorProfile saved = doctor;
        userRepository.findByRole(Role.ROLE_ADMIN).forEach(admin -> notificationService.createNotification(
                admin,
                "Doctor re-approval request",
                saved.getFullName() + " updated their profile and asked for another review.",
                NotificationType.DOCTOR_RESUBMITTED,
                saved.getId().toString()));

        return toOwnerDto(doctor);
    }

    // ------------------------------------------------------------------ slots

    private List<AvailableSlotDto> computeSlots(DoctorProfile doctor, LocalDate date) {
        Long doctorId = doctor.getId();
        int dayOfWeek = date.getDayOfWeek().getValue(); // 1=Mon, 7=Sun

        Optional<DoctorAvailability> availOpt = availabilityRepository.findByDoctorIdAndDayOfWeek(doctorId, dayOfWeek);
        if (availOpt.isEmpty() || !Boolean.TRUE.equals(availOpt.get().getIsActive())) {
            return Collections.emptyList();
        }

        DoctorAvailability avail = availOpt.get();
        int slotDuration = avail.getSlotDurationMinutes();

        // Existing active appointments on that day for that doctor
        List<Appointment> bookedAppointments = appointmentRepository.findByDoctorIdAndAppointmentDateAndStatusNotIn(
                doctorId, date, AppointmentStatus.SLOT_RELEASED
        );
        Set<LocalTime> bookedStartTimes = bookedAppointments.stream()
                .map(Appointment::getStartTime)
                .collect(Collectors.toSet());

        List<AvailableSlotDto> slots = new ArrayList<>();
        LocalTime current = avail.getStartTime();
        LocalTime end = avail.getEndTime();

        while (current.plusMinutes(slotDuration).isBefore(end) || current.plusMinutes(slotDuration).equals(end)) {
            LocalTime slotEnd = current.plusMinutes(slotDuration);

            // Check if slot falls into doctor's break time
            boolean isInBreak = false;
            if (avail.getBreakStartTime() != null && avail.getBreakEndTime() != null) {
                if (!(current.isBefore(avail.getBreakStartTime()) && slotEnd.isBefore(avail.getBreakStartTime())) &&
                    !(current.isAfter(avail.getBreakEndTime()) || current.equals(avail.getBreakEndTime()))) {
                    isInBreak = true;
                }
            }

            // Check if slot is in the past for today
            boolean isPast = date.equals(LocalDate.now()) && current.isBefore(LocalTime.now());

            boolean isAvailable = !isInBreak && !isPast && !bookedStartTimes.contains(current);

            slots.add(AvailableSlotDto.builder()
                    .date(date)
                    .startTime(current)
                    .endTime(slotEnd)
                    .available(isAvailable)
                    .build());

            current = slotEnd;
        }
        return slots;
    }

    // ------------------------------------------------------------------ mapping

    /** Public view (customers): never includes the admin's review notes. */
    public DoctorProfileDto toDto(DoctorProfile d) {
        return toDto(d, null);
    }

    public DoctorProfileDto toDto(DoctorProfile d, Double distanceKm) {
        return baseDto(d).distanceKm(distanceKm).build();
    }

    /** View for the doctor themself and for admins: adds the review reason and re-approval details. */
    public DoctorProfileDto toOwnerDto(DoctorProfile d) {
        return baseDto(d)
                .verificationReason(d.getVerificationReason())
                .reviewedAt(d.getReviewedAt())
                .resubmittedAt(d.getResubmittedAt())
                .resubmitNote(d.getResubmitNote())
                .build();
    }

    private DoctorProfileDto.DoctorProfileDtoBuilder baseDto(DoctorProfile d) {
        return DoctorProfileDto.builder()
                .id(d.getId())
                .userId(d.getUser() != null ? d.getUser().getId() : null)
                .email(d.getUser() != null ? d.getUser().getEmail() : null)
                .phone(d.getUser() != null ? d.getUser().getPhone() : null)
                .fullName(d.getFullName())
                .licenseNumber(d.getLicenseNumber())
                .clinicName(d.getClinicName())
                .clinicAddress(d.getClinicAddress())
                .clinicCity(d.getClinicCity())
                .clinicPostalCode(d.getClinicPostalCode())
                .clinicState(d.getClinicState())
                .clinicCountry(d.getClinicCountry())
                .latitude(d.getLatitude())
                .longitude(d.getLongitude())
                .yearsOfExperience(d.getYearsOfExperience())
                .consultationFee(d.getConsultationFee())
                .bio(d.getBio())
                .ratingAvg(d.getRatingAvg())
                .reviewCount(d.getReviewCount())
                .verificationStatus(d.getVerificationStatus())
                .avatarUrl(d.getAvatarUrl())
                .specializations(d.getSpecializations().stream()
                        .map(s -> new DoctorProfileDto.SpecializationDto(s.getId(), s.getName(), s.getDescription(), s.getIconName()))
                        .collect(Collectors.toList()))
                .availabilities(d.getAvailabilities().stream()
                        .map(a -> DoctorAvailabilityDto.builder()
                                .id(a.getId())
                                .dayOfWeek(a.getDayOfWeek())
                                .startTime(a.getStartTime())
                                .endTime(a.getEndTime())
                                .slotDurationMinutes(a.getSlotDurationMinutes())
                                .breakStartTime(a.getBreakStartTime())
                                .breakEndTime(a.getBreakEndTime())
                                .isActive(a.getIsActive())
                                .build())
                        .collect(Collectors.toList()));
    }

    private static boolean hasText(String v) {
        return v != null && !v.isBlank();
    }

    private static boolean hasCoordinates(CustomerProfile c) {
        return c.getLatitude() != null && c.getLongitude() != null;
    }
}
