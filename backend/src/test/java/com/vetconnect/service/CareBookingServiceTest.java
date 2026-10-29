package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.care.CareDtos.SimulatePaymentRequest.Outcome;
import com.vetconnect.payment.PaymentGateway;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CareBookingServiceTest {

    /** Monday 1 March 2027, 10:00 UTC. */
    private static final Instant NOW = Instant.parse("2027-03-01T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2027, 3, 1);

    @Mock private CareBookingRepository bookingRepository;
    @Mock private ProviderProfileRepository providerRepository;
    @Mock private CareServiceRepository serviceRepository;
    @Mock private CustomerProfileRepository customerRepository;
    @Mock private PetRepository petRepository;
    @Mock private CareReviewRepository reviewRepository;
    @Mock private CarePaymentRepository paymentRepository;
    @Mock private CareAvailabilityService availabilityService;
    @Mock private ProviderService providerService;
    @Mock private NotificationService notificationService;

    private final List<BigDecimal> refunds = new ArrayList<>();
    private final List<CarePayment> payments = new ArrayList<>();
    private CareBookingService service;

    private User customerUser, providerUser;
    private CustomerProfile customer;
    private Pet pet;
    private ProviderProfile provider;
    private CareService bath, fullGroom, nailTrim, boarding, walk;

    @BeforeEach
    void setUp() {
        PaymentGateway gateway = new PaymentGateway() {
            @Override public String name() { return "test"; }
            @Override public boolean isTestMode() { return true; }
            @Override public String publicKey() { return null; }
            @Override public boolean verifySignature(String orderId, String paymentId, String signature) { return false; }
            @Override public String createOrder(String ref, BigDecimal amount, String currency) { return "order_" + ref; }
            @Override public String refund(CarePayment payment, BigDecimal amount) { refunds.add(amount); return "refund_1"; }
        };
        CarePaymentService paymentService = new CarePaymentService(paymentRepository, gateway, CLOCK, mock(WalletService.class));
        service = new CareBookingService(bookingRepository, providerRepository, serviceRepository, customerRepository, petRepository,
                reviewRepository, paymentService, availabilityService, providerService, notificationService, new AppProperties(), CLOCK);

        customerUser = User.builder().id(10L).email("c@x.com").role(Role.ROLE_CUSTOMER).build();
        providerUser = User.builder().id(20L).email("p@x.com").role(Role.ROLE_PROVIDER).build();
        customer = CustomerProfile.builder().id(1L).fullName("Cathy").user(customerUser).build();
        pet = Pet.builder().id(5L).name("Rex").species(PetSpecies.DOG).weight(new BigDecimal("12")).customer(customer).build();
        provider = ProviderProfile.builder().id(2L).user(providerUser).businessName("Happy Paws").advancePercent(30)
                .verificationStatus(VerificationStatus.APPROVED).boardingCapacity(4).concurrentCapacity(2).build();
        provider.getCategories().add(CareCategory.GROOMING);
        provider.getCategories().add(CareCategory.BOARDING);

        bath = service("Bath", CareCategory.GROOMING, PricingUnit.PER_SESSION, 60, false, "25", "35", "45", "60", 100L);
        fullGroom = service("Full Groom", CareCategory.GROOMING, PricingUnit.PER_SESSION, 90, false, "40", "55", "70", "90", 101L);
        nailTrim = service("Nail Trim", CareCategory.GROOMING, PricingUnit.PER_SESSION, 15, true, "8", "8", "10", "12", 102L);
        boarding = service("Standard Boarding", CareCategory.BOARDING, PricingUnit.PER_NIGHT, null, false, "18", "24", "30", "40", 103L);
        walk = service("Extra Walk", CareCategory.BOARDING, PricingUnit.PER_SESSION, null, true, "10", "10", "12", "15", 104L);

        when(customerRepository.findByUserId(10L)).thenReturn(Optional.of(customer));
        when(petRepository.findByIdAndCustomerId(5L, 1L)).thenReturn(Optional.of(pet));
        when(providerRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(provider));
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(provider));
        when(providerRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(providerService.sessionMinutes(any())).thenAnswer(i -> {
            CareService s = i.getArgument(0);
            return s.getDurationMinutes() != null ? s.getDurationMinutes() : 60;
        });
        when(availabilityService.isSlotFree(any(), any(), any(), anyInt())).thenReturn(true);
        when(availabilityService.boardingNights(any(), any(), any())).thenAnswer(i -> nights(i.getArgument(1), i.getArgument(2), 2));

        when(bookingRepository.save(any())).thenAnswer(i -> {
            CareBooking b = i.getArgument(0);
            if (b.getId() == null) b.setId(900L);
            return b;
        });
        when(bookingRepository.existsByReference(any())).thenReturn(false);
        when(paymentRepository.save(any())).thenAnswer(i -> {
            CarePayment p = i.getArgument(0);
            if (p.getId() == null) p.setId((long) payments.size() + 1);
            if (!payments.contains(p)) payments.add(p);
            return p;
        });
        when(paymentRepository.findFirstByBookingIdOrderByIdDesc(anyLong())).thenAnswer(i -> payments.stream().reduce((a, b) -> b));
    }

    private CareService service(String name, CareCategory cat, PricingUnit unit, Integer minutes, boolean addon,
                                String s, String m, String l, String g, Long id) {
        CareService svc = CareService.builder().id(id).provider(provider).category(cat).name(name).pricingUnit(unit).durationMinutes(minutes)
                .priceSmall(new BigDecimal(s)).priceMedium(new BigDecimal(m)).priceLarge(new BigDecimal(l)).priceGiant(new BigDecimal(g))
                .isAddon(addon).isActive(true).build();
        when(serviceRepository.findByIdAndProviderId(id, 2L)).thenReturn(Optional.of(svc));
        return svc;
    }

    private static List<BoardingNightDto> nights(LocalDate from, LocalDate to, int remaining) {
        List<BoardingNightDto> list = new ArrayList<>();
        for (LocalDate d = from; d.isBefore(to); d = d.plusDays(1)) list.add(new BoardingNightDto(d, remaining, remaining > 0));
        return list;
    }

    private CreateBookingRequest groom(Long serviceId, String date, String time) {
        return CreateBookingRequest.builder().providerId(2L).serviceId(serviceId).petId(5L)
                .date(LocalDate.parse(date)).startTime(LocalTime.parse(time)).build();
    }

    /** Creates a paid, requested grooming booking on the given date. */
    private CareBooking paidBooking(String date, String time) {
        BookingDto dto = service.create(10L, groom(100L, date, time));
        CareBooking[] holder = new CareBooking[1];
        verify(bookingRepository, atLeastOnce()).save(argThat(b -> { holder[0] = b; return true; }));
        CareBooking b = holder[0];
        when(bookingRepository.findByIdForUpdate(900L)).thenReturn(Optional.of(b));
        when(bookingRepository.findById(900L)).thenReturn(Optional.of(b));
        service.settleTestPayment(10L, dto.getId(), Outcome.SUCCESS);
        return b;
    }

    // ================================================================== pricing

    @Test
    void groomingIsPricedBySizeAndTheAdvanceIsAShareOfTheTotal() {
        // Rex weighs 12 kg: medium. Bath 35 + nail trim 8 = 43; 30% advance = 12.90
        BookingDto dto = service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L).addonIds(List.of(102L)).petId(5L)
                .date(TODAY.plusDays(7)).startTime(LocalTime.of(10, 0)).build());

        assertEquals(PetSize.MEDIUM, dto.getPetSize());
        assertEquals(new BigDecimal("43.00"), dto.getTotalAmount());
        assertEquals(new BigDecimal("12.90"), dto.getAdvanceAmount());
        assertEquals(new BigDecimal("30.10"), dto.getBalanceAmount());
        assertEquals(CareBookingStatus.AWAITING_PAYMENT, dto.getStatus());
        assertEquals(LocalTime.of(11, 15), dto.getEndTime(), "60 minute bath + 15 minute nail trim");
        assertEquals(2, dto.getItems().size());
        assertEquals(new BigDecimal("12.90"), dto.getPayment().getAmount());
        assertEquals(PaymentStatus.CREATED, dto.getPayment().getStatus());
        assertTrue(dto.getPayment().isTestMode());
    }

    @Test
    void theSlotIsHeldOnlyForTheConfiguredTime() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));

        assertEquals(NOW.plusSeconds(15 * 60), dto.getExpiresAt());
    }

    @Test
    void theCustomerCanOverrideTheSizeSuggestedByTheWeight() {
        BookingDto dto = service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L).petId(5L).petSize(PetSize.GIANT)
                .date(TODAY.plusDays(7)).startTime(LocalTime.of(10, 0)).build());

        assertEquals(new BigDecimal("60.00"), dto.getTotalAmount());
    }

    @Test
    void boardingIsPricedPerNightPlusFlatExtras() {
        // medium: 24 x 3 nights + 10 walk = 82; advance 30% = 24.60
        BookingDto dto = service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L).addonIds(List.of(104L)).petId(5L)
                .date(TODAY.plusDays(10)).checkOutDate(TODAY.plusDays(13)).build());

        assertEquals(3, dto.getNights());
        assertEquals(new BigDecimal("82.00"), dto.getTotalAmount());
        assertEquals(new BigDecimal("24.60"), dto.getAdvanceAmount());
        assertNull(dto.getStartTime());
        assertTrue(dto.getItems().get(0).getName().contains("3 nights"));
    }

    @Test
    void aTinyAdvanceStillCostsAtLeastOneCent_andNeverMoreThanTheTotal() {
        provider.setAdvancePercent(100);
        BookingDto full = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        assertEquals(full.getTotalAmount(), full.getAdvanceAmount());
        assertEquals(new BigDecimal("0.00"), full.getBalanceAmount());
    }

    // ================================================================== validation

    @Test
    void thingsThatCannotBeBookedAreRefused() {
        assertThrows(BadRequestException.class, () -> service.create(10L, groom(100L, "2027-02-28", "10:00")), "past date");
        assertThrows(BadRequestException.class, () -> service.create(10L, groom(100L, "2027-12-25", "10:00")), "beyond the booking horizon");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L).petId(5L)
                .date(TODAY.plusDays(2)).build()), "grooming without a start time");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L).petId(5L)
                .date(TODAY.plusDays(2)).startTime(LocalTime.NOON).checkOutDate(TODAY.plusDays(3)).build()), "check-out on a grooming booking");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L).petId(5L)
                .date(TODAY.plusDays(2)).startTime(LocalTime.NOON).checkOutDate(TODAY.plusDays(4)).build()), "a time on a boarding booking");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L).petId(5L)
                .date(TODAY.plusDays(2)).build()), "boarding without check-out");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L).petId(5L)
                .date(TODAY.plusDays(2)).checkOutDate(TODAY.plusDays(2)).build()), "zero nights");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L).petId(5L)
                .date(TODAY.plusDays(2)).checkOutDate(TODAY.plusDays(40)).build()), "more than the maximum nights");
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void anAddOnCannotBeBookedOnItsOwn_orMixedAcrossCategories() {
        assertThrows(BadRequestException.class, () -> service.create(10L, groom(102L, "2027-03-08", "10:00")), "add-on as the main service");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L)
                .addonIds(List.of(104L)).petId(5L).date(TODAY.plusDays(7)).startTime(LocalTime.of(10, 0)).build()), "a boarding extra on a grooming booking");
        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L)
                .addonIds(List.of(999L)).petId(5L).date(TODAY.plusDays(7)).startTime(LocalTime.of(10, 0)).build()), "an unknown extra");
    }

    @Test
    void aSwitchedOffServiceOrACategoryTheProviderDoesNotOfferIsRefused() {
        bath.setIsActive(false);
        assertThrows(BadRequestException.class, () -> service.create(10L, groom(100L, "2027-03-08", "10:00")));

        provider.getCategories().remove(CareCategory.GROOMING);
        assertThrows(BadRequestException.class, () -> service.create(10L, groom(101L, "2027-03-08", "10:00")));
    }

    @Test
    void aTakenSlotIsAConflict() {
        when(availabilityService.isSlotFree(any(), any(), any(), anyInt())).thenReturn(false);

        assertThrows(BookingConflictException.class, () -> service.create(10L, groom(100L, "2027-03-08", "10:00")));
    }

    @Test
    void aFullBoardingNightIsAConflict() {
        // doAnswer: when(...) would call the earlier stub with null arguments
        doAnswer(i -> nights(i.getArgument(1), i.getArgument(2), 0)).when(availabilityService).boardingNights(any(), any(), any());

        assertThrows(BookingConflictException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(103L)
                .petId(5L).date(TODAY.plusDays(10)).checkOutDate(TODAY.plusDays(12)).build()));
    }

    @Test
    void anotherOwnersPetCannotBeBooked() {
        when(petRepository.findByIdAndCustomerId(77L, 1L)).thenReturn(Optional.empty());

        assertThrows(BadRequestException.class, () -> service.create(10L, CreateBookingRequest.builder().providerId(2L).serviceId(100L).petId(77L)
                .date(TODAY.plusDays(7)).startTime(LocalTime.of(10, 0)).build()));
    }

    @Test
    void aServiceWithNoPriceForThatSizeCannotBeBooked() {
        bath.setPriceMedium(BigDecimal.ZERO);

        assertThrows(BadRequestException.class, () -> service.create(10L, groom(100L, "2027-03-08", "10:00")));
    }

    // ================================================================== paying

    @Test
    void payingTheAdvanceSendsTheRequestToTheProvider() {
        CareBooking b = paidBooking("2027-03-08", "10:00");

        assertEquals(CareBookingStatus.REQUESTED, b.getStatus());
        assertNull(b.getExpiresAt(), "a paid booking no longer expires");
        assertEquals(PaymentStatus.PAID, payments.get(0).getStatus());
        verify(notificationService).createNotification(eq(providerUser), any(), any(), eq(NotificationType.CARE_BOOKING_REQUEST), any());
        verify(notificationService).createNotification(eq(customerUser), any(), any(), eq(NotificationType.CARE_PAYMENT), any());
    }

    @Test
    void aFailedPaymentKeepsTheSlotAndCanBeRetried() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        CareBooking b = bookingOf(dto);

        BookingDto failed = service.settleTestPayment(10L, dto.getId(), Outcome.FAILURE);
        assertEquals(PaymentStatus.FAILED, failed.getPayment().getStatus());
        assertEquals(CareBookingStatus.AWAITING_PAYMENT, b.getStatus());
        verify(notificationService, never()).createNotification(eq(providerUser), any(), any(), any(), any());

        BookingDto retried = service.retryPayment(10L, dto.getId());
        assertEquals(PaymentStatus.CREATED, retried.getPayment().getStatus());
        assertEquals(2, payments.size());

        service.settleTestPayment(10L, dto.getId(), Outcome.SUCCESS);
        assertEquals(CareBookingStatus.REQUESTED, b.getStatus());
    }

    @Test
    void aPaymentCannotBeSettledTwice() {
        paidBooking("2027-03-08", "10:00");

        assertThrows(BadRequestException.class, () -> service.settleTestPayment(10L, 900L, Outcome.SUCCESS));
    }

    @Test
    void payingAfterTheHoldRanOutReleasesTheSlot() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        CareBooking b = bookingOf(dto);
        b.setExpiresAt(NOW.minusSeconds(1));

        assertThrows(BadRequestException.class, () -> service.settleTestPayment(10L, dto.getId(), Outcome.SUCCESS));
        assertEquals(CareBookingStatus.EXPIRED, b.getStatus());
        assertEquals(PaymentStatus.EXPIRED, payments.get(0).getStatus());
    }

    @Test
    void theScheduledJobExpiresUnpaidHolds() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        CareBooking b = bookingOf(dto);
        b.setExpiresAt(NOW.minusSeconds(60));
        when(bookingRepository.findByStatusAndExpiresAtBefore(eq(CareBookingStatus.AWAITING_PAYMENT), any())).thenReturn(List.of(b));

        service.expireStaleHolds();

        assertEquals(CareBookingStatus.EXPIRED, b.getStatus());
        assertEquals("SYSTEM", b.getCancelledBy());
        verify(notificationService).createNotification(eq(customerUser), eq("Booking expired"), any(), any(), any());
    }

    @Test
    void onlyTheOwnerCanPay() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        bookingOf(dto);

        assertThrows(UnauthorizedException.class, () -> service.settleTestPayment(99L, dto.getId(), Outcome.SUCCESS));
    }

    // ================================================================== cancelling and refunds

    @Test
    void cancellingAtLeast24HoursAheadRefundsTheAdvanceInFull() {
        CareBooking b = paidBooking("2027-03-08", "10:00");

        CancellationPreviewDto preview = service.cancellationPreview(10L, 900L);
        assertTrue(preview.isRefundable());
        assertEquals(b.getAdvanceAmount(), preview.getRefundAmount());

        BookingDto dto = service.cancelByCustomer(10L, 900L, "plans changed");

        assertEquals(CareBookingStatus.CANCELLED, dto.getStatus());
        assertEquals("CUSTOMER", dto.getCancelledBy());
        assertEquals(List.of(b.getAdvanceAmount()), refunds);
        assertEquals(PaymentStatus.REFUNDED, payments.get(0).getStatus());
        verify(notificationService).createNotification(eq(providerUser), eq("Booking cancelled"), any(), any(), any());
    }

    @Test
    void cancellingLessThan24HoursAheadKeepsTheAdvance() {
        // tomorrow 09:00 is 23 hours after "now" (today 10:00)
        CareBooking b = paidBooking("2027-03-02", "09:00");

        CancellationPreviewDto preview = service.cancellationPreview(10L, 900L);
        assertFalse(preview.isRefundable());
        assertEquals(BigDecimal.ZERO, preview.getRefundAmount());
        assertTrue(preview.getMessage().contains("24"));

        BookingDto dto = service.cancelByCustomer(10L, 900L, null);

        assertEquals(CareBookingStatus.CANCELLED, dto.getStatus());
        assertTrue(refunds.isEmpty());
        assertEquals(PaymentStatus.PAID, payments.get(0).getStatus(), "the advance stays paid");
        assertEquals(b.getAdvanceAmount(), payments.get(0).getAmount());
    }

    @Test
    void exactlyOnTheBoundaryStillRefunds() {
        paidBooking("2027-03-02", "10:00");   // exactly 24 hours ahead

        assertTrue(service.cancellationPreview(10L, 900L).isRefundable());
    }

    @Test
    void anUnpaidHoldCanBeCancelledWithNothingToRefund() {
        BookingDto dto = service.create(10L, groom(100L, "2027-03-08", "10:00"));
        bookingOf(dto);

        BookingDto cancelled = service.cancelByCustomer(10L, dto.getId(), null);

        assertEquals(CareBookingStatus.CANCELLED, cancelled.getStatus());
        assertTrue(refunds.isEmpty());
        assertEquals(PaymentStatus.EXPIRED, payments.get(0).getStatus());
        verify(notificationService, never()).createNotification(eq(providerUser), any(), any(), any(), any());
    }

    @Test
    void aBookingThatAlreadyStartedCannotBeCancelled() {
        CareBooking b = paidBooking("2027-03-08", "10:00");
        b.setBookingDate(TODAY);
        b.setStartTime(LocalTime.of(9, 0));

        assertThrows(BadRequestException.class, () -> service.cancelByCustomer(10L, 900L, null));
    }

    // ================================================================== provider actions

    @Test
    void theProviderAcceptsThenCompletesOnTheDay() {
        CareBooking b = paidBooking("2027-03-08", "10:00");

        assertEquals(CareBookingStatus.CONFIRMED, service.accept(20L, 900L).getStatus());
        verify(notificationService).createNotification(eq(customerUser), eq("Booking confirmed"), any(), any(), any());

        BadRequestException early = assertThrows(BadRequestException.class, () -> service.complete(20L, 900L));
        assertTrue(early.getMessage().contains("2027-03-08"));

        b.setBookingDate(TODAY);
        assertEquals(CareBookingStatus.COMPLETED, service.complete(20L, 900L).getStatus());
    }

    @Test
    void rejectingNeedsAReasonAndRefundsInFull() {
        CareBooking b = paidBooking("2027-03-02", "09:00");   // even inside the 24 hour window

        assertThrows(BadRequestException.class, () -> service.reject(20L, 900L, "  "));
        BookingDto dto = service.reject(20L, 900L, "Fully booked that day");

        assertEquals(CareBookingStatus.REJECTED, dto.getStatus());
        assertEquals("PROVIDER", dto.getCancelledBy());
        assertEquals(List.of(b.getAdvanceAmount()), refunds, "a provider decision always refunds everything");
        verify(notificationService).createNotification(eq(customerUser), eq("Booking declined"), contains("Fully booked"), any(), any());
    }

    @Test
    void aProviderCancellingAConfirmedBookingRefundsInFull() {
        CareBooking b = paidBooking("2027-03-02", "09:00");
        service.accept(20L, 900L);

        assertThrows(BadRequestException.class, () -> service.cancelByProvider(20L, 900L, null));
        BookingDto dto = service.cancelByProvider(20L, 900L, "Groomer is ill");

        assertEquals(CareBookingStatus.CANCELLED, dto.getStatus());
        assertEquals(List.of(b.getAdvanceAmount()), refunds);
    }

    @Test
    void stepsOutOfOrderAreRefused() {
        paidBooking("2027-03-08", "10:00");

        assertThrows(BadRequestException.class, () -> service.complete(20L, 900L), "complete before accepting");
        service.accept(20L, 900L);
        assertThrows(BadRequestException.class, () -> service.accept(20L, 900L), "accept twice");
        assertThrows(BadRequestException.class, () -> service.reject(20L, 900L, "too late"), "reject after accepting");
    }

    @Test
    void onlyTheBookingsOwnProviderCanActOnIt() {
        paidBooking("2027-03-08", "10:00");

        assertThrows(UnauthorizedException.class, () -> service.accept(21L, 900L));
        assertThrows(UnauthorizedException.class, () -> service.cancelByCustomer(11L, 900L, null));
    }

    // ================================================================== reviews

    @Test
    void aCompletedBookingCanBeReviewedOnce_andTheProviderRatingIsUpdated() {
        CareBooking b = paidBooking("2027-03-08", "10:00");
        service.accept(20L, 900L);
        b.setBookingDate(TODAY);
        service.complete(20L, 900L);
        when(reviewRepository.save(any())).thenAnswer(i -> {
            CareReview r = i.getArgument(0);
            r.setId(1L);
            return r;
        });
        when(reviewRepository.averageRating(2L)).thenReturn(4.5);
        when(reviewRepository.countByProviderId(2L)).thenReturn(2L);

        service.review(10L, 900L, ReviewRequest.builder().rating(5).comment("Great").build());

        assertEquals(new BigDecimal("4.50"), provider.getRatingAvg());
        assertEquals(2, provider.getReviewCount());

        when(reviewRepository.existsByBookingId(900L)).thenReturn(true);
        assertThrows(BadRequestException.class, () -> service.review(10L, 900L, ReviewRequest.builder().rating(4).build()));
    }

    @Test
    void anUncompletedBookingCannotBeReviewed() {
        paidBooking("2027-03-08", "10:00");

        assertThrows(BadRequestException.class, () -> service.review(10L, 900L, ReviewRequest.builder().rating(5).build()));
    }

    // ------------------------------------------------------------------

    private CareBooking bookingOf(BookingDto dto) {
        CareBooking[] holder = new CareBooking[1];
        verify(bookingRepository, atLeastOnce()).save(argThat(b -> { holder[0] = b; return true; }));
        CareBooking b = holder[0];
        when(bookingRepository.findByIdForUpdate(dto.getId())).thenReturn(Optional.of(b));
        when(bookingRepository.findById(dto.getId())).thenReturn(Optional.of(b));
        return b;
    }
}
