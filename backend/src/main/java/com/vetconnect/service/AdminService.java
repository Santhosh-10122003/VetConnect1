package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.domain.entities.ProviderProfile;
import com.vetconnect.domain.entities.User;
import com.vetconnect.dto.care.CareDtos.ProviderDto;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.admin.AdminDashboardStatsDto;
import com.vetconnect.dto.admin.DoctorVerificationRequest;
import com.vetconnect.dto.appointment.AppointmentDto;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PetRepository petRepository;
    private final AppointmentRepository appointmentRepository;
    private final ReviewRepository reviewRepository;
    private final DoctorService doctorService;
    private final AppointmentService appointmentService;
    private final NotificationService notificationService;
    private final ProviderProfileRepository providerRepository;
    private final ProviderService providerService;

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getDashboardStats() {
        long totalCustomers = customerProfileRepository.count();
        long totalDoctors = doctorProfileRepository.findAll().stream().filter(d -> emailConfirmed(d.getUser())).count();
        long pendingVerifications = verifiedDoctors(VerificationStatus.PENDING).size();
        long resubmittedVerifications = verifiedDoctors(VerificationStatus.RESUBMITTED).size();
        long pendingProviders = verifiedProviders(VerificationStatus.PENDING).size();
        long resubmittedProviders = verifiedProviders(VerificationStatus.RESUBMITTED).size();
        long totalPets = petRepository.count();
        long totalAppointments = appointmentRepository.count();
        long completedAppointments = appointmentRepository.countByStatus(AppointmentStatus.COMPLETED);
        long pendingAppointments = appointmentRepository.countByStatus(AppointmentStatus.PENDING);
        long totalReviews = reviewRepository.count();

        return AdminDashboardStatsDto.builder()
                .totalCustomers(totalCustomers)
                .totalDoctors(totalDoctors)
                .pendingDoctorVerifications(pendingVerifications)
                .resubmittedDoctorVerifications(resubmittedVerifications)
                .pendingProviderVerifications(pendingProviders)
                .resubmittedProviderVerifications(resubmittedProviders)
                .totalPets(totalPets)
                .totalAppointments(totalAppointments)
                .completedAppointments(completedAppointments)
                .pendingAppointments(pendingAppointments)
                .totalReviews(totalReviews)
                .build();
    }

    /** First-time applicants waiting for a decision. */
    private static boolean emailConfirmed(User user) {
        return user != null && !Boolean.FALSE.equals(user.getEmailVerified());
    }

    /** A profile created at sign-up exists before the email code is confirmed; the admin only sees confirmed ones. */
    private List<DoctorProfile> verifiedDoctors(VerificationStatus status) {
        return doctorProfileRepository.findByVerificationStatus(status).stream()
                .filter(d -> emailConfirmed(d.getUser())).collect(Collectors.toList());
    }

    private List<ProviderProfile> verifiedProviders(VerificationStatus status) {
        return providerRepository.findByVerificationStatus(status).stream()
                .filter(p -> emailConfirmed(p.getUser())).collect(Collectors.toList());
    }

    private static void requireConfirmedEmail(User user, String who) {
        if (!emailConfirmed(user)) {
            throw new BadRequestException("This " + who + " has not confirmed their email yet, so they cannot be reviewed.");
        }
    }

    @Transactional(readOnly = true)
    public List<DoctorProfileDto> getPendingDoctors() {
        return verifiedDoctors(VerificationStatus.PENDING)
                .stream()
                .map(doctorService::toOwnerDto)
                .collect(Collectors.toList());
    }

    /** Doctors who were rejected, fixed their details and asked to be reviewed again. */
    @Transactional(readOnly = true)
    public List<DoctorProfileDto> getResubmittedDoctors() {
        return verifiedDoctors(VerificationStatus.RESUBMITTED)
                .stream()
                .sorted(java.util.Comparator.comparing(DoctorProfile::getResubmittedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .map(doctorService::toOwnerDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public DoctorProfileDto updateDoctorVerification(Long doctorId, DoctorVerificationRequest request) {
        DoctorProfile doctor = doctorProfileRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + doctorId));

        requireConfirmedEmail(doctor.getUser(), "doctor");
        VerificationStatus decision = request.getStatus();
        if (decision != VerificationStatus.APPROVED && decision != VerificationStatus.REJECTED) {
            log.warn("Verification rejected: invalid decision {} for doctorId={}", decision, doctorId);
            throw new BadRequestException("Decision must be APPROVED or REJECTED.");
        }
        String reason = request.getRemarks().trim();

        doctor.setVerificationStatus(decision);
        doctor.setVerificationReason(reason);
        doctor.setReviewedAt(Instant.now());
        doctor.setResubmitNote(null);
        doctor = doctorProfileRepository.save(doctor);
        log.info("Doctor verification updated: doctorId={} status={} reason=\"{}\"", doctorId, decision, reason);

        String msg = decision == VerificationStatus.APPROVED
                ? "Congratulations! Your veterinary profile has been verified and approved. You can now accept patient appointments. Note from the admin: " + reason
                : "Your professional profile could not be approved. Reason: " + reason + ". Update your details under Profile and send it for approval again.";

        notificationService.createNotification(
                doctor.getUser(),
                "Profile Verification Update",
                msg,
                NotificationType.DOCTOR_VERIFIED,
                doctor.getId().toString()
        );

        return doctorService.toOwnerDto(doctor);
    }

    // ------------------------------------------------------------------ pet-care providers (same flow as doctors)

    @Transactional(readOnly = true)
    public List<ProviderDto> getPendingProviders() {
        return verifiedProviders(VerificationStatus.PENDING)
                .stream().map(providerService::toOwnerDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProviderDto> getResubmittedProviders() {
        return verifiedProviders(VerificationStatus.RESUBMITTED)
                .stream()
                .sorted(java.util.Comparator.comparing(ProviderProfile::getResubmittedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .map(providerService::toOwnerDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProviderDto updateProviderVerification(Long providerId, DoctorVerificationRequest request) {
        ProviderProfile p = providerRepository.findById(providerId)
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + providerId));
        requireConfirmedEmail(p.getUser(), "business");
        VerificationStatus decision = request.getStatus();
        if (decision != VerificationStatus.APPROVED && decision != VerificationStatus.REJECTED) {
            log.warn("Provider verification rejected: invalid decision {} for providerId={}", decision, providerId);
            throw new BadRequestException("Decision must be APPROVED or REJECTED.");
        }
        String reason = request.getRemarks().trim();
        if (decision == VerificationStatus.APPROVED && !p.isPayoutComplete()) {
            log.warn("Provider approval refused: providerId={} has no payment details", providerId);
            throw new BadRequestException("Payment details are missing. The business has to add where it gets paid before it can be approved.");
        }

        p.setVerificationStatus(decision);
        p.setVerificationReason(reason);
        p.setReviewedAt(Instant.now());
        p.setResubmitNote(null);
        p = providerRepository.save(p);
        log.info("Provider verification updated: providerId={} status={} reason=\"{}\"", providerId, decision, reason);

        String msg = decision == VerificationStatus.APPROVED
                ? "Congratulations! " + p.getBusinessName() + " has been approved and can now take bookings. Note from the admin: " + reason
                : p.getBusinessName() + " could not be approved. Reason: " + reason + ". Update your details under Profile and send it for approval again.";
        notificationService.createNotification(p.getUser(), "Pet-care profile update", msg, NotificationType.PROVIDER_VERIFIED, p.getId().toString());
        return providerService.toOwnerDto(p);
    }

    @Transactional(readOnly = true)
    public PageResponse<AppointmentDto> getAllAppointments(Pageable pageable) {
        return PageResponse.of(appointmentRepository.findAll(pageable).map(appointmentService::toDto));
    }
}
