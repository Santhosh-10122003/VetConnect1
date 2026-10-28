package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.BookingConflictException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.enums.PaymentStatus;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.care.CareDtos.CancellationPreviewDto;
import com.vetconnect.dto.care.CareDtos.CheckoutResultRequest;
import com.vetconnect.dto.care.CareDtos.SimulatePaymentRequest.Outcome;
import com.vetconnect.dto.appointment.BookAppointmentRequest;
import com.vetconnect.dto.appointment.RescheduleRequest;
import com.vetconnect.dto.appointment.StatusUpdateRequest;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final NotificationService notificationService;
    private final DoctorService doctorService;
    private final CarePaymentService paymentService;
    private final AppProperties appProperties;
    private final Clock clock;

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public AppointmentDto bookAppointment(Long userId, BookAppointmentRequest request) {
        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BadRequestException("Only registered customers can book appointments"));

        DoctorProfile doctor = doctorProfileRepository.findById(request.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + request.getDoctorId()));

        doctorService.assertCustomerCanAccess(customer, doctor);

        if (doctor.getVerificationStatus() != VerificationStatus.APPROVED) {
            log.warn("Appointment request rejected: {}", "This veterinarian is currently not accepting new appointments.");
            throw new BadRequestException("This veterinarian is currently not accepting new appointments.");
        }

        Pet pet = petRepository.findByIdAndCustomerId(request.getPetId(), customer.getId())
                .orElseThrow(() -> new BadRequestException("Selected pet is not associated with your account"));

        if (request.getAppointmentDate().isBefore(LocalDate.now())) {
            log.warn("Appointment request rejected: {}", "Appointment date cannot be in the past");
            throw new BadRequestException("Appointment date cannot be in the past");
        }

        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().equals(request.getEndTime())) {
            log.warn("Appointment request rejected: {}", "Start time must precede end time");
            throw new BadRequestException("Start time must precede end time");
        }

        // Concurrency / duplicate slot check
        boolean slotBooked = appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(
                doctor.getId(),
                request.getAppointmentDate(),
                request.getStartTime(),
                AppointmentStatus.SLOT_RELEASED
        );

        if (slotBooked) {
            log.warn("Appointment request rejected: {}", "The selected time slot is already booked");
            throw new BookingConflictException("The selected time slot (" + request.getStartTime() + ") is already booked. Please choose another slot.");
        }

        String refCode = "VC-" + request.getAppointmentDate().format(DateTimeFormatter.BASIC_ISO_DATE) + "-"
                + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        Appointment appointment = Appointment.builder()
                .bookingReference(refCode)
                .customer(customer)
                .doctor(doctor)
                .pet(pet)
                .appointmentDate(request.getAppointmentDate())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .reason(request.getReason())
                .status(AppointmentStatus.PENDING)
                .notes(request.getNotes())
                .build();

        // The advance (a share of the consultation fee) is paid up front; the rest is paid at the clinic.
        BigDecimal fee = doctor.getConsultationFee() == null ? BigDecimal.ZERO : doctor.getConsultationFee().setScale(2, RoundingMode.HALF_UP);
        BigDecimal advance = fee.multiply(BigDecimal.valueOf(appProperties.getClinic().getAdvancePercent()))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP).min(fee);
        appointment.setTotalAmount(fee);
        appointment.setAdvanceAmount(advance);
        appointment.setBalanceAmount(fee.subtract(advance));
        appointment.setCurrency(appProperties.getCare().getCurrency());
        boolean needsPayment = advance.signum() > 0;
        if (needsPayment) {
            appointment.setStatus(AppointmentStatus.AWAITING_PAYMENT);
            appointment.setExpiresAt(clock.instant().plus(appProperties.getCare().getHoldMinutes(), ChronoUnit.MINUTES));
        }

        appointment = appointmentRepository.save(appointment);
        log.info("Appointment booked: appointmentId={} userId={} status={} advance={}", appointment.getId(), userId, appointment.getStatus(), advance);

        if (needsPayment) {
            paymentService.createAdvance(appointment);
            return toDto(appointment);
        }
        notifyRequested(appointment);
        return toDto(appointment);
    }

    /** The request is in: tell the customer it was submitted and the doctor that there is something to answer. */
    private void notifyRequested(Appointment appointment) {
        CustomerProfile customer = appointment.getCustomer();
        DoctorProfile doctor = appointment.getDoctor();
        Pet pet = appointment.getPet();
        String refCode = appointment.getBookingReference();
        notificationService.createNotification(
                customer.getUser(),
                "Appointment Requested",
                "Your appointment request (" + refCode + ") with " + displayName(doctor) + " for " + pet.getName() + " on " + appointment.getAppointmentDate() + " at " + appointment.getStartTime() + " has been submitted.",
                NotificationType.BOOKING_CONFIRMED,
                refCode
        );

        notificationService.createNotification(
                doctor.getUser(),
                "New Appointment Request",
                "New consultation booking (" + refCode + ") requested by " + customer.getFullName() + " for " + pet.getName() + " on " + appointment.getAppointmentDate() + " at " + appointment.getStartTime() + ".",
                NotificationType.STATUS_CHANGE,
                refCode
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<AppointmentDto> getMyAppointments(Long userId, String tab, Pageable pageable) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Page<Appointment> page;
        List<AppointmentStatus> filterStatuses = getStatusesForTab(tab);

        if (user.getRole() == Role.ROLE_CUSTOMER) {
            CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Customer profile not found"));
            if (filterStatuses != null && !filterStatuses.isEmpty()) {
                page = appointmentRepository.findByCustomerIdAndStatusInOrderByAppointmentDateDescStartTimeDesc(
                        customer.getId(), filterStatuses, pageable);
            } else {
                page = appointmentRepository.findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(
                        customer.getId(), pageable);
            }
        } else if (user.getRole() == Role.ROLE_DOCTOR) {
            DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found"));
            // an appointment whose advance is unpaid (or whose hold expired) is not the doctor's concern yet
            List<AppointmentStatus> visible = (filterStatuses != null && !filterStatuses.isEmpty() ? filterStatuses : Arrays.asList(AppointmentStatus.values())).stream()
                    .filter(st -> st != AppointmentStatus.AWAITING_PAYMENT && st != AppointmentStatus.EXPIRED).toList();
            page = appointmentRepository.findByDoctorIdAndStatusInOrderByAppointmentDateDescStartTimeDesc(
                    doctor.getId(), visible, pageable);
        } else {
            page = appointmentRepository.findAll(pageable);
        }

        return PageResponse.of(page.map(this::toDto));
    }

    @Transactional(readOnly = true)
    public AppointmentDto getAppointmentById(Long appointmentId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + appointmentId));

        validateAppointmentAccess(appt, user);
        if (user.getRole() == Role.ROLE_DOCTOR && (appt.getStatus() == AppointmentStatus.AWAITING_PAYMENT || appt.getStatus() == AppointmentStatus.EXPIRED)) {
            throw new ResourceNotFoundException("Appointment not found with ID: " + appointmentId);
        }
        return toDto(appt);
    }

    @Transactional
    public AppointmentDto confirmAppointment(Long appointmentId, Long userId, StatusUpdateRequest request) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Only the assigned doctor can confirm appointments"));

        if (!appt.getDoctor().getId().equals(doctor.getId())) {
            log.warn("Appointment request rejected: {}", "You are not authorized to confirm this appointment");
            throw new UnauthorizedException("You are not authorized to confirm this appointment");
        }

        if (appt.getStatus() != AppointmentStatus.PENDING) {
            log.warn("Appointment request rejected: {}", "Only pending appointments can be confirmed");
            throw new BadRequestException("Only pending appointments can be confirmed");
        }

        appt.setStatus(AppointmentStatus.CONFIRMED);
        if (request != null && request.getNotes() != null) {
            appt.setNotes(request.getNotes());
        }

        appt = appointmentRepository.save(appt);
        log.info("Appointment confirmed: appointmentId={} userId={} status={}", appt.getId(), userId, appt.getStatus());

        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Appointment Confirmed!",
                displayName(doctor) + " has confirmed your appointment (" + appt.getBookingReference() + ") for " + appt.getAppointmentDate() + " at " + appt.getStartTime() + ".",
                NotificationType.BOOKING_CONFIRMED,
                appt.getBookingReference()
        );

        return toDto(appt);
    }

    @Transactional
    public AppointmentDto rejectAppointment(Long appointmentId, Long userId, StatusUpdateRequest request) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Only the assigned doctor can reject appointments"));

        if (!appt.getDoctor().getId().equals(doctor.getId())) {
            log.warn("Appointment request rejected: {}", "You are not authorized to reject this appointment");
            throw new UnauthorizedException("You are not authorized to reject this appointment");
        }

        if (appt.getStatus() != AppointmentStatus.PENDING && appt.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BadRequestException("Only pending or confirmed appointments can be rejected.");
        }
        appt.setStatus(AppointmentStatus.REJECTED);
        appt.clearRescheduleRequest();
        if (request != null && request.getReason() != null) {
            appt.setCancellationReason(request.getReason());
        }

        appt = appointmentRepository.save(appt);
        BigDecimal refunded = refundAdvance(appt, appt.getAdvanceAmount(), "doctor rejected");
        log.info("Appointment rejected: appointmentId={} userId={} status={} refunded={}", appt.getId(), userId, appt.getStatus(), refunded);

        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Appointment Rejected",
                "Your appointment request (" + appt.getBookingReference() + ") was declined. Reason: " + (request != null && request.getReason() != null ? request.getReason() : "Doctor unavailable")
                        + (refunded.signum() > 0 ? ". Your advance of " + money(refunded, appt) + " is being refunded." : ""),
                NotificationType.BOOKING_REJECTED,
                appt.getBookingReference()
        );

        return toDto(appt);
    }

    @Transactional
    public AppointmentDto cancelAppointment(Long appointmentId, Long userId, StatusUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        validateAppointmentAccess(appt, user);

        if (appt.getStatus() == AppointmentStatus.COMPLETED) {
            log.warn("Appointment request rejected: {}", "Completed appointments cannot be cancelled");
            throw new BadRequestException("Completed appointments cannot be cancelled");
        }
        if (appt.getStatus() != AppointmentStatus.AWAITING_PAYMENT && appt.getStatus() != AppointmentStatus.PENDING && appt.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BadRequestException("This appointment cannot be cancelled any more.");
        }

        // The customer gets the advance back when cancelling early enough; a doctor (or admin) cancelling refunds it all.
        boolean byCustomer = user.getRole() == Role.ROLE_CUSTOMER;
        boolean wasPaid = appt.getStatus() != AppointmentStatus.AWAITING_PAYMENT;
        BigDecimal refunded = BigDecimal.ZERO;
        if (wasPaid) {
            BigDecimal refundable = byCustomer ? cancellationPreview(appt).getRefundAmount() : appt.getAdvanceAmount();
            refunded = refundAdvance(appt, refundable, byCustomer ? "customer cancelled in time" : "cancelled by the clinic");
        } else {
            paymentService.latestForAppointment(appt.getId()).ifPresent(paymentService::expire);
        }

        appt.setStatus(AppointmentStatus.CANCELLED);
        appt.setExpiresAt(null);
        appt.clearRescheduleRequest();
        if (request != null && request.getReason() != null) {
            appt.setCancellationReason(request.getReason());
        }

        appt = appointmentRepository.save(appt);
        log.info("Appointment cancelled: appointmentId={} userId={} status={} refunded={}", appt.getId(), userId, appt.getStatus(), refunded);

        // Notify other party
        User recipient = user.getRole() == Role.ROLE_CUSTOMER ? appt.getDoctor().getUser() : appt.getCustomer().getUser();
        notificationService.createNotification(
                recipient,
                "Appointment Cancelled",
                "Appointment (" + appt.getBookingReference() + ") has been cancelled."
                        + (!byCustomer && refunded.signum() > 0 ? " Your advance of " + money(refunded, appt) + " is being refunded." : ""),
                NotificationType.BOOKING_CANCELLED,
                appt.getBookingReference()
        );

        return toDto(appt);
    }

    @Transactional
    public AppointmentDto completeAppointment(Long appointmentId, Long userId, StatusUpdateRequest request) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Only the assigned veterinarian can complete appointments"));

        if (!appt.getDoctor().getId().equals(doctor.getId())) {
            log.warn("Appointment request rejected: {}", "You are not authorized to complete this appointment");
            throw new UnauthorizedException("You are not authorized to complete this appointment");
        }

        if (appt.getStatus() != AppointmentStatus.PENDING && appt.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BadRequestException("Only pending or confirmed appointments can be completed.");
        }
        appt.setStatus(AppointmentStatus.COMPLETED);
        appt.clearRescheduleRequest();
        if (request != null && request.getNotes() != null) {
            appt.setNotes(request.getNotes());
        }

        appt = appointmentRepository.save(appt);
        log.info("Appointment completed: appointmentId={} userId={} status={}", appt.getId(), userId, appt.getStatus());

        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Consultation Completed",
                "Your consultation with " + displayName(doctor) + " for " + appt.getPet().getName() + " is complete. You can now view medical notes and leave a review.",
                NotificationType.BOOKING_COMPLETED,
                appt.getBookingReference()
        );

        return toDto(appt);
    }

    /**
     * The owner asks for another time. The appointment keeps its current slot until the doctor approves, so a
     * request never silently moves anything.
     */
    @Transactional
    public AppointmentDto rescheduleAppointment(Long appointmentId, Long userId, RescheduleRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Appointment appt = appointmentRepository.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        validateAppointmentAccess(appt, user);
        if (user.getRole() != Role.ROLE_CUSTOMER) {
            throw new BadRequestException("Only the pet owner can ask to reschedule. Doctors can approve or decline the request.");
        }

        if (appt.getStatus() == AppointmentStatus.AWAITING_PAYMENT) {
            throw new BadRequestException("Pay the advance first, then you can reschedule.");
        }
        if (appt.getStatus() != AppointmentStatus.PENDING && appt.getStatus() != AppointmentStatus.CONFIRMED) {
            log.warn("Appointment request rejected: {}", "Cannot reschedule completed or cancelled appointments");
            throw new BadRequestException("Cannot reschedule completed or cancelled appointments");
        }
        if (appt.hasRescheduleRequest()) {
            throw new BadRequestException("You already have a reschedule request waiting for the doctor. Withdraw it first to send another.");
        }
        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().equals(request.getEndTime())) {
            throw new BadRequestException("Start time must precede end time");
        }
        if (request.getAppointmentDate().equals(appt.getAppointmentDate()) && request.getStartTime().equals(appt.getStartTime())) {
            throw new BadRequestException("That is the time you already have. Choose a different one.");
        }
        ensureSlotFree(appt.getDoctor().getId(), request.getAppointmentDate(), request.getStartTime(),
                "The selected reschedule slot is already booked. Please choose another time.");

        appt.setRescheduleDate(request.getAppointmentDate());
        appt.setRescheduleStartTime(request.getStartTime());
        appt.setRescheduleEndTime(request.getEndTime());
        appt.setRescheduleNote(request.getNote() == null || request.getNote().isBlank() ? null : request.getNote().trim());
        appt.setRescheduleRequestedAt(clock.instant());

        appt = appointmentRepository.save(appt);
        log.info("Reschedule requested: appointmentId={} userId={} to {} {}", appt.getId(), userId, request.getAppointmentDate(), request.getStartTime());

        notificationService.createNotification(
                appt.getDoctor().getUser(),
                "Reschedule requested",
                appt.getCustomer().getFullName() + " asked to move " + appt.getBookingReference() + " from " + appt.getAppointmentDate() + " "
                        + appt.getStartTime() + " to " + request.getAppointmentDate() + " " + request.getStartTime()
                        + (appt.getRescheduleNote() != null ? ". Note: " + appt.getRescheduleNote() : "") + ". Please approve or decline.",
                NotificationType.STATUS_CHANGE,
                appt.getBookingReference()
        );
        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Reschedule request sent",
                "Your request to move " + appt.getBookingReference() + " to " + request.getAppointmentDate() + " " + request.getStartTime()
                        + " was sent to " + displayName(appt.getDoctor()) + ". Your current time stays until they approve.",
                NotificationType.STATUS_CHANGE,
                appt.getBookingReference()
        );
        return toDto(appt);
    }

    /** The doctor accepts the new time: the appointment moves and is confirmed. */
    @Transactional
    public AppointmentDto approveReschedule(Long appointmentId, Long userId) {
        Appointment appt = lockedDoctorAppointment(appointmentId, userId);
        requireRescheduleRequest(appt);
        LocalDate date = appt.getRescheduleDate();
        var start = appt.getRescheduleStartTime();
        var end = appt.getRescheduleEndTime();
        try {
            ensureSlotFree(appt.getDoctor().getId(), date, start, "That time has been taken since the request was made. Decline it and ask the owner to pick another.");
        } catch (BookingConflictException e) {
            log.warn("Reschedule approval rejected: appointmentId={} slot taken", appt.getId());
            throw e;
        }
        appt.setAppointmentDate(date);
        appt.setStartTime(start);
        appt.setEndTime(end);
        appt.setStatus(AppointmentStatus.CONFIRMED);
        appt.clearRescheduleRequest();
        appt = appointmentRepository.save(appt);
        log.info("Reschedule approved: appointmentId={} doctorUserId={} now {} {}", appt.getId(), userId, date, start);

        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Reschedule approved",
                displayName(appt.getDoctor()) + " approved the new time for " + appt.getBookingReference() + ": " + date + " at " + start + ".",
                NotificationType.BOOKING_CONFIRMED,
                appt.getBookingReference()
        );
        return toDto(appt);
    }

    /** The doctor declines: the appointment stays where it was and the owner is told why. */
    @Transactional
    public AppointmentDto rejectReschedule(Long appointmentId, Long userId, StatusUpdateRequest request) {
        Appointment appt = lockedDoctorAppointment(appointmentId, userId);
        requireRescheduleRequest(appt);
        String reason = request == null || request.getReason() == null ? "" : request.getReason().trim();
        if (reason.length() < 3) throw new BadRequestException("Please give the owner a short reason, e.g. that day is fully booked.");
        appt.clearRescheduleRequest();
        appt = appointmentRepository.save(appt);
        log.info("Reschedule declined: appointmentId={} doctorUserId={}", appt.getId(), userId);

        notificationService.createNotification(
                appt.getCustomer().getUser(),
                "Reschedule declined",
                displayName(appt.getDoctor()) + " could not move " + appt.getBookingReference() + ". Your appointment stays on "
                        + appt.getAppointmentDate() + " at " + appt.getStartTime() + ". Reason: " + reason,
                NotificationType.STATUS_CHANGE,
                appt.getBookingReference()
        );
        return toDto(appt);
    }

    /** The owner takes the request back. */
    @Transactional
    public AppointmentDto withdrawReschedule(Long appointmentId, Long userId) {
        Appointment appt = lockedOwnAppointment(userId, appointmentId);
        requireRescheduleRequest(appt);
        appt.clearRescheduleRequest();
        appt = appointmentRepository.save(appt);
        log.info("Reschedule withdrawn: appointmentId={} userId={}", appt.getId(), userId);
        notificationService.createNotification(
                appt.getDoctor().getUser(),
                "Reschedule withdrawn",
                appt.getCustomer().getFullName() + " withdrew the reschedule request for " + appt.getBookingReference() + ". The appointment stays as it was.",
                NotificationType.STATUS_CHANGE,
                appt.getBookingReference()
        );
        return toDto(appt);
    }

    private void requireRescheduleRequest(Appointment appt) {
        if (!appt.hasRescheduleRequest()) throw new BadRequestException("There is no reschedule request on this appointment.");
    }

    private void ensureSlotFree(Long doctorId, LocalDate date, java.time.LocalTime start, String message) {
        if (date.isBefore(LocalDate.now())) throw new BadRequestException("Appointment date cannot be in the past");
        boolean taken = appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(
                doctorId, date, start, AppointmentStatus.SLOT_RELEASED);
        if (taken) {
            log.warn("Appointment request rejected: {}", message);
            throw new BookingConflictException(message);
        }
    }

    private Appointment lockedDoctorAppointment(Long appointmentId, Long userId) {
        Appointment appt = appointmentRepository.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Only the assigned doctor can answer reschedule requests"));
        if (!appt.getDoctor().getId().equals(doctor.getId())) {
            throw new UnauthorizedException("You are not authorized to answer this request");
        }
        return appt;
    }

    // ================================================================== advance payment

    /** Test-mode payment: the customer presses Pay (or Fail) on the test screen. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public AppointmentDto settleTestPayment(Long userId, Long appointmentId, Outcome outcome) {
        if (paymentService.hasCheckout()) throw new BadRequestException("Test payments are switched off. Please pay with the checkout.");
        Appointment appt = lockedOwnAppointment(userId, appointmentId);
        CarePayment payment = openPayment(appt);
        if (outcome == Outcome.FAILURE) {
            paymentService.markFailed(payment, "Payment was declined (test)");
            return toDto(appt);
        }
        paymentService.markPaid(payment);
        return afterPaid(appt);
    }

    /** The checkout (Razorpay) reports success: the signature is verified before anything is marked paid. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public AppointmentDto confirmCheckout(Long userId, Long appointmentId, CheckoutResultRequest result) {
        Appointment appt = lockedOwnAppointment(userId, appointmentId);
        if (appt.getStatus() == AppointmentStatus.AWAITING_PAYMENT && !appt.getExpiresAt().isAfter(clock.instant())) {
            // Paid just as the hold ran out: take the money only to give it straight back.
            CarePayment late = paymentService.latestForAppointment(appt.getId()).orElseThrow(() -> new BadRequestException("There is no payment for this appointment."));
            paymentService.confirmCheckout(late, result.getRazorpayOrderId(), result.getRazorpayPaymentId(), result.getRazorpaySignature());
            paymentService.refund(late, late.getAmount(), "paid after the hold expired");
            expireOne(appt);
            throw new BadRequestException("The payment window had closed, so the slot was released and your payment has been refunded. Please book again.");
        }
        CarePayment payment = openPayment(appt);
        paymentService.confirmCheckout(payment, result.getRazorpayOrderId(), result.getRazorpayPaymentId(), result.getRazorpaySignature());
        return afterPaid(appt);
    }

    /** The checkout reports a declined payment; the slot stays held and the customer can try again. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public AppointmentDto paymentFailed(Long userId, Long appointmentId, String reason) {
        Appointment appt = lockedOwnAppointment(userId, appointmentId);
        paymentService.markFailed(openPayment(appt), reason == null || reason.isBlank() ? "Payment was declined" : reason.trim());
        return toDto(appt);
    }

    /** After a failed payment the customer can try again while the slot is held. */
    @Transactional
    public AppointmentDto retryPayment(Long userId, Long appointmentId) {
        Appointment appt = lockedOwnAppointment(userId, appointmentId);
        if (appt.getStatus() != AppointmentStatus.AWAITING_PAYMENT || !appt.getExpiresAt().isAfter(clock.instant())) {
            throw new BadRequestException("This appointment can no longer be paid. Please book again.");
        }
        CarePayment last = paymentService.latestForAppointment(appt.getId()).orElse(null);
        if (last == null || last.getStatus() != PaymentStatus.CREATED) paymentService.createAdvance(appt);
        return toDto(appt);
    }

    @Transactional(readOnly = true)
    public CancellationPreviewDto cancellationPreview(Long userId, Long appointmentId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        if (!appt.getCustomer().getUser().getId().equals(userId)) throw new UnauthorizedException("You do not have access to this appointment");
        return cancellationPreview(appt);
    }

    /** What the customer gets back if they cancel right now. */
    private CancellationPreviewDto cancellationPreview(Appointment a) {
        int window = appProperties.getCare().getCancellationWindowHours();
        boolean paid = a.getStatus() == AppointmentStatus.PENDING || a.getStatus() == AppointmentStatus.CONFIRMED;
        BigDecimal paidAmount = paid ? paymentService.latestForAppointment(a.getId())
                .map(p -> p.getAmount().subtract(p.getRefundedAmount())).orElse(BigDecimal.ZERO) : BigDecimal.ZERO;
        boolean inTime = !LocalDateTime.now(clock).isAfter(LocalDateTime.of(a.getAppointmentDate(), a.getStartTime()).minusHours(window));
        boolean refundable = paid && inTime && paidAmount.signum() > 0;
        String message;
        if (!paid) message = "Nothing has been charged yet, so there is nothing to refund.";
        else if (refundable) message = "Cancelling now refunds your advance of " + money(paidAmount, a) + " in full.";
        else message = "Cancelling less than " + window + " hours before the visit does not refund the advance of " + money(paidAmount, a) + ".";
        return CancellationPreviewDto.builder()
                .refundable(refundable).refundAmount(refundable ? paidAmount : BigDecimal.ZERO).paidAmount(paidAmount)
                .currency(a.getCurrency()).windowHours(window).message(message).build();
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
    @Transactional
    public void expireStaleHolds() {
        List<Appointment> stale = appointmentRepository.findByStatusAndExpiresAtBefore(AppointmentStatus.AWAITING_PAYMENT, clock.instant());
        stale.forEach(this::expireOne);
        if (!stale.isEmpty()) log.info("Released {} unpaid appointment hold(s)", stale.size());
    }

    private void expireOne(Appointment a) {
        if (a.getStatus() != AppointmentStatus.AWAITING_PAYMENT) return;
        a.setStatus(AppointmentStatus.EXPIRED);
        a.setCancellationReason("The advance payment was not made in time.");
        a.setExpiresAt(null);
        appointmentRepository.save(a);
        paymentService.latestForAppointment(a.getId()).ifPresent(paymentService::expire);
        notificationService.createNotification(a.getCustomer().getUser(), "Appointment expired",
                "Your hold on " + a.getBookingReference() + " ended because the advance was not paid in time.",
                NotificationType.BOOKING_CANCELLED, a.getBookingReference());
    }

    /** The unpaid payment of an appointment that is still waiting for it (and still held). */
    private CarePayment openPayment(Appointment a) {
        if (a.getStatus() != AppointmentStatus.AWAITING_PAYMENT) {
            throw new BadRequestException("This appointment is no longer waiting for payment.");
        }
        if (!a.getExpiresAt().isAfter(clock.instant())) {
            expireOne(a);
            throw new BadRequestException("The payment window has closed and the slot was released. Please book again.");
        }
        return paymentService.latestForAppointment(a.getId())
                .filter(p -> p.getStatus() == PaymentStatus.CREATED || p.getStatus() == PaymentStatus.FAILED)
                .orElseThrow(() -> new BadRequestException("There is no open payment for this appointment. Tap retry to start a new one."));
    }

    private AppointmentDto afterPaid(Appointment appt) {
        appt.setStatus(AppointmentStatus.PENDING);
        appt.setExpiresAt(null);
        appt = appointmentRepository.save(appt);
        log.info("Appointment paid and requested: ref={}", appt.getBookingReference());
        notificationService.createNotification(appt.getCustomer().getUser(), "Payment received",
                "We received your advance of " + money(appt.getAdvanceAmount(), appt) + " for " + appt.getBookingReference() + ". Waiting for "
                        + displayName(appt.getDoctor()) + " to confirm.", NotificationType.BOOKING_CONFIRMED, appt.getBookingReference());
        notifyRequested(appt);
        return toDto(appt);
    }

    /** Gives back up to {@code wanted} of the advance. Returns what was actually refunded. */
    private BigDecimal refundAdvance(Appointment appt, BigDecimal wanted, String why) {
        return paymentService.latestForAppointment(appt.getId())
                .map(p -> paymentService.refund(p, wanted, why)).orElse(BigDecimal.ZERO);
    }

    private Appointment lockedOwnAppointment(Long userId, Long id) {
        Appointment a = appointmentRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        if (!a.getCustomer().getUser().getId().equals(userId)) throw new UnauthorizedException("You do not have access to this appointment");
        return a;
    }

    private String money(BigDecimal amount, Appointment a) {
        String symbol = a.getCurrency() != null && a.getCurrency().equals(appProperties.getCare().getCurrency()) ? appProperties.getCare().getCurrencySymbol() : (a.getCurrency() + " ");
        return symbol + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private void validateAppointmentAccess(Appointment appt, User user) {
        if (user.getRole() == Role.ROLE_ADMIN) return;
        if (user.getRole() == Role.ROLE_CUSTOMER && appt.getCustomer().getUser().getId().equals(user.getId())) return;
        if (user.getRole() == Role.ROLE_DOCTOR && appt.getDoctor().getUser().getId().equals(user.getId())) return;
        log.warn("Appointment request rejected: {}", "You do not have access to this appointment");
        throw new UnauthorizedException("You do not have access to this appointment");
    }

    private List<AppointmentStatus> getStatusesForTab(String tab) {
        if (tab == null) return null;
        return switch (tab.toUpperCase()) {
            case "UPCOMING" -> Arrays.asList(AppointmentStatus.AWAITING_PAYMENT, AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED);
            case "COMPLETED" -> List.of(AppointmentStatus.COMPLETED);
            case "CANCELLED" -> Arrays.asList(AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED, AppointmentStatus.NO_SHOW, AppointmentStatus.EXPIRED);
            default -> null;
        };
    }

    /** "Dr. " prefix exactly once, whether or not the stored name already includes it. */
    private static String displayName(DoctorProfile doctor) {
        return "Dr. " + doctor.getFullName().replaceFirst("(?i)^Dr\\.?\\s*", "");
    }

    public AppointmentDto toDto(Appointment a) {
        boolean hasReview = reviewRepository.existsByAppointmentId(a.getId());
        return AppointmentDto.builder()
                .id(a.getId())
                .bookingReference(a.getBookingReference())
                .customerId(a.getCustomer().getId())
                .customerName(a.getCustomer().getFullName())
                .customerPhone(a.getCustomer().getUser().getPhone())
                .customerEmail(a.getCustomer().getUser().getEmail())
                .doctorId(a.getDoctor().getId())
                .doctorName(a.getDoctor().getFullName())
                .clinicName(a.getDoctor().getClinicName())
                .clinicAddress(a.getDoctor().getClinicAddress())
                .clinicCity(a.getDoctor().getClinicCity())
                .clinicLatitude(a.getDoctor().getLatitude())
                .clinicLongitude(a.getDoctor().getLongitude())
                .consultationFee(a.getDoctor().getConsultationFee())
                .totalAmount(a.getTotalAmount())
                .advanceAmount(a.getAdvanceAmount())
                .balanceAmount(a.getBalanceAmount())
                .currency(a.getCurrency())
                .expiresAt(a.getExpiresAt())
                .rescheduleRequest(a.hasRescheduleRequest() ? AppointmentDto.RescheduleDto.builder()
                        .appointmentDate(a.getRescheduleDate()).startTime(a.getRescheduleStartTime()).endTime(a.getRescheduleEndTime())
                        .note(a.getRescheduleNote()).requestedAt(a.getRescheduleRequestedAt()).build() : null)
                .payment(paymentService.latestForAppointment(a.getId()).map(paymentService::toDto).orElse(null))
                .petId(a.getPet().getId())
                .petName(a.getPet().getName())
                .petSpecies(a.getPet().getSpecies().name())
                .petBreed(a.getPet().getBreed())
                .appointmentDate(a.getAppointmentDate())
                .startTime(a.getStartTime())
                .endTime(a.getEndTime())
                .reason(a.getReason())
                .status(a.getStatus())
                .cancellationReason(a.getCancellationReason())
                .notes(a.getNotes())
                .hasReview(hasReview)
                .createdAt(a.getCreatedAt())
                .build();
    }
}
