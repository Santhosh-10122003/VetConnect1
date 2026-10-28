package com.vetconnect.service;

import com.vetconnect.common.LocationMatch;
import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.doctor.AvailableSlotDto;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/** Pet-care businesses: their profile, menu and hours, and how customers find them. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProviderService {

    private final ProviderProfileRepository providerRepository;
    private final CareServiceRepository serviceRepository;
    private final CareReviewRepository reviewRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final CareAvailabilityService availabilityService;
    private final AppProperties appProperties;
    private final Clock clock;

    // ================================================================== the provider's own profile

    @Transactional(readOnly = true)
    public ProviderDto getMine(Long userId) {
        return toOwnerDto(mine(userId));
    }

    /**
     * Creates the business profile of a user: used at sign-up for pet-care businesses, and by vet doctors who also
     * want to offer grooming, boarding or training. It starts as PENDING and needs the admin's approval.
     */
    @Transactional
    public ProviderDto createProfile(Long userId, ProviderRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (user.getRole() != Role.ROLE_PROVIDER && user.getRole() != Role.ROLE_DOCTOR) {
            throw new BadRequestException("Only pet-care businesses and veterinarians can offer pet-care services.");
        }
        if (providerRepository.existsByUserId(userId)) {
            throw new BadRequestException("You already have a pet-care profile.");
        }
        ProviderProfile p = ProviderProfile.builder().user(user).build();
        apply(p, request, true);
        defaultHours(p);
        p = providerRepository.save(p);
        log.info("Pet-care profile created: providerId={} userId={} categories={} city={}", p.getId(), userId, p.getCategories(), p.getCity());
        return toOwnerDto(p);
    }

    @Transactional
    public ProviderDto updateMine(Long userId, ProviderRequest request) {
        ProviderProfile p = mine(userId);
        boolean placeChanged = !same(request.getCity(), p.getCity())
                || (request.getState() != null && !same(request.getState(), p.getState()))
                || (request.getCountry() != null && !same(request.getCountry(), p.getCountry()));
        apply(p, request, false);
        if (placeChanged && request.getLatitude() == null) {
            // the old pin no longer describes the new place: the provider has to pin it again
            throw new BadRequestException("You changed the location: please pin the new spot on the map.");
        }
        p = providerRepository.save(p);
        log.info("Pet-care profile updated: providerId={} status={}", p.getId(), p.getVerificationStatus());
        return toOwnerDto(p);
    }

    @Transactional
    public ProviderDto updateHours(Long userId, HoursRequest request) {
        ProviderProfile p = mine(userId);
        Set<Integer> seen = new HashSet<>();
        for (HoursDto h : request.getHours()) {
            if (!seen.add(h.getDayOfWeek())) throw new BadRequestException("Each day can only appear once.");
            if (!h.getOpenTime().isBefore(h.getCloseTime())) {
                throw new BadRequestException("Opening time must be before closing time on day " + h.getDayOfWeek() + ".");
            }
        }
        // Update each day's row in place. Deleting and re-inserting the same day in one save would hit the
        // one-row-per-day rule, because the database applies the inserts before the deletes.
        Map<Integer, ProviderHours> existing = new HashMap<>();
        p.getHours().forEach(row -> existing.put(row.getDayOfWeek(), row));
        p.getHours().removeIf(row -> seen.stream().noneMatch(day -> day.equals(row.getDayOfWeek())));
        for (HoursDto h : request.getHours()) {
            ProviderHours row = existing.get(h.getDayOfWeek());
            if (row == null) {
                row = ProviderHours.builder().provider(p).dayOfWeek(h.getDayOfWeek()).build();
                p.getHours().add(row);
            }
            row.setOpenTime(h.getOpenTime());
            row.setCloseTime(h.getCloseTime());
            row.setIsOpen(h.getIsOpen() == null || h.getIsOpen());
        }
        p = providerRepository.save(p);
        log.info("Pet-care hours updated: providerId={} days={}", p.getId(), request.getHours().size());
        return toOwnerDto(p);
    }

    /** A rejected provider, having fixed the details, asks the admins to look again. */
    @Transactional
    public ProviderDto resubmit(Long userId, ResubmitRequest request) {
        ProviderProfile p = mine(userId);
        if (p.getVerificationStatus() != VerificationStatus.REJECTED) {
            log.warn("Provider resubmission rejected: providerId={} has status {}", p.getId(), p.getVerificationStatus());
            throw new BadRequestException("Only a rejected profile can be resubmitted for approval.");
        }
        p.setVerificationStatus(VerificationStatus.RESUBMITTED);
        p.setResubmittedAt(Instant.now(clock));
        p.setResubmitNote(request != null && hasText(request.getNote()) ? request.getNote().trim() : null);
        p = providerRepository.save(p);
        log.info("Provider resubmitted for approval: providerId={}", p.getId());

        final ProviderProfile saved = p;
        userRepository.findByRole(Role.ROLE_ADMIN).forEach(admin -> notificationService.createNotification(
                admin, "Pet-care re-approval request",
                saved.getBusinessName() + " updated its profile and asked for another review.",
                NotificationType.PROVIDER_RESUBMITTED, saved.getId().toString()));
        return toOwnerDto(p);
    }

    // ================================================================== the menu

    @Transactional(readOnly = true)
    public List<CareServiceDto> myServices(Long userId) {
        return serviceRepository.findByProviderIdOrderByCategoryAscIsAddonAscNameAsc(mine(userId).getId())
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public CareServiceDto addService(Long userId, ServiceRequest request) {
        ProviderProfile p = mine(userId);
        CareService s = CareService.builder().provider(p).build();
        applyService(s, p, request);
        s = serviceRepository.save(s);
        log.info("Care service added: serviceId={} providerId={} category={} name={}", s.getId(), p.getId(), s.getCategory(), s.getName());
        return toDto(s);
    }

    @Transactional
    public CareServiceDto updateService(Long userId, Long serviceId, ServiceRequest request) {
        ProviderProfile p = mine(userId);
        CareService s = serviceRepository.findByIdAndProviderId(serviceId, p.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
        applyService(s, p, request);
        s = serviceRepository.save(s);
        log.info("Care service updated: serviceId={} providerId={}", s.getId(), p.getId());
        return toDto(s);
    }

    /** Old bookings keep their own copy of what was ordered, so a menu entry is only switched off, never deleted. */
    @Transactional
    public void removeService(Long userId, Long serviceId) {
        ProviderProfile p = mine(userId);
        CareService s = serviceRepository.findByIdAndProviderId(serviceId, p.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
        s.setIsActive(false);
        serviceRepository.save(s);
        log.info("Care service switched off: serviceId={} providerId={}", s.getId(), p.getId());
    }

    // ================================================================== customers: finding providers

    @Transactional(readOnly = true)
    public PageResponse<ProviderDto> search(UserPrincipal viewer, CareCategory category, String query, Double radiusKm, Pageable pageable) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<ProviderProfile> candidates = providerRepository.findByVerificationStatus(VerificationStatus.APPROVED).stream()
                .filter(p -> category == null || p.getCategories().contains(category))
                .filter(p -> q.isEmpty() || p.getBusinessName().toLowerCase(Locale.ROOT).contains(q)
                        || (p.getDescription() != null && p.getDescription().toLowerCase(Locale.ROOT).contains(q))
                        || p.getCity().toLowerCase(Locale.ROOT).contains(q))
                .toList();

        List<ProviderDto> results;
        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(viewer.getId()).orElse(null);
            double radius = effectiveRadius(radiusKm);
            if (customer == null || !placeOf(customer).hasAnyLocation()) {
                log.warn("Care search: customer userId={} has no location, returning nothing", viewer.getId());
                results = List.of();
            } else {
                LocationMatch.Place me = placeOf(customer);
                results = candidates.stream()
                        .filter(p -> LocationMatch.inArea(me, placeOf(p), radius))
                        .map(p -> toDto(p, LocationMatch.distanceKm(me, placeOf(p)), category))
                        .sorted(Comparator
                                .comparing(ProviderDto::getDistanceKm, Comparator.nullsLast(Comparator.naturalOrder()))
                                .thenComparing(ProviderDto::getRatingAvg, Comparator.reverseOrder()))
                        .collect(Collectors.toList());
            }
        } else {
            results = candidates.stream().map(p -> toDto(p, null, category))
                    .sorted(Comparator.comparing(ProviderDto::getRatingAvg, Comparator.reverseOrder()))
                    .collect(Collectors.toList());
        }

        int from = (int) Math.min((long) pageable.getPageNumber() * pageable.getPageSize(), results.size());
        int to = Math.min(from + pageable.getPageSize(), results.size());
        return PageResponse.<ProviderDto>builder()
                .content(results.subList(from, to))
                .pageNumber(pageable.getPageNumber())
                .pageSize(pageable.getPageSize())
                .totalElements(results.size())
                .totalPages(pageable.getPageSize() == 0 ? 0 : (int) Math.ceil(results.size() / (double) pageable.getPageSize()))
                .last(to >= results.size())
                .build();
    }

    @Transactional(readOnly = true)
    public ProviderDto detail(Long providerId, UserPrincipal viewer) {
        ProviderProfile p = find(providerId);
        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(viewer.getId()).orElse(null);
            assertCustomerCanAccess(customer, p);
            return toDto(p, LocationMatch.distanceKm(placeOf(customer), placeOf(p)), null, true);
        }
        boolean owner = viewer != null && p.getUser().getId().equals(viewer.getId());
        if (owner || (viewer != null && viewer.getRole() == Role.ROLE_ADMIN)) return toOwnerDto(p);
        if (p.getVerificationStatus() != VerificationStatus.APPROVED) {
            throw new ResourceNotFoundException("Provider not found with ID: " + providerId);
        }
        return toDto(p, null, null, true);
    }

    @Transactional(readOnly = true)
    public List<AvailableSlotDto> slots(Long providerId, Long serviceId, LocalDate date, UserPrincipal viewer) {
        ProviderProfile p = find(providerId);
        guardCustomer(p, viewer);
        CareService s = serviceRepository.findByIdAndProviderId(serviceId, providerId)
                .filter(x -> Boolean.TRUE.equals(x.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
        if (s.getCategory() == CareCategory.BOARDING) {
            throw new BadRequestException("Boarding is booked by check-in and check-out date, not by time slot.");
        }
        return availabilityService.slots(p, sessionMinutes(s), date);
    }

    @Transactional(readOnly = true)
    public List<BoardingNightDto> boardingAvailability(Long providerId, LocalDate from, LocalDate to, UserPrincipal viewer) {
        ProviderProfile p = find(providerId);
        guardCustomer(p, viewer);
        if (!to.isAfter(from)) throw new BadRequestException("The end date must be after the start date.");
        if (from.plusDays(90).isBefore(to)) throw new BadRequestException("Please ask for at most 90 nights at a time.");
        if (!p.getCategories().contains(CareCategory.BOARDING) || p.getBoardingCapacity() <= 0) return List.of();
        return availabilityService.boardingNights(p, from, to);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewDto> reviews(Long providerId, Pageable pageable) {
        find(providerId);
        return PageResponse.of(reviewRepository.findByProviderIdOrderByCreatedAtDesc(providerId, pageable).map(this::toReviewDto));
    }

    /** A customer can open or book a provider only if it is approved and within reach (up to the maximum radius). */
    public void assertCustomerCanAccess(CustomerProfile customer, ProviderProfile provider) {
        boolean ok = customer != null
                && provider.getVerificationStatus() == VerificationStatus.APPROVED
                && LocationMatch.inArea(placeOf(customer), placeOf(provider), appProperties.getLocation().getMaxRadiusKm());
        if (!ok) {
            log.warn("Provider access denied: providerId={} is not available to customerId={}",
                    provider.getId(), customer != null ? customer.getId() : null);
            throw new ResourceNotFoundException("This provider is not available in your area.");
        }
    }

    // ================================================================== shared helpers

    public ProviderProfile find(Long providerId) {
        return providerRepository.findById(providerId)
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + providerId));
    }

    /** Minutes one session of this service takes (add-ons without a duration add nothing). */
    public int sessionMinutes(CareService s) {
        return s.getDurationMinutes() != null ? s.getDurationMinutes() : 60;
    }

    private ProviderProfile mine(Long userId) {
        return providerRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("You have not set up a pet-care profile yet."));
    }

    private void guardCustomer(ProviderProfile p, UserPrincipal viewer) {
        if (viewer != null && viewer.getRole() == Role.ROLE_CUSTOMER) {
            assertCustomerCanAccess(customerProfileRepository.findByUserId(viewer.getId()).orElse(null), p);
        }
    }

    private void apply(ProviderProfile p, ProviderRequest r, boolean creating) {
        if ((r.getLatitude() == null) != (r.getLongitude() == null)) {
            throw new BadRequestException("Latitude and longitude must be provided together.");
        }
        if (creating && r.getLatitude() == null) {
            throw new BadRequestException("Please pin your business on the map so pet owners can find and navigate to you.");
        }
        int boarding = r.getBoardingCapacity() != null ? r.getBoardingCapacity()
                : (creating ? (r.getCategories().contains(CareCategory.BOARDING) ? 5 : 0) : p.getBoardingCapacity());
        if (r.getCategories().contains(CareCategory.BOARDING) && boarding <= 0) {
            throw new BadRequestException("Boarding needs a capacity of at least 1 pet.");
        }

        p.setBusinessName(r.getBusinessName().trim());
        p.setDescription(blankToNull(r.getDescription()));
        p.setPhone(blankToNull(r.getPhone()));
        p.setRegistrationNumber(blankToNull(r.getRegistrationNumber()));
        p.setAddress(r.getAddress().trim());
        p.setCity(r.getCity().trim());
        if (r.getState() != null) p.setState(blankToNull(r.getState()));
        if (r.getCountry() != null) p.setCountry(blankToNull(r.getCountry()));
        p.setPostalCode(blankToNull(r.getPostalCode()));
        if (r.getLatitude() != null) {
            p.setLatitude(r.getLatitude());
            p.setLongitude(r.getLongitude());
        }
        p.getCategories().clear();
        p.getCategories().addAll(r.getCategories());
        if (r.getAdvancePercent() != null) p.setAdvancePercent(r.getAdvancePercent());
        if (r.getConcurrentCapacity() != null) p.setConcurrentCapacity(r.getConcurrentCapacity());
        p.setBoardingCapacity(boarding);
        if (r.getSlotMinutes() != null) p.setSlotMinutes(r.getSlotMinutes());
        if (r.getAvatarUrl() != null) p.setAvatarUrl(blankToNull(r.getAvatarUrl()));
    }

    private void applyService(CareService s, ProviderProfile p, ServiceRequest r) {
        if (!p.getCategories().contains(r.getCategory())) {
            throw new BadRequestException("Turn on " + r.getCategory().name().toLowerCase(Locale.ROOT)
                    + " in your business profile before adding services for it.");
        }
        boolean boarding = r.getCategory() == CareCategory.BOARDING;
        boolean addon = Boolean.TRUE.equals(r.getIsAddon());
        if (!boarding && !addon && r.getDurationMinutes() == null) {
            throw new BadRequestException("Say how long one session takes.");
        }
        s.setCategory(r.getCategory());
        s.setName(r.getName().trim());
        s.setDescription(blankToNull(r.getDescription()));
        // boarding is always priced per night; everything else per session
        s.setPricingUnit(boarding && !addon ? PricingUnit.PER_NIGHT : PricingUnit.PER_SESSION);
        s.setDurationMinutes(boarding ? null : r.getDurationMinutes());
        s.setPriceSmall(r.getPriceSmall());
        s.setPriceMedium(r.getPriceMedium());
        s.setPriceLarge(r.getPriceLarge());
        s.setPriceGiant(r.getPriceGiant());
        s.setIsAddon(addon);
        s.setIsActive(r.getIsActive() == null || r.getIsActive());
    }

    private static void defaultHours(ProviderProfile p) {
        p.getHours().clear();
        for (int day = 1; day <= 7; day++) {
            p.getHours().add(ProviderHours.builder().provider(p).dayOfWeek(day)
                    .openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(day <= 6).build());
        }
    }

    private double effectiveRadius(Double requested) {
        AppProperties.Location cfg = appProperties.getLocation();
        if (requested == null) return cfg.getDefaultRadiusKm();
        return Math.max(1, Math.min(requested, cfg.getMaxRadiusKm()));
    }

    static LocationMatch.Place placeOf(CustomerProfile c) {
        return new LocationMatch.Place(c.getCity(), c.getState(), c.getCountry(), c.getLatitude(), c.getLongitude());
    }

    static LocationMatch.Place placeOf(ProviderProfile p) {
        return new LocationMatch.Place(p.getCity(), p.getState(), p.getCountry(), p.getLatitude(), p.getLongitude());
    }

    // ================================================================== mapping

    public CareServiceDto toDto(CareService s) {
        return CareServiceDto.builder()
                .id(s.getId()).providerId(s.getProvider().getId()).category(s.getCategory()).name(s.getName())
                .description(s.getDescription()).pricingUnit(s.getPricingUnit()).durationMinutes(s.getDurationMinutes())
                .priceSmall(s.getPriceSmall()).priceMedium(s.getPriceMedium()).priceLarge(s.getPriceLarge()).priceGiant(s.getPriceGiant())
                .isAddon(s.getIsAddon()).isActive(s.getIsActive())
                .build();
    }

    public ReviewDto toReviewDto(CareReview r) {
        return ReviewDto.builder()
                .id(r.getId()).bookingId(r.getBooking().getId()).customerName(r.getCustomer().getFullName())
                .rating(r.getRating()).comment(r.getComment()).createdAt(r.getCreatedAt())
                .build();
    }

    /** Customer view: only active services, nothing about the admin review. */
    public ProviderDto toDto(ProviderProfile p, Double distanceKm, CareCategory fromPriceCategory) {
        return toDto(p, distanceKm, fromPriceCategory, false);
    }

    public ProviderDto toDto(ProviderProfile p, Double distanceKm, CareCategory fromPriceCategory, boolean withServices) {
        List<CareService> active = serviceRepository.findByProviderIdAndIsActiveTrueOrderByCategoryAscIsAddonAscNameAsc(p.getId());
        BigDecimal from = active.stream()
                .filter(s -> !Boolean.TRUE.equals(s.getIsAddon()))
                .filter(s -> fromPriceCategory == null || s.getCategory() == fromPriceCategory)
                .map(CareService::getPriceSmall)
                .min(Comparator.naturalOrder()).orElse(null);
        ProviderDto.ProviderDtoBuilder b = baseDto(p).distanceKm(distanceKm).fromPrice(from);
        if (withServices) {
            b.services(active.stream().map(this::toDto).collect(Collectors.toList()));
            b.hours(hoursDto(p));
        }
        return b.build();
    }

    /** Owner and admin view: every service (including switched-off ones), hours, settings and the review notes. */
    public ProviderDto toOwnerDto(ProviderProfile p) {
        return baseDto(p)
                .registrationNumber(p.getRegistrationNumber())
                .services(serviceRepository.findByProviderIdOrderByCategoryAscIsAddonAscNameAsc(p.getId()).stream().map(this::toDto).collect(Collectors.toList()))
                .hours(hoursDto(p))
                .verificationReason(p.getVerificationReason())
                .reviewedAt(p.getReviewedAt())
                .resubmittedAt(p.getResubmittedAt())
                .resubmitNote(p.getResubmitNote())
                .email(p.getUser().getEmail())
                .build();
    }

    private ProviderDto.ProviderDtoBuilder baseDto(ProviderProfile p) {
        return ProviderDto.builder()
                .id(p.getId()).userId(p.getUser().getId()).businessName(p.getBusinessName()).description(p.getDescription())
                .phone(p.getPhone()).address(p.getAddress()).city(p.getCity()).state(p.getState()).country(p.getCountry())
                .postalCode(p.getPostalCode()).latitude(p.getLatitude()).longitude(p.getLongitude())
                .categories(new LinkedHashSet<>(p.getCategories()))
                .ratingAvg(p.getRatingAvg()).reviewCount(p.getReviewCount()).advancePercent(p.getAdvancePercent())
                .boardingCapacity(p.getBoardingCapacity()).concurrentCapacity(p.getConcurrentCapacity()).slotMinutes(p.getSlotMinutes())
                .avatarUrl(p.getAvatarUrl()).verificationStatus(p.getVerificationStatus());
    }

    private static List<HoursDto> hoursDto(ProviderProfile p) {
        return p.getHours().stream()
                .sorted(Comparator.comparing(ProviderHours::getDayOfWeek))
                .map(h -> HoursDto.builder().dayOfWeek(h.getDayOfWeek()).openTime(h.getOpenTime()).closeTime(h.getCloseTime()).isOpen(h.getIsOpen()).build())
                .collect(Collectors.toList());
    }

    private static boolean same(String a, String b) {
        return (a == null ? "" : a.trim()).equalsIgnoreCase(b == null ? "" : b.trim());
    }

    private static boolean hasText(String v) {
        return v != null && !v.isBlank();
    }

    private static String blankToNull(String v) {
        return hasText(v) ? v.trim() : null;
    }
}
