package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.domain.entities.Appointment;
import com.vetconnect.domain.entities.CareBooking;
import com.vetconnect.domain.entities.CarePayment;
import com.vetconnect.domain.enums.PaymentStatus;
import com.vetconnect.dto.care.CareDtos.PaymentDto;
import com.vetconnect.payment.PaymentGateway;
import com.vetconnect.repository.CarePaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;

/** The advance payment of a care booking: create it, settle it, refund it. Talks to the payment gateway. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CarePaymentService {

    private final CarePaymentRepository paymentRepository;
    private final PaymentGateway gateway;
    private final Clock clock;
    private final WalletService walletService;

    public boolean isTestMode() {
        return gateway.isTestMode();
    }

    /** True when payments go through a checkout (Razorpay) rather than the simulated test buttons. */
    public boolean hasCheckout() {
        return gateway.publicKey() != null;
    }

    public String gatewayName() {
        return gateway.name();
    }

    /** The advance for a vet appointment. */
    @Transactional
    public CarePayment createAdvance(Appointment appointment) {
        String orderId = gateway.createOrder(appointment.getBookingReference(), appointment.getAdvanceAmount(), appointment.getCurrency());
        CarePayment payment = paymentRepository.save(CarePayment.builder()
                .appointment(appointment)
                .amount(appointment.getAdvanceAmount())
                .currency(appointment.getCurrency())
                .status(PaymentStatus.CREATED)
                .gateway(gateway.name())
                .gatewayOrderId(orderId)
                .build());
        log.info("Payment created: paymentId={} appointment={} amount={} {} gateway={}",
                payment.getId(), appointment.getBookingReference(), payment.getAmount(), payment.getCurrency(), gateway.name());
        return payment;
    }

    public Optional<CarePayment> latestForAppointment(Long appointmentId) {
        return paymentRepository.findFirstByAppointmentIdOrderByIdDesc(appointmentId);
    }

    /**
     * Settles a payment from the checkout's reply. The signature is what proves it: without a valid one nothing is
     * marked paid, whatever the app claims.
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void confirmCheckout(CarePayment payment, String orderId, String paymentId, String signature) {
        if (payment.getStatus() != PaymentStatus.CREATED && payment.getStatus() != PaymentStatus.FAILED) {
            throw new BadRequestException("This payment has already been " + payment.getStatus().name().toLowerCase() + ".");
        }
        if (!payment.getGateway().equals(gateway.name()) || payment.getGatewayOrderId() == null
                || !payment.getGatewayOrderId().equals(orderId)
                || !gateway.verifySignature(orderId, paymentId, signature)) {
            log.warn("Payment signature rejected: paymentId={} ref={}", payment.getId(), payment.reference());
            throw new BadRequestException("We could not verify this payment. If money left your account it will be refunded; otherwise please try again.");
        }
        payment.setStatus(PaymentStatus.PAID);
        payment.setPaidAt(clock.instant());
        payment.setFailureReason(null);
        payment.setGatewayPaymentId(paymentId);
        paymentRepository.save(payment);
        walletService.creditAdvance(payment);
        log.info("Payment succeeded: paymentId={} ref={} amount={} gatewayPaymentId={}", payment.getId(), payment.reference(), payment.getAmount(), paymentId);
    }

    @Transactional
    public CarePayment createAdvance(CareBooking booking) {
        String orderId = gateway.createOrder(booking.getReference(), booking.getAdvanceAmount(), booking.getCurrency());
        CarePayment payment = paymentRepository.save(CarePayment.builder()
                .booking(booking)
                .amount(booking.getAdvanceAmount())
                .currency(booking.getCurrency())
                .status(PaymentStatus.CREATED)
                .gateway(gateway.name())
                .gatewayOrderId(orderId)
                .build());
        log.info("Payment created: paymentId={} booking={} amount={} {} gateway={}",
                payment.getId(), booking.getReference(), payment.getAmount(), payment.getCurrency(), gateway.name());
        return payment;
    }

    public Optional<CarePayment> latest(Long bookingId) {
        return paymentRepository.findFirstByBookingIdOrderByIdDesc(bookingId);
    }

    @Transactional
    public void markPaid(CarePayment payment) {
        if (payment.getStatus() != PaymentStatus.CREATED) {
            throw new BadRequestException("This payment has already been " + payment.getStatus().name().toLowerCase() + ".");
        }
        payment.setStatus(PaymentStatus.PAID);
        payment.setPaidAt(clock.instant());
        payment.setGatewayPaymentId("sim_pay_" + payment.getId());
        paymentRepository.save(payment);
        walletService.creditAdvance(payment);
        log.info("Payment succeeded: paymentId={} ref={} amount={}", payment.getId(), payment.reference(), payment.getAmount());
    }

    @Transactional(noRollbackFor = BadRequestException.class)
    public void markFailed(CarePayment payment, String reason) {
        if (payment.getStatus() != PaymentStatus.CREATED) {
            throw new BadRequestException("This payment has already been " + payment.getStatus().name().toLowerCase() + ".");
        }
        payment.setStatus(PaymentStatus.FAILED);
        payment.setFailureReason(reason);
        paymentRepository.save(payment);
        log.warn("Payment failed: paymentId={} ref={} reason={}", payment.getId(), payment.reference(), reason);
    }

    /** An unpaid payment whose booking was cancelled or ran out of time. */
    @Transactional
    public void expire(CarePayment payment) {
        if (payment.getStatus() == PaymentStatus.CREATED) {
            payment.setStatus(PaymentStatus.EXPIRED);
            paymentRepository.save(payment);
        }
    }

    /**
     * Gives money back (at most what is still unrefunded). Returns the amount actually refunded; zero when there
     * was nothing paid.
     */
    @Transactional
    public BigDecimal refund(CarePayment payment, BigDecimal requested, String why) {
        if (payment.getStatus() != PaymentStatus.PAID && payment.getStatus() != PaymentStatus.PARTIALLY_REFUNDED) return BigDecimal.ZERO;
        BigDecimal left = payment.getAmount().subtract(payment.getRefundedAmount());
        BigDecimal amount = requested.min(left).setScale(2, java.math.RoundingMode.HALF_UP);
        if (amount.signum() <= 0) return BigDecimal.ZERO;

        String refundId = gateway.refund(payment, amount);
        payment.setRefundedAmount(payment.getRefundedAmount().add(amount));
        payment.setStatus(payment.getRefundedAmount().compareTo(payment.getAmount()) >= 0 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
        payment.setRefundedAt(clock.instant());
        paymentRepository.save(payment);
        walletService.debitRefund(payment, amount);
        log.info("Refund issued: paymentId={} ref={} amount={} refundId={} why={}",
                payment.getId(), payment.reference(), amount, refundId, why);
        return amount;
    }

    public PaymentDto toDto(CarePayment p) {
        return PaymentDto.builder()
                .id(p.getId())
                .bookingId(p.getBooking() != null ? p.getBooking().getId() : null)
                .appointmentId(p.getAppointment() != null ? p.getAppointment().getId() : null)
                .keyId(gateway.publicKey())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .status(p.getStatus())
                .gateway(p.getGateway())
                .gatewayOrderId(p.getGatewayOrderId())
                .refundedAmount(p.getRefundedAmount())
                .failureReason(p.getFailureReason())
                .testMode(gateway.isTestMode())
                .paidAt(p.getPaidAt())
                .build();
    }
}
