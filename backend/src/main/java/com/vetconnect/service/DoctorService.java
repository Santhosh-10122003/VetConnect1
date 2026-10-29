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
    private final com.vetconnect.repository.DoctorBlockedSlotRepository blockedSlotRepository;

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

        applyPayout(doctor, request);
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

    /** Where the doctor is paid is mandatory; sending nothing is fine only when complete details are already saved. */
    private void applyPayout(DoctorProfile doctor, UpdateDoctorProfileRequest r) {
        boolean sent = com.vetconnect.common.PayoutRules.anySent(r.getPayoutMethod(), r.getUpiId(), r.getAccountHolderName(), r.getBankAccountNumber(), r.getIfscCode(), r.getBankName());
        if (!sent) {
            if (doctor.isPayoutComplete()) return;
            throw new BadRequestException(com.vetconnect.common.PayoutRules.REQUIRED_MESSAGE);
        }
        var f = com.vetconnect.common.PayoutRules.normalize(r.getPayoutMethod(), r.getUpiId(), r.getAccountHolderName(), r.getBankAccountNumber(),
                r.getIfscCode(), r.getBankName(), doctor.getPayoutMethod(), doctor.getBankAccountNumber());
        doctor.setPayoutMethod(f.method());
        doctor.setUpiId(f.upiId());
        doctor.setAccountHolderName(f.holder());
        doctor.setBankAccountNumber(f.account());
        doctor.setIfscCode(f.ifsc());
        doctor.setBankName(f.bankName());
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

    /** One slot of a doctor's working day, before anything is booked or blocked. */
    private record Cell(LocalTime start, LocalTime end, boolean inBreak, boolean past) {
    }

    private List<Cell> grid(DoctorProfile doctor, LocalDate date) {
        int dayOfWeek = date.getDayOfWeek().getValue(); // 1=Mon, 7=Sun
        Optional<DoctorAvailability> availOpt = availabilityRepository.findByDoctorIdAndDayOfWeek(doctor.getId(), dayOfWeek);
        if (availOpt.isEmpty() || !Boolean.TRUE.equals(availOpt.get().getIsActive())) {
            return Collections.emptyList();
        }
        DoctorAvailability avail = availOpt.get();
        int slotDuration = avail.getSlotDurationMinutes();

        List<Cell> cells = new ArrayList<>();
        LocalTime current = avail.getStartTime();
        LocalTime end = avail.getEndTime();
        while (current.plusMinutes(slotDuration).isBefore(end) || current.plusMinutes(slotDuration).equals(end)) {
            LocalTime slotEnd = current.plusMinutes(slotDuration);

            // Check if slot falls into doctor's break time
            // a slot is in the break only if it overlaps it (one that ends exactly when the break starts is fine)
            boolean isInBreak = avail.getBreakStartTime() != null && avail.getBreakEndTime() != null
                    && current.isBefore(avail.getBreakEndTime()) && slotEnd.isAfter(avail.getBreakStartTime());
            boolean isPast = date.equals(LocalDate.now()) && current.isBefore(LocalTime.now());
            cells.add(new Cell(current, slotEnd, isInBreak, isPast));
            current = slotEnd;
        }
        return cells;
    }

    private List<AvailableSlotDto> computeSlots(DoctorProfile doctor, LocalDate date) {
        Set<LocalTime> bookedStartTimes = appointmentRepository.findByDoctorIdAndAppointmentDateAndStatusNotIn(
                        doctor.getId(), date, AppointmentStatus.SLOT_RELEASED).stream()
                .map(Appointment::getStartTime)
                .collect(Collectors.toSet());
        Set<LocalTime> blocked = blockedSlotRepository.findByDoctorIdAndDate(doctor.getId(), date).stream()
                .map(com.vetconnect.domain.entities.DoctorBlockedSlot::getStartTime)
                .collect(Collectors.toSet());

        return grid(doctor, date).stream()
                .map(c -> AvailableSlotDto.builder()
                        .date(date).startTime(c.start()).endTime(c.end())
                        .available(!c.inBreak() && !c.past() && !bookedStartTimes.contains(c.start()) && !blocked.contains(c.start()))
                        .build())
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------ the doctor's own view of a day, and blocking slots

    private static final int MAX_DAYS_AHEAD = 180;

    /** True when the doctor has marked that slot as booked themselves (customers cannot take it). */
    @Transactional(readOnly = true)
    public boolean isSlotBlocked(Long doctorId, LocalDate date, LocalTime start) {
        return blockedSlotRepository.existsByDoctorIdAndDateAndStartTime(doctorId, date, start);
    }

    /**
     * Every slot of the day with what is on it: free, booked by a customer, marked as booked by the doctor, a break
     * or already past. Customer bookings can never be changed from here.
     */
    @Transactional(readOnly = true)
    public List<com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto> getMySchedule(Long userId, LocalDate date) {
        DoctorProfile doctor = ownDoctor(userId);
        return schedule(doctor, date);
    }

    private List<com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto> schedule(DoctorProfile doctor, LocalDate date) {
        Map<LocalTime, Appointment> booked = new HashMap<>();
        appointmentRepository.findByDoctorIdAndAppointmentDateAndStatusNotIn(doctor.getId(), date, AppointmentStatus.SLOT_RELEASED)
                .forEach(a -> booked.put(a.getStartTime(), a));
        Map<LocalTime, com.vetconnect.domain.entities.DoctorBlockedSlot> blocked = new HashMap<>();
        blockedSlotRepository.findByDoctorIdAndDate(doctor.getId(), date).forEach(b -> blocked.put(b.getStartTime(), b));

        List<com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto> out = new ArrayList<>();
        for (Cell c : grid(doctor, date)) {
            var dto = com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto.builder().date(date).startTime(c.start()).endTime(c.end());
            Appointment appt = booked.get(c.start());
            var block = blocked.get(c.start());
            if (appt != null) {
                boolean awaiting = appt.getStatus() == AppointmentStatus.AWAITING_PAYMENT;
                dto.status(com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus.BOOKED).appointmentStatus(appt.getStatus().name())
                        .note(awaiting ? "Held while the customer pays the advance" : "Booked by a customer");
                if (!awaiting) {
                    dto.appointmentId(appt.getId()).reference(appt.getBookingReference()).petName(appt.getPet().getName())
                            .customerName(appt.getCustomer().getFullName())
                            .customerPhone(appt.getCustomer().getUser() != null ? appt.getCustomer().getUser().getPhone() : null);
                }
            } else if (block != null) {
                dto.status(com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus.BLOCKED).blockId(block.getId()).reason(block.getReason())
                        .blockedForName(block.getCustomerName()).blockedForPhone(block.getCustomerPhone())
                        .note("Marked as booked by you").canUnblock(true);
            } else if (c.inBreak()) {
                dto.status(com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus.BREAK);
            } else if (c.past()) {
                dto.status(com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus.PAST);
            } else {
                dto.status(com.vetconnect.dto.doctor.DoctorScheduleDtos.SlotStatus.AVAILABLE).canBlock(!date.isBefore(LocalDate.now()));
            }
            out.add(dto.build());
        }
        return out;
    }

    /** Marks a free slot as booked by the doctor. A slot a customer holds cannot be taken over. */
    @Transactional
    public com.vetconnect.dto.doctor.DoctorScheduleDtos.ScheduleSlotDto blockSlot(Long userId, com.vetconnect.dto.doctor.DoctorScheduleDtos.BlockSlotRequest request) {
        DoctorProfile doctor = ownDoctor(userId);
        LocalDate date = request.getDate();
        if (date.isBefore(LocalDate.now())) throw new BadRequestException("You cannot change a day that has already passed.");
        if (date.isAfter(LocalDate.now().plusDays(MAX_DAYS_AHEAD))) throw new BadRequestException("You can only change the next " + MAX_DAYS_AHEAD + " days.");

        Cell cell = grid(doctor, date).stream().filter(c -> c.start().equals(request.getStartTime())).findFirst()
                .orElseThrow(() -> new BadRequestException("That is not one of your slots on that day."));
        if (appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(doctor.getId(), date, cell.start(), AppointmentStatus.SLOT_RELEASED)) {
            log.warn("Block refused: slot {} {} of doctorId={} is booked by a customer", date, cell.start(), doctor.getId());
            throw new com.vetconnect.common.exceptions.BookingConflictException("This slot is booked by a customer, so it cannot be changed.");
        }
        if (blockedSlotRepository.existsByDoctorIdAndDateAndStartTime(doctor.getId(), date, cell.start())) {
            throw new BadRequestException("You already marked this slot as booked.");
        }
        if (cell.inBreak()) throw new BadRequestException("That time is already your break.");
        if (cell.past()) throw new BadRequestException("That time has already passed.");

        String reason = request.getReason() == null || request.getReason().isBlank() ? null : request.getReason().trim();
        String forName = request.getCustomerName() == null || request.getCustomerName().isBlank() ? null : request.getCustomerName().trim();
        String forPhone = request.getCustomerPhone() == null || request.getCustomerPhone().isBlank() ? null : request.getCustomerPhone().trim();
        if ((forName == null) != (forPhone == null)) throw new BadRequestException("Enter both the customer name and mobile number, or leave both empty.");
        if (forPhone != null) {
            forPhone = com.vetconnect.common.PhoneNumbers.normalize(forPhone);
        }
        blockedSlotRepository.save(com.vetconnect.domain.entities.DoctorBlockedSlot.builder()
                .doctor(doctor).date(date).startTime(cell.start()).endTime(cell.end()).reason(reason).customerName(forName).customerPhone(forPhone).build());
        log.info("Slot blocked by the doctor: doctorId={} {} {}", doctor.getId(), date, cell.start());
        return schedule(doctor, date).stream().filter(x -> x.getStartTime().equals(cell.start())).findFirst().orElseThrow();
    }

    /** Undoes a block the doctor made. Only their own blocks can be undone: a customer's booking is never one. */
    @Transactional
    public void unblockSlot(Long userId, Long blockId) {
        DoctorProfile doctor = ownDoctor(userId);
        var block = blockedSlotRepository.findByIdAndDoctorId(blockId, doctor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("That slot was not marked as booked by you."));
        blockedSlotRepository.delete(block);
        log.info("Slot unblocked by the doctor: doctorId={} {} {}", doctor.getId(), block.getDate(), block.getStartTime());
    }

    private DoctorProfile ownDoctor(Long userId) {
        return doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for user ID: " + userId));
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
                .payoutMethod(d.getPayoutMethod()).upiId(d.getUpiId()).accountHolderName(d.getAccountHolderName())
                .bankAccountMasked(com.vetconnect.common.PayoutRules.mask(d.getBankAccountNumber())).ifscCode(d.getIfscCode()).bankName(d.getBankName())
                .payoutComplete(d.isPayoutComplete())
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
