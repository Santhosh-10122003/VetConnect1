package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.care.CareDtos.SimulatePaymentRequest.Outcome;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Grooming, boarding and training bookings: pricing, capacity, the advance payment, and what the customer and the
 * provider can do with a booking afterwards.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CareBookingService {

    private static final Random RANDOM = new Random();

    private final CareBookingRepository bookingRepository;
    private final ProviderProfileRepository providerRepository;
    private final CareServiceRepository serviceRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PetRepository petRepository;
    private final CareReviewRepository reviewRepository;
    private final CarePaymentService paymentService;
    private final CareAvailabilityService availabilityService;
    private final ProviderService providerService;
    private final NotificationService notificationService;
    private final AppProperties appProperties;
    private final Clock clock;

    public ConfigDto config() {
        AppProperties.Care care = appProperties.getCare();
        return ConfigDto.builder()
                .currency(care.getCurrency())
                .currencySymbol(care.getCurrencySymbol())
                .holdMinutes(care.getHoldMinutes())
                .cancellationWindowHours(care.getCancellationWindowHours())
                .maxBoardingNights(care.getMaxBoardingNights())
                .paymentsTestMode(paymentService.isTestMode())
                .paymentGateway(paymentService.gatewayName())
                .clinicAdvancePercent(appProperties.getClinic().getAdvancePercent())
                .build();
    }

    // ================================================================== customer: booking and paying

    @Transactional
    public BookingDto create(Long userId, CreateBookingRequest req) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BadRequestException("Only pet owners can book pet-care services."));
        // one booking at a time per provider, so the capacity check below cannot race another request
        ProviderProfile provider = providerRepository.findByIdForUpdate(req.getProviderId())
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + req.getProviderId()));
        providerService.assertCustomerCanAccess(customer, provider);

        Pet pet = petRepository.findByIdAndCustomerId(req.getPetId(), customer.getId())
                .orElseThrow(() -> new BadRequestException("Selected pet is not associated with your account"));
        CareService main = serviceRepository.findByIdAndProviderId(req.getServiceId(), provider.getId())
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && !Boolean.TRUE.equals(s.getIsAddon()))
                .orElseThrow(() -> new BadRequestException("That service is not available."));
        if (!provider.getCategories().contains(main.getCategory())) {
            throw new BadRequestException("This provider does not offer " + main.getCategory().name().toLowerCase(Locale.ROOT) + ".");
        }
        List<CareService> addons = loadAddons(provider, main, req.getAddonIds());

        PetSize size = req.getPetSize() != null ? req.getPetSize() : PetSize.fromWeight(pet.getWeight());
        LocalDate today = LocalDate.now(clock);
        if (req.getDate().isBefore(today)) throw new BadRequestException("The date cannot be in the past.");
        if (req.getDate().isAfter(today.plusDays(appProperties.getCare().getMaxAdvanceBookingDays()))) {
            throw new BadRequestException("Bookings can be made up to " + appProperties.getCare().getMaxAdvanceBookingDays() + " days ahead.");
        }

        CareBooking booking = CareBooking.builder()
                .reference(newReference())
                .customer(customer).pet(pet).provider(provider)
                .category(main.getCategory()).petSize(size)
                .bookingDate(req.getDate())
                .notes(blankToNull(req.getNotes()))
                .currency(appProperties.getCare().getCurrency())
                .status(CareBookingStatus.AWAITING_PAYMENT)
                .expiresAt(clock.instant().plus(appProperties.getCare().getHoldMinutes(), ChronoUnit.MINUTES))
                .build();

        if (main.getCategory() == CareCategory.BOARDING) {
            scheduleBoarding(booking, provider, req);
        } else {
            scheduleTimed(booking, provider, main, addons, req);
        }

        // items and price: boarding is priced per night, everything else per session; extras are a flat price
        int multiplier = main.getPricingUnit() == PricingUnit.PER_NIGHT && booking.getNights() != null ? booking.getNights() : 1;
        BigDecimal mainPrice = main.priceFor(size).multiply(BigDecimal.valueOf(multiplier));
        booking.getItems().add(CareBookingItem.builder().booking(booking).service(main)
                .name(multiplier > 1 ? main.getName() + " x " + multiplier + " nights" : main.getName())
                .price(mainPrice).isMain(true).build());
        BigDecimal total = mainPrice;
        for (CareService a : addons) {
            booking.getItems().add(CareBookingItem.builder().booking(booking).service(a).name(a.getName()).price(a.priceFor(size)).isMain(false).build());
            total = total.add(a.priceFor(size));
        }
        total = total.setScale(2, RoundingMode.HALF_UP);
        if (total.signum() <= 0) throw new BadRequestException("This service has no price for a " + size.name().toLowerCase(Locale.ROOT) + " pet.");

        BigDecimal advance = total.multiply(BigDecimal.valueOf(provider.getAdvancePercent()))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP).max(new BigDecimal("0.01")).min(total);
        booking.setTotalAmount(total);
        booking.setAdvanceAmount(advance);
        booking.setBalanceAmount(total.subtract(advance));

        booking = bookingRepository.save(booking);
        CarePayment payment = paymentService.createAdvance(booking);
        log.info("Care booking created: ref={} provider={} category={} total={} advance={} holdUntil={}",
                booking.getReference(), provider.getId(), booking.getCategory(), total, advance, booking.getExpiresAt());
        return toDto(booking, payment, userId);
    }

    /** Test-mode payment: the customer presses Pay (or Fail) on the test screen. Real gateways confirm with a signature. */
    @Transactional
    public BookingDto settleTestPayment(Long userId, Long bookingId, Outcome outcome) {
        if (paymentService.hasCheckout()) throw new BadRequestException("Test payments are switched off. Please pay with the checkout.");
        CareBooking b = lockedOwnBooking(userId, bookingId);
        CarePayment payment = openPayment(b);

        if (outcome == Outcome.FAILURE) {
            paymentService.markFailed(payment, "Payment was declined (test)");
            return toDto(b, payment, userId);
        }

        paymentService.markPaid(payment);
        return afterPaid(b, payment, userId);
    }

    /** The checkout (Razorpay) reports success: the signature is verified before anything is marked paid. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public BookingDto confirmCheckout(Long userId, Long bookingId, CheckoutResultRequest result) {
        CareBooking b = lockedOwnBooking(userId, bookingId);
        if (b.getStatus() == CareBookingStatus.AWAITING_PAYMENT && !b.getExpiresAt().isAfter(clock.instant())) {
            // The customer paid just as the hold ran out: take the money only to give it straight back.
            CarePayment late = paymentService.latest(b.getId()).orElseThrow(() -> new BadRequestException("There is no payment for this booking."));
            paymentService.confirmCheckout(late, result.getRazorpayOrderId(), result.getRazorpayPaymentId(), result.getRazorpaySignature());
            paymentService.refund(late, late.getAmount(), "paid after the hold expired");
            expireOne(b);
            throw new BadRequestException("The payment window had closed, so the slot was released and your payment has been refunded. Please book again.");
        }
        CarePayment payment = openPayment(b);
        paymentService.confirmCheckout(payment, result.getRazorpayOrderId(), result.getRazorpayPaymentId(), result.getRazorpaySignature());
        return afterPaid(b, payment, userId);
    }

    /** The checkout reports a declined payment; the slot stays held and the customer can try again. */
    @Transactional
    public BookingDto paymentFailed(Long userId, Long bookingId, String reason) {
        CareBooking b = lockedOwnBooking(userId, bookingId);
        CarePayment payment = openPayment(b);
        paymentService.markFailed(payment, reason == null || reason.isBlank() ? "Payment was declined" : reason.trim());
        return toDto(b, payment, userId);
    }

    /** The unpaid payment of a booking that is still waiting for it (and still held). */
    private CarePayment openPayment(CareBooking b) {
        if (b.getStatus() != CareBookingStatus.AWAITING_PAYMENT) {
            throw new BadRequestException("This booking is no longer waiting for payment.");
        }
        if (!b.getExpiresAt().isAfter(clock.instant())) {
            expireOne(b);
            throw new BadRequestException("The payment window has closed and the slot was released. Please book again.");
        }
        return paymentService.latest(b.getId())
                .filter(p -> p.getStatus() == PaymentStatus.CREATED || p.getStatus() == PaymentStatus.FAILED)
                .orElseThrow(() -> new BadRequestException("There is no open payment for this booking. Tap retry to start a new one."));
    }

    private BookingDto afterPaid(CareBooking b, CarePayment payment, Long userId) {
        b.setStatus(CareBookingStatus.REQUESTED);
        b.setExpiresAt(null);
        bookingRepository.save(b);
        log.info("Care booking paid and requested: ref={}", b.getReference());

        notify(b.getProvider().getUser(), "New pet-care booking request",
                b.getCustomer().getFullName() + " booked " + describe(b) + " (advance paid). Please accept or reject it.",
                NotificationType.CARE_BOOKING_REQUEST, b);
        notify(b.getCustomer().getUser(), "Payment received",
                "We received your advance of " + money(b.getAdvanceAmount(), b) + " for " + describe(b) + ". Waiting for " + b.getProvider().getBusinessName() + " to confirm.",
                NotificationType.CARE_PAYMENT, b);
        return toDto(b, payment, userId);
    }

    /** After a failed payment the customer can try again while the hold lasts. */
    @Transactional
    public BookingDto retryPayment(Long userId, Long bookingId) {
        CareBooking b = lockedOwnBooking(userId, bookingId);
        if (b.getStatus() != CareBookingStatus.AWAITING_PAYMENT || !b.getExpiresAt().isAfter(clock.instant())) {
            throw new BadRequestException("This booking can no longer be paid. Please book again.");
        }
        CarePayment last = paymentService.latest(b.getId()).orElse(null);
        if (last != null && last.getStatus() == PaymentStatus.CREATED) return toDto(b, last, userId);
        if (last != null) paymentService.expire(last);
        return toDto(b, paymentService.createAdvance(b), userId);
    }

    // ================================================================== customer: cancelling

    @Transactional(readOnly = true)
    public CancellationPreviewDto cancellationPreview(Long userId, Long bookingId) {
        CareBooking b = ownBooking(userId, bookingId);
        return preview(b, paymentService.latest(b.getId()).orElse(null));
    }

    @Transactional
    public BookingDto cancelByCustomer(Long userId, Long bookingId, String reason) {
        CareBooking b = lockedOwnBooking(userId, bookingId);
        if (!EnumSet.of(CareBookingStatus.AWAITING_PAYMENT, CareBookingStatus.REQUESTED, CareBookingStatus.CONFIRMED).contains(b.getStatus())) {
            throw new BadRequestException("This booking cannot be cancelled any more.");
        }
        if (!b.startsAt().isAfter(LocalDateTime.now(clock))) {
            throw new BadRequestException("This booking has already started and cannot be cancelled.");
        }
        CarePayment payment = paymentService.latest(b.getId()).orElse(null);
        CancellationPreviewDto policy = preview(b, payment);
        boolean wasPaid = b.getStatus() != CareBookingStatus.AWAITING_PAYMENT;

        BigDecimal refunded = BigDecimal.ZERO;
        if (wasPaid && payment != null && policy.isRefundable()) {
            refunded = paymentService.refund(payment, policy.getRefundAmount(), "customer cancelled in time");
        } else if (payment != null) {
            paymentService.expire(payment);
        }
        b.setStatus(CareBookingStatus.CANCELLED);
        b.setCancelledBy("CUSTOMER");
        b.setCancellationReason(blankToNull(reason));
        b.setExpiresAt(null);
        bookingRepository.save(b);
        log.info("Care booking cancelled by customer: ref={} refunded={}", b.getReference(), refunded);

        if (wasPaid) {
            notify(b.getProvider().getUser(), "Booking cancelled",
                    b.getCustomer().getFullName() + " cancelled " + describe(b) + (reason != null && !reason.isBlank() ? ". Reason: " + reason.trim() : "."),
                    NotificationType.CARE_BOOKING_UPDATE, b);
            notify(b.getCustomer().getUser(), "Booking cancelled",
                    refunded.signum() > 0
                            ? "Your booking was cancelled and " + money(refunded, b) + " is being refunded."
                            : "Your booking was cancelled. The advance is not refundable this close to the start.",
                    NotificationType.CARE_PAYMENT, b);
        }
        return toDto(b, paymentService.latest(b.getId()).orElse(null), userId);
    }

    // ================================================================== provider actions

    @Transactional
    public BookingDto accept(Long userId, Long bookingId) {
        CareBooking b = lockedProviderBooking(userId, bookingId);
        requireStatus(b, CareBookingStatus.REQUESTED, "Only a new request can be accepted.");
        b.setStatus(CareBookingStatus.CONFIRMED);
        bookingRepository.save(b);
        log.info("Care booking accepted: ref={}", b.getReference());
        notify(b.getCustomer().getUser(), "Booking confirmed",
                b.getProvider().getBusinessName() + " confirmed " + describe(b) + ".", NotificationType.CARE_BOOKING_UPDATE, b);
        return toDto(b, paymentService.latest(b.getId()).orElse(null), userId);
    }

    @Transactional
    public BookingDto reject(Long userId, Long bookingId, String reason) {
        CareBooking b = lockedProviderBooking(userId, bookingId);
        requireStatus(b, CareBookingStatus.REQUESTED, "Only a new request can be rejected.");
        if (reason == null || reason.isBlank()) throw new BadRequestException("Please give the customer a reason.");
        return providerEnds(b, CareBookingStatus.REJECTED, reason.trim(), userId, "could not take your booking");
    }

    /** A provider can call off a confirmed booking; the customer always gets the advance back in full. */
    @Transactional
    public BookingDto cancelByProvider(Long userId, Long bookingId, String reason) {
        CareBooking b = lockedProviderBooking(userId, bookingId);
        requireStatus(b, CareBookingStatus.CONFIRMED, "Only a confirmed booking can be cancelled.");
        if (reason == null || reason.isBlank()) throw new BadRequestException("Please give the customer a reason.");
        return providerEnds(b, CareBookingStatus.CANCELLED, reason.trim(), userId, "had to cancel your booking");
    }

    @Transactional
    public BookingDto complete(Long userId, Long bookingId) {
        CareBooking b = lockedProviderBooking(userId, bookingId);
        requireStatus(b, CareBookingStatus.CONFIRMED, "Only a confirmed booking can be completed.");
        if (b.getBookingDate().isAfter(LocalDate.now(clock))) {
            throw new BadRequestException("This booking is for " + b.getBookingDate() + ". It can be completed on that day.");
        }
        b.setStatus(CareBookingStatus.COMPLETED);
        bookingRepository.save(b);
        log.info("Care booking completed: ref={}", b.getReference());
        notify(b.getCustomer().getUser(), "Booking completed",
                "Thanks for visiting " + b.getProvider().getBusinessName() + ". The remaining " + money(b.getBalanceAmount(), b)
                        + " is paid at the provider. How was it? You can leave a review.",
                NotificationType.CARE_BOOKING_UPDATE, b);
        return toDto(b, paymentService.latest(b.getId()).orElse(null), userId);
    }

    private BookingDto providerEnds(CareBooking b, CareBookingStatus status, String reason, Long userId, String verb) {
        CarePayment payment = paymentService.latest(b.getId()).orElse(null);
        BigDecimal refunded = payment == null ? BigDecimal.ZERO
                : paymentService.refund(payment, payment.getAmount(), "provider " + status.name().toLowerCase(Locale.ROOT));
        b.setStatus(status);
        b.setCancelledBy("PROVIDER");
        b.setCancellationReason(reason);
        bookingRepository.save(b);
        log.info("Care booking {} by provider: ref={} refunded={}", status, b.getReference(), refunded);
        notify(b.getCustomer().getUser(), "Booking " + (status == CareBookingStatus.REJECTED ? "declined" : "cancelled"),
                b.getProvider().getBusinessName() + " " + verb + " (" + describe(b) + "). Reason: " + reason
                        + ". Your advance of " + money(refunded, b) + " is being refunded in full.",
                NotificationType.CARE_BOOKING_UPDATE, b);
        return toDto(b, paymentService.latest(b.getId()).orElse(null), userId);
    }

    // ================================================================== reviews

    @Transactional
    public ReviewDto review(Long userId, Long bookingId, ReviewRequest req) {
        CareBooking b = ownBooking(userId, bookingId);
        if (b.getStatus() != CareBookingStatus.COMPLETED) throw new BadRequestException("You can review a booking once it is completed.");
        if (reviewRepository.existsByBookingId(b.getId())) throw new BadRequestException("You have already reviewed this booking.");

        CareReview review = reviewRepository.save(CareReview.builder()
                .booking(b).provider(b.getProvider()).customer(b.getCustomer())
                .rating(req.getRating()).comment(blankToNull(req.getComment())).build());

        ProviderProfile p = b.getProvider();
        Double avg = reviewRepository.averageRating(p.getId());
        p.setRatingAvg(BigDecimal.valueOf(avg != null ? avg : req.getRating()).setScale(2, RoundingMode.HALF_UP));
        p.setReviewCount((int) reviewRepository.countByProviderId(p.getId()));
        providerRepository.save(p);
        log.info("Care review created: ref={} rating={}", b.getReference(), req.getRating());

        notify(p.getUser(), "New review", b.getCustomer().getFullName() + " left you a " + req.getRating() + "-star review.", NotificationType.NEW_REVIEW, b);
        return providerService.toReviewDto(review);
    }

    // ================================================================== lists and details

    @Transactional(readOnly = true)
    public PageResponse<BookingDto> myBookings(Long userId, String tab, Pageable pageable) {
        CustomerProfile c = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BadRequestException("Only pet owners have pet-care bookings."));
        Set<CareBookingStatus> statuses = switch (tab == null ? "UPCOMING" : tab.toUpperCase(Locale.ROOT)) {
            case "COMPLETED" -> EnumSet.of(CareBookingStatus.COMPLETED);
            case "CANCELLED" -> EnumSet.of(CareBookingStatus.CANCELLED, CareBookingStatus.REJECTED, CareBookingStatus.EXPIRED);
            default -> EnumSet.of(CareBookingStatus.AWAITING_PAYMENT, CareBookingStatus.REQUESTED, CareBookingStatus.CONFIRMED);
        };
        return PageResponse.of(bookingRepository
                .findByCustomerIdAndStatusInOrderByBookingDateDescIdDesc(c.getId(), statuses, pageable)
                .map(b -> toDto(b, paymentService.latest(b.getId()).orElse(null), userId)));
    }

    /** What the provider sees: unpaid holds are not shown, since they are not real bookings yet. */
    @Transactional(readOnly = true)
    public PageResponse<BookingDto> providerBookings(Long userId, String group, Pageable pageable) {
        ProviderProfile p = providerRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("You have not set up a pet-care profile yet."));
        Set<CareBookingStatus> statuses = switch (group == null ? "REQUESTED" : group.toUpperCase(Locale.ROOT)) {
            case "CONFIRMED" -> EnumSet.of(CareBookingStatus.CONFIRMED);
            case "COMPLETED" -> EnumSet.of(CareBookingStatus.COMPLETED);
            case "CANCELLED" -> EnumSet.of(CareBookingStatus.CANCELLED, CareBookingStatus.REJECTED);
            default -> EnumSet.of(CareBookingStatus.REQUESTED);
        };
        return PageResponse.of(bookingRepository
                .findByProviderIdAndStatusInOrderByBookingDateAscIdAsc(p.getId(), statuses, pageable)
                .map(b -> toDto(b, paymentService.latest(b.getId()).orElse(null), userId)));
    }

    @Transactional(readOnly = true)
    public BookingDto get(UserPrincipal viewer, Long bookingId) {
        CareBooking b = bookingRepository.findById(bookingId).orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        boolean customer = b.getCustomer().getUser().getId().equals(viewer.getId());
        boolean provider = b.getProvider().getUser().getId().equals(viewer.getId());
        if (!customer && !provider && viewer.getRole() != Role.ROLE_ADMIN) {
            throw new UnauthorizedException("You do not have access to this booking");
        }
        return toDto(b, paymentService.latest(b.getId()).orElse(null), viewer.getId());
    }

    // ================================================================== expiry of unpaid holds

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void expireStaleHolds() {
        List<CareBooking> stale = bookingRepository.findByStatusAndExpiresAtBefore(CareBookingStatus.AWAITING_PAYMENT, clock.instant());
        stale.forEach(this::expireOne);
        if (!stale.isEmpty()) log.info("Released {} unpaid pet-care hold(s)", stale.size());
    }

    private void expireOne(CareBooking b) {
        if (b.getStatus() != CareBookingStatus.AWAITING_PAYMENT) return;
        b.setStatus(CareBookingStatus.EXPIRED);
        b.setCancelledBy("SYSTEM");
        b.setCancellationReason("The advance payment was not made in time.");
        bookingRepository.save(b);
        paymentService.latest(b.getId()).ifPresent(paymentService::expire);
        notify(b.getCustomer().getUser(), "Booking expired",
                "Your hold on " + describe(b) + " ended because the advance was not paid in time.", NotificationType.CARE_BOOKING_UPDATE, b);
    }

    // ================================================================== scheduling and pricing helpers

    /** Grooming / training: a valid start time with room for the whole session (and add-ons). */
    private void scheduleTimed(CareBooking booking, ProviderProfile provider, CareService main, List<CareService> addons, CreateBookingRequest req) {
        if (req.getStartTime() == null) throw new BadRequestException("Choose a start time.");
        if (req.getCheckOutDate() != null) throw new BadRequestException("A check-out date is only for boarding.");
        int minutes = providerService.sessionMinutes(main) + addons.stream().mapToInt(a -> a.getDurationMinutes() == null ? 0 : a.getDurationMinutes()).sum();
        if (!availabilityService.isSlotFree(provider, req.getDate(), req.getStartTime(), minutes)) {
            log.warn("Care booking rejected: slot {} {} not free at provider {}", req.getDate(), req.getStartTime(), provider.getId());
            throw new BookingConflictException("That time is no longer available. Please choose another slot.");
        }
        booking.setStartTime(req.getStartTime());
        booking.setEndTime(req.getStartTime().plusMinutes(minutes));
    }

    /** Boarding: check-in and check-out dates with a free place every night. */
    private void scheduleBoarding(CareBooking booking, ProviderProfile provider, CreateBookingRequest req) {
        if (req.getStartTime() != null) throw new BadRequestException("Boarding is booked by date, not by time.");
        if (req.getCheckOutDate() == null) throw new BadRequestException("Choose a check-out date.");
        long nights = ChronoUnit.DAYS.between(req.getDate(), req.getCheckOutDate());
        if (nights < 1) throw new BadRequestException("Check-out must be after check-in.");
        if (nights > appProperties.getCare().getMaxBoardingNights()) {
            throw new BadRequestException("A stay can be at most " + appProperties.getCare().getMaxBoardingNights() + " nights.");
        }
        if (provider.getBoardingCapacity() <= 0) throw new BadRequestException("This provider has no boarding places.");
        boolean full = availabilityService.boardingNights(provider, req.getDate(), req.getCheckOutDate()).stream().anyMatch(n -> !n.isAvailable());
        if (full) {
            log.warn("Care booking rejected: boarding full for {} to {} at provider {}", req.getDate(), req.getCheckOutDate(), provider.getId());
            throw new BookingConflictException("No place is free for all of those nights. Please try other dates.");
        }
        booking.setCheckOutDate(req.getCheckOutDate());
        booking.setNights((int) nights);
    }

    private List<CareService> loadAddons(ProviderProfile provider, CareService main, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<CareService> addons = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            CareService a = serviceRepository.findByIdAndProviderId(id, provider.getId())
                    .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && Boolean.TRUE.equals(s.getIsAddon()) && s.getCategory() == main.getCategory())
                    .orElseThrow(() -> new BadRequestException("One of the extras is not available with this service."));
            addons.add(a);
        }
        return addons;
    }

    private CancellationPreviewDto preview(CareBooking b, CarePayment payment) {
        int window = appProperties.getCare().getCancellationWindowHours();
        boolean paid = b.getStatus() == CareBookingStatus.REQUESTED || b.getStatus() == CareBookingStatus.CONFIRMED;
        BigDecimal paidAmount = paid && payment != null ? payment.getAmount().subtract(payment.getRefundedAmount()) : BigDecimal.ZERO;
        boolean inTime = !LocalDateTime.now(clock).isAfter(b.startsAt().minusHours(window));
        boolean refundable = paid && inTime && paidAmount.signum() > 0;
        String message;
        if (!paid) message = "Nothing has been charged yet, so there is nothing to refund.";
        else if (refundable) message = "Cancelling now refunds your advance of " + money(paidAmount, b) + " in full.";
        else message = "Cancelling less than " + window + " hours before the start does not refund the advance of " + money(paidAmount, b) + ".";
        return CancellationPreviewDto.builder()
                .refundable(refundable).refundAmount(refundable ? paidAmount : BigDecimal.ZERO).paidAmount(paidAmount)
                .currency(b.getCurrency()).windowHours(window).message(message).build();
    }

    // ================================================================== lookups and mapping

    private CareBooking ownBooking(Long userId, Long id) {
        CareBooking b = bookingRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        if (!b.getCustomer().getUser().getId().equals(userId)) throw new UnauthorizedException("You do not have access to this booking");
        return b;
    }

    private CareBooking lockedOwnBooking(Long userId, Long id) {
        CareBooking b = bookingRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        if (!b.getCustomer().getUser().getId().equals(userId)) throw new UnauthorizedException("You do not have access to this booking");
        return b;
    }

    private CareBooking lockedProviderBooking(Long userId, Long id) {
        CareBooking b = bookingRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        if (!b.getProvider().getUser().getId().equals(userId)) throw new UnauthorizedException("You do not have access to this booking");
        return b;
    }

    private static void requireStatus(CareBooking b, CareBookingStatus expected, String message) {
        if (b.getStatus() != expected) throw new BadRequestException(message);
    }

    private String newReference() {
        String date = LocalDate.now(clock).format(DateTimeFormatter.BASIC_ISO_DATE);
        for (int i = 0; i < 10; i++) {
            String ref = "CB-" + date + "-" + String.format("%04X", RANDOM.nextInt(0x10000));
            if (!bookingRepository.existsByReference(ref)) return ref;
        }
        return "CB-" + date + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private BookingDto toDto(CareBooking b, CarePayment payment, Long viewerUserId) {
        ProviderProfile p = b.getProvider();
        Pet pet = b.getPet();
        boolean isCustomer = b.getCustomer().getUser().getId().equals(viewerUserId);
        boolean reviewed = reviewRepository.existsByBookingId(b.getId());
        return BookingDto.builder()
                .id(b.getId()).reference(b.getReference()).status(b.getStatus()).category(b.getCategory())
                .providerId(p.getId()).providerName(p.getBusinessName()).providerPhone(p.getPhone()).providerAddress(p.getAddress())
                .providerCity(p.getCity()).providerLatitude(p.getLatitude()).providerLongitude(p.getLongitude())
                .customerId(b.getCustomer().getId()).customerName(b.getCustomer().getFullName()).customerPhone(b.getCustomer().getUser().getPhone())
                .petId(pet.getId()).petName(pet.getName()).petSpecies(pet.getSpecies() != null ? pet.getSpecies().name() : null)
                .petBreed(pet.getBreed()).petAllergies(pet.getAllergies()).petSize(b.getPetSize())
                .date(b.getBookingDate()).startTime(b.getStartTime()).endTime(b.getEndTime())
                .checkOutDate(b.getCheckOutDate()).nights(b.getNights()).notes(b.getNotes())
                .items(b.getItems().stream().map(i -> BookingItemDto.builder().name(i.getName()).price(i.getPrice()).main(Boolean.TRUE.equals(i.getIsMain())).build()).collect(Collectors.toList()))
                .totalAmount(b.getTotalAmount()).advanceAmount(b.getAdvanceAmount()).balanceAmount(b.getBalanceAmount()).currency(b.getCurrency())
                .expiresAt(b.getExpiresAt()).cancellationReason(b.getCancellationReason()).cancelledBy(b.getCancelledBy())
                .payment(payment == null ? null : paymentService.toDto(payment))
                .canReview(isCustomer && b.getStatus() == CareBookingStatus.COMPLETED && !reviewed)
                .reviewed(reviewed)
                .createdAt(b.getCreatedAt())
                .build();
    }

    private String describe(CareBooking b) {
        String what = b.getItems().stream().filter(i -> Boolean.TRUE.equals(i.getIsMain())).map(CareBookingItem::getName).findFirst().orElse(b.getCategory().name().toLowerCase(Locale.ROOT));
        String when = b.getStartTime() != null ? b.getBookingDate() + " " + b.getStartTime() : b.getBookingDate() + " to " + b.getCheckOutDate();
        return what + " for " + b.getPet().getName() + " on " + when + " (" + b.getReference() + ")";
    }

    private String money(BigDecimal amount, CareBooking b) {
        return appProperties.getCare().getCurrencySymbol() + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private void notify(User recipient, String title, String message, NotificationType type, CareBooking b) {
        notificationService.createNotification(recipient, title, message, type, b.getId().toString());
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
