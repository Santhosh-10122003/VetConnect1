package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.appointment.BookAppointmentRequest;
import com.vetconnect.dto.appointment.StatusUpdateRequest;
import com.vetconnect.dto.care.CareDtos.CancellationPreviewDto;
import com.vetconnect.dto.care.CareDtos.CheckoutResultRequest;
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

/** The advance payment of a vet appointment: 50% of the fee up front, a held slot, refunds and the checkout signature. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppointmentPaymentTest {

    private static final Instant NOW = Instant.parse("2030-03-01T10:00:00Z");
    private static final LocalDateTime NOW_LOCAL = LocalDateTime.of(2030, 3, 1, 10, 0);
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

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
    @Mock private WalletTransactionRepository walletRepository;
    private final List<WalletTransaction> ledger = new ArrayList<>();

    private final List<BigDecimal> refunds = new ArrayList<>();
    private final List<CarePayment> payments = new ArrayList<>();
    private AppointmentService service;
    private User customerUser, doctorUser;
    private CustomerProfile customer;
    private DoctorProfile doctor;
    private Pet pet;
    private boolean signatureOk = true;

    @BeforeEach
    void setUp() {
        PaymentGateway gateway = new PaymentGateway() {
            @Override public String name() { return "test"; }
            @Override public boolean isTestMode() { return true; }
            @Override public String publicKey() { return null; }
            @Override public String createOrder(String ref, BigDecimal amount, String currency) { return "order_" + ref; }
            @Override public boolean verifySignature(String orderId, String paymentId, String signature) { return signatureOk; }
            @Override public String refund(CarePayment payment, BigDecimal amount) { refunds.add(amount); return "refund_1"; }
        };
        when(walletRepository.save(any())).thenAnswer(i -> { ledger.add(i.getArgument(0)); return i.getArgument(0); });
        when(walletRepository.existsByPaymentIdAndType(anyLong(), any())).thenAnswer(i ->
                ledger.stream().anyMatch(t -> t.getType() == i.getArgument(1) && t.getPayment() != null && i.getArgument(0).equals(t.getPayment().getId())));
        CarePaymentService paymentService = new CarePaymentService(paymentRepository, gateway, CLOCK, new WalletService(walletRepository, new AppProperties()));
        service = new AppointmentService(appointmentRepository, customerProfileRepository, doctorProfileRepository, petRepository,
                userRepository, reviewRepository, medicalRecordRepository, notificationService, doctorService, paymentService,
                new AppProperties(), CLOCK);

        customerUser = User.builder().id(1L).email("c@x.com").role(Role.ROLE_CUSTOMER).isActive(true).build();
        customer = CustomerProfile.builder().id(10L).user(customerUser).fullName("Cathy").build();
        doctorUser = User.builder().id(2L).email("d@x.com").role(Role.ROLE_DOCTOR).isActive(true).build();
        doctor = DoctorProfile.builder().id(20L).user(doctorUser).fullName("Dr. Test").clinicName("Clinic").clinicAddress("Addr")
                .consultationFee(new BigDecimal("80.00")).verificationStatus(VerificationStatus.APPROVED).build();
        pet = Pet.builder().id(30L).customer(customer).name("Fluffy").species(PetSpecies.DOG).gender(Gender.FEMALE).build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(customerUser));
        when(userRepository.findById(2L)).thenReturn(Optional.of(doctorUser));
        when(customerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(customer));
        when(doctorProfileRepository.findById(20L)).thenReturn(Optional.of(doctor));
        when(doctorProfileRepository.findByUserId(2L)).thenReturn(Optional.of(doctor));
        when(petRepository.findByIdAndCustomerId(30L, 10L)).thenReturn(Optional.of(pet));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(anyLong(), any(), any(), any())).thenReturn(false);
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(i -> {
            Appointment a = i.getArgument(0);
            if (a.getId() == null) a.setId(99L);
            return a;
        });
        when(paymentRepository.save(any())).thenAnswer(i -> {
            CarePayment p = i.getArgument(0);
            if (p.getId() == null) p.setId((long) payments.size() + 1);
            if (!payments.contains(p)) payments.add(p);
            return p;
        });
        when(paymentRepository.findFirstByAppointmentIdOrderByIdDesc(anyLong())).thenAnswer(i -> payments.stream().reduce((a, b) -> b));
        when(reviewRepository.existsByAppointmentId(anyLong())).thenReturn(false);
    }

    private BookAppointmentRequest request() {
        return BookAppointmentRequest.builder().doctorId(20L).petId(30L).appointmentDate(LocalDate.now().plusDays(5))
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(10, 30)).reason("Checkup").build();
    }

    /** An appointment that was booked and paid, starting {@code hoursAhead} from NOW. */
    private Appointment paid(AppointmentStatus status, long hoursAhead) {
        LocalDateTime start = NOW_LOCAL.plusHours(hoursAhead);
        Appointment a = Appointment.builder().id(99L).bookingReference("VC-1").customer(customer).doctor(doctor).pet(pet)
                .appointmentDate(start.toLocalDate()).startTime(start.toLocalTime()).endTime(start.toLocalTime().plusMinutes(30))
                .reason("x").status(status).totalAmount(new BigDecimal("80.00")).advanceAmount(new BigDecimal("40.00"))
                .balanceAmount(new BigDecimal("40.00")).currency("USD").build();
        payments.add(CarePayment.builder().id(1L).appointment(a).amount(new BigDecimal("40.00")).currency("USD")
                .status(PaymentStatus.PAID).gateway("test").gatewayOrderId("order_VC-1").gatewayPaymentId("pay_1").build());
        when(appointmentRepository.findById(99L)).thenReturn(Optional.of(a));
        when(appointmentRepository.findByIdForUpdate(99L)).thenReturn(Optional.of(a));
        return a;
    }

    private Appointment held() {
        AppointmentDto dto = service.bookAppointment(1L, request());
        Appointment a = Appointment.builder().id(99L).bookingReference(dto.getBookingReference()).customer(customer).doctor(doctor).pet(pet)
                .appointmentDate(dto.getAppointmentDate()).startTime(dto.getStartTime()).endTime(dto.getEndTime()).reason("x")
                .status(dto.getStatus()).totalAmount(dto.getTotalAmount()).advanceAmount(dto.getAdvanceAmount())
                .balanceAmount(dto.getBalanceAmount()).currency(dto.getCurrency()).expiresAt(dto.getExpiresAt()).build();
        payments.forEach(p -> p.setAppointment(a));
        when(appointmentRepository.findByIdForUpdate(99L)).thenReturn(Optional.of(a));
        when(appointmentRepository.findById(99L)).thenReturn(Optional.of(a));
        return a;
    }

    private static CheckoutResultRequest checkout() {
        return CheckoutResultRequest.builder().razorpayOrderId("order_VC-1").razorpayPaymentId("pay_9").razorpaySignature("sig").build();
    }

    // ------------------------------------------------------------------ booking

    @Test
    void booking_holdsTheSlotAndAsksForHalfTheFee() {
        AppointmentDto dto = service.bookAppointment(1L, request());
        assertEquals(AppointmentStatus.AWAITING_PAYMENT, dto.getStatus());
        assertEquals(new BigDecimal("80.00"), dto.getTotalAmount());
        assertEquals(new BigDecimal("40.00"), dto.getAdvanceAmount());
        assertEquals(new BigDecimal("40.00"), dto.getBalanceAmount());
        assertEquals(NOW.plusSeconds(15 * 60), dto.getExpiresAt());
        assertNotNull(dto.getPayment());
        assertEquals(PaymentStatus.CREATED, dto.getPayment().getStatus());
        assertEquals(new BigDecimal("40.00"), dto.getPayment().getAmount());
        verify(notificationService, never()).createNotification(any(), anyString(), anyString(), any(), anyString());
    }

    @Test
    void booking_oddFeeRoundsTheAdvanceToTheCent() {
        doctor.setConsultationFee(new BigDecimal("33.33"));
        AppointmentDto dto = service.bookAppointment(1L, request());
        assertEquals(new BigDecimal("16.67"), dto.getAdvanceAmount());
        assertEquals(new BigDecimal("16.66"), dto.getBalanceAmount());
    }

    @Test
    void booking_freeConsultationNeedsNoPayment() {
        doctor.setConsultationFee(BigDecimal.ZERO);
        AppointmentDto dto = service.bookAppointment(1L, request());
        assertEquals(AppointmentStatus.PENDING, dto.getStatus());
        assertNull(dto.getPayment());
        verify(notificationService, times(2)).createNotification(any(), anyString(), anyString(), any(), anyString());
    }

    // ------------------------------------------------------------------ paying

    @Test
    void payingMovesTheAppointmentToTheDoctorAndNotifiesBoth() {
        held();
        AppointmentDto dto = service.settleTestPayment(1L, 99L, Outcome.SUCCESS);
        assertEquals(AppointmentStatus.PENDING, dto.getStatus());
        assertNull(dto.getExpiresAt());
        assertEquals(PaymentStatus.PAID, dto.getPayment().getStatus());
        verify(notificationService, times(3)).createNotification(any(), anyString(), anyString(), any(), anyString());
    }

    @Test
    void aDeclinedPaymentKeepsTheHoldAndCanBeRetried() {
        held();
        AppointmentDto failed = service.settleTestPayment(1L, 99L, Outcome.FAILURE);
        assertEquals(AppointmentStatus.AWAITING_PAYMENT, failed.getStatus());
        assertEquals(PaymentStatus.FAILED, failed.getPayment().getStatus());
        AppointmentDto retried = service.retryPayment(1L, 99L);
        assertEquals(PaymentStatus.CREATED, retried.getPayment().getStatus());
        assertEquals(AppointmentStatus.PENDING, service.settleTestPayment(1L, 99L, Outcome.SUCCESS).getStatus());
    }

    @Test
    void payingAfterTheHoldEndsIsRefusedAndTheSlotIsReleased() {
        Appointment a = held();
        a.setExpiresAt(NOW.minusSeconds(1));
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.settleTestPayment(1L, 99L, Outcome.SUCCESS));
        assertTrue(e.getMessage().contains("payment window has closed"));
        assertEquals(AppointmentStatus.EXPIRED, a.getStatus());
    }

    @Test
    void anotherCustomerCannotPay() {
        held();
        User other = User.builder().id(7L).email("o@x.com").role(Role.ROLE_CUSTOMER).build();
        customer.setUser(other); // the appointment now belongs to someone else
        assertThrows(UnauthorizedException.class, () -> service.settleTestPayment(1L, 99L, Outcome.SUCCESS));
    }

    @Test
    void aPaidAppointmentCannotBePaidTwice() {
        held();
        service.settleTestPayment(1L, 99L, Outcome.SUCCESS);
        assertThrows(BadRequestException.class, () -> service.settleTestPayment(1L, 99L, Outcome.SUCCESS));
    }

    @Test
    void staleHoldsAreReleased() {
        Appointment a = held();
        a.setExpiresAt(NOW.minusSeconds(5));
        when(appointmentRepository.findByStatusAndExpiresAtBefore(AppointmentStatus.AWAITING_PAYMENT, NOW)).thenReturn(List.of(a));
        service.expireStaleHolds();
        assertEquals(AppointmentStatus.EXPIRED, a.getStatus());
        assertEquals(PaymentStatus.EXPIRED, payments.get(0).getStatus());
    }

    // ------------------------------------------------------------------ the checkout signature

    @Test
    void aValidSignatureSettlesThePayment() {
        held();
        payments.get(0).setGatewayOrderId("order_VC-1");
        AppointmentDto dto = service.confirmCheckout(1L, 99L, checkout());
        assertEquals(AppointmentStatus.PENDING, dto.getStatus());
        assertEquals("pay_9", payments.get(0).getGatewayPaymentId());
    }

    @Test
    void aBadSignatureNeverMarksAnythingPaid() {
        Appointment a = held();
        payments.get(0).setGatewayOrderId("order_VC-1");
        signatureOk = false;
        assertThrows(BadRequestException.class, () -> service.confirmCheckout(1L, 99L, checkout()));
        assertEquals(AppointmentStatus.AWAITING_PAYMENT, a.getStatus());
        assertEquals(PaymentStatus.CREATED, payments.get(0).getStatus());
    }

    @Test
    void aSignatureForAnotherOrderIsRefused() {
        held();
        payments.get(0).setGatewayOrderId("order_SOMETHING_ELSE");
        assertThrows(BadRequestException.class, () -> service.confirmCheckout(1L, 99L, checkout()));
        assertEquals(PaymentStatus.CREATED, payments.get(0).getStatus());
    }

    @Test
    void aPaymentThatArrivesAfterTheHoldIsRefundedAtOnce() {
        Appointment a = held();
        payments.get(0).setGatewayOrderId("order_VC-1");
        a.setExpiresAt(NOW.minusSeconds(1));
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.confirmCheckout(1L, 99L, checkout()));
        assertTrue(e.getMessage().contains("refunded"));
        assertEquals(List.of(new BigDecimal("40.00")), refunds);
        assertEquals(AppointmentStatus.EXPIRED, a.getStatus());
    }

    @Test
    void aFailureReportedByTheCheckoutKeepsTheHold() {
        held();
        AppointmentDto dto = service.paymentFailed(1L, 99L, "Card declined");
        assertEquals(AppointmentStatus.AWAITING_PAYMENT, dto.getStatus());
        assertEquals("Card declined", dto.getPayment().getFailureReason());
    }

    // ------------------------------------------------------------------ refunds

    @Test
    void customerCancellingEarlyGetsTheAdvanceBack() {
        Appointment a = paid(AppointmentStatus.PENDING, 48);
        CancellationPreviewDto preview = service.cancellationPreview(1L, 99L);
        assertTrue(preview.isRefundable());
        assertEquals(new BigDecimal("40.00"), preview.getRefundAmount());
        service.cancelAppointment(99L, 1L, null);
        assertEquals(AppointmentStatus.CANCELLED, a.getStatus());
        assertEquals(List.of(new BigDecimal("40.00")), refunds);
    }

    @Test
    void customerCancellingLateKeepsNothingBack() {
        Appointment a = paid(AppointmentStatus.CONFIRMED, 5);
        CancellationPreviewDto preview = service.cancellationPreview(1L, 99L);
        assertFalse(preview.isRefundable());
        assertEquals(0, BigDecimal.ZERO.compareTo(preview.getRefundAmount()));
        service.cancelAppointment(99L, 1L, null);
        assertEquals(AppointmentStatus.CANCELLED, a.getStatus());
        assertTrue(refunds.isEmpty());
    }

    @Test
    void customerCancellingAnUnpaidHoldChargesNothing() {
        Appointment a = held();
        service.cancelAppointment(99L, 1L, null);
        assertEquals(AppointmentStatus.CANCELLED, a.getStatus());
        assertTrue(refunds.isEmpty());
        assertEquals(PaymentStatus.EXPIRED, payments.get(0).getStatus());
    }

    @Test
    void doctorCancellingAlwaysRefundsEverything() {
        Appointment a = paid(AppointmentStatus.CONFIRMED, 2);
        service.cancelAppointment(99L, 2L, null);
        assertEquals(AppointmentStatus.CANCELLED, a.getStatus());
        assertEquals(List.of(new BigDecimal("40.00")), refunds);
    }

    @Test
    void doctorRejectingRefundsEverything() {
        Appointment a = paid(AppointmentStatus.PENDING, 2);
        service.rejectAppointment(99L, 2L, StatusUpdateRequest.builder().reason("Fully booked").build());
        assertEquals(AppointmentStatus.REJECTED, a.getStatus());
        assertEquals(List.of(new BigDecimal("40.00")), refunds);
    }

    @Test
    void anAlreadyCancelledAppointmentCannotBeCancelledAgain() {
        paid(AppointmentStatus.CANCELLED, 48);
        assertThrows(BadRequestException.class, () -> service.cancelAppointment(99L, 1L, null));
        assertTrue(refunds.isEmpty());
    }

    // ------------------------------------------------------------------ guards

    @Test
    void anUnpaidAppointmentCannotBeRescheduledToSkipPayment() {
        held();
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.rescheduleAppointment(99L, 1L,
                com.vetconnect.dto.appointment.RescheduleRequest.builder().appointmentDate(LocalDate.now().plusDays(9))
                        .startTime(LocalTime.of(11, 0)).endTime(LocalTime.of(11, 30)).build()));
        assertTrue(e.getMessage().contains("Pay the advance"));
    }

    @Test
    void theDoctorDoesNotSeeAnUnpaidAppointment() {
        held();
        assertThrows(ResourceNotFoundException.class, () -> service.getAppointmentById(99L, 2L));
    }

    @Test
    void theDoctorCannotConfirmOrCompleteAnUnpaidAppointment() {
        held();
        assertThrows(BadRequestException.class, () -> service.confirmAppointment(99L, 2L, null));
        assertThrows(BadRequestException.class, () -> service.completeAppointment(99L, 2L, null));
    }

    // ------------------------------------------------------------------ the doctor's wallet

    private BigDecimal balance() {
        return ledger.stream().map(t -> t.getType() == WalletTxnType.CREDIT ? t.getAmount() : t.getAmount().negate()).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void aPaidAdvanceIsCreditedToTheDoctorsWallet() {
        held();
        assertTrue(ledger.isEmpty(), "nothing is credited before the payment");
        service.settleTestPayment(1L, 99L, Outcome.SUCCESS);
        assertEquals(1, ledger.size());
        WalletTransaction t = ledger.get(0);
        assertEquals(doctorUser, t.getUser(), "it goes to the doctor, not the customer");
        assertEquals(WalletTxnType.CREDIT, t.getType());
        assertEquals(new BigDecimal("40.00"), t.getAmount());
        assertTrue(t.getDescription().contains("VC-") || t.getDescription().contains("vet visit"));
    }

    @Test
    void aDeclinedOrUnpaidAttemptCreditsNothing() {
        held();
        service.settleTestPayment(1L, 99L, Outcome.FAILURE);
        service.cancelAppointment(99L, 1L, null);
        assertTrue(ledger.isEmpty());
    }

    @Test
    void aRefundTakesTheMoneyBackOutOfTheWallet() {
        held();
        service.settleTestPayment(1L, 99L, Outcome.SUCCESS);
        service.rejectAppointment(99L, 2L, StatusUpdateRequest.builder().reason("Fully booked").build());
        assertEquals(2, ledger.size());
        assertEquals(WalletTxnType.DEBIT, ledger.get(1).getType());
        assertEquals(0, BigDecimal.ZERO.compareTo(balance()), "credit and refund cancel out");
    }

    @Test
    void aCustomerCancellingLateLeavesTheAdvanceWithTheDoctor() {
        Appointment a = paid(AppointmentStatus.CONFIRMED, 5); // inside the 24 hour window: no refund
        ledger.add(WalletTransaction.builder().user(doctorUser).type(WalletTxnType.CREDIT).amount(new BigDecimal("40.00")).currency("USD").description("x").payment(payments.get(0)).build());
        service.cancelAppointment(99L, 1L, null);
        assertEquals(AppointmentStatus.CANCELLED, a.getStatus());
        assertEquals(new BigDecimal("40.00"), balance(), "the doctor keeps it");
    }

    @Test
    void theSamePaymentIsNeverCreditedTwice() {
        held();
        service.settleTestPayment(1L, 99L, Outcome.SUCCESS);
        // a replayed confirmation must not add money again
        new WalletService(walletRepository, new AppProperties()).creditAdvance(payments.get(0));
        assertEquals(1, ledger.size());
    }
}
