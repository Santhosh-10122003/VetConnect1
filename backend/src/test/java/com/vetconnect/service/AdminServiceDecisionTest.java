package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.NotificationType;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.admin.DoctorVerificationRequest;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceDecisionTest {

    @Mock private UserRepository userRepository;
    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private PetRepository petRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private ReviewRepository reviewRepository;
    @Mock private DoctorService doctorService;
    @Mock private AppointmentService appointmentService;
    @Mock private NotificationService notificationService;
    @Mock private ProviderProfileRepository providerRepository;
    @Mock private ProviderService providerService;

    private AdminService service;
    private DoctorProfile doctor;
    private User doctorUser;

    @BeforeEach
    void setUp() {
        service = new AdminService(userRepository, doctorProfileRepository, customerProfileRepository, petRepository,
                appointmentRepository, reviewRepository, doctorService, appointmentService, notificationService, providerRepository, providerService);
        doctorUser = User.builder().id(50L).email("dr@x.com").build();
        doctor = DoctorProfile.builder().id(7L).fullName("Dr. Test").user(doctorUser)
                .verificationStatus(VerificationStatus.PENDING).specializations(new HashSet<>()).build();
        lenient().when(doctorProfileRepository.findById(7L)).thenReturn(Optional.of(doctor));
        lenient().when(doctorProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(doctorService.toOwnerDto(any())).thenReturn(new DoctorProfileDto());
    }

    private DoctorVerificationRequest decision(VerificationStatus status, String reason) {
        return DoctorVerificationRequest.builder().status(status).remarks(reason).build();
    }

    @Test
    void rejection_storesTheReasonAndTellsTheDoctorWhyAndWhatToDoNext() {
        service.updateDoctorVerification(7L, decision(VerificationStatus.REJECTED, "  License photo is blurry  "));

        assertEquals(VerificationStatus.REJECTED, doctor.getVerificationStatus());
        assertEquals("License photo is blurry", doctor.getVerificationReason());
        assertNotNull(doctor.getReviewedAt());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notificationService).createNotification(eq(doctorUser), any(), message.capture(), eq(NotificationType.DOCTOR_VERIFIED), any());
        assertTrue(message.getValue().contains("License photo is blurry"));
        assertTrue(message.getValue().toLowerCase().contains("send it for approval again"));
    }

    @Test
    void approval_alsoRecordsTheAdminsNote() {
        service.updateDoctorVerification(7L, decision(VerificationStatus.APPROVED, "Credentials checked"));

        assertEquals(VerificationStatus.APPROVED, doctor.getVerificationStatus());
        assertEquals("Credentials checked", doctor.getVerificationReason());
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notificationService).createNotification(eq(doctorUser), any(), message.capture(), any(), any());
        assertTrue(message.getValue().contains("Credentials checked"));
    }

    @Test
    void decidingAResubmission_clearsTheDoctorsNoteAndMovesOn() {
        doctor.setVerificationStatus(VerificationStatus.RESUBMITTED);
        doctor.setResubmittedAt(Instant.now());
        doctor.setResubmitNote("I re-uploaded the license");

        service.updateDoctorVerification(7L, decision(VerificationStatus.APPROVED, "Looks good now"));

        assertEquals(VerificationStatus.APPROVED, doctor.getVerificationStatus());
        assertNull(doctor.getResubmitNote());
    }

    @Test
    void onlyApprovedOrRejectedAreValidDecisions() {
        assertThrows(BadRequestException.class,
                () -> service.updateDoctorVerification(7L, decision(VerificationStatus.RESUBMITTED, "x")));
        assertThrows(BadRequestException.class,
                () -> service.updateDoctorVerification(7L, decision(VerificationStatus.PENDING, "x")));
        assertEquals(VerificationStatus.PENDING, doctor.getVerificationStatus());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());
    }

    @Test
    void queuesAreSeparate_newApplicantsAndResubmissionsDoNotMix() {
        DoctorProfile resubmitted = DoctorProfile.builder().id(8L).fullName("Dr. Again").user(doctorUser)
                .verificationStatus(VerificationStatus.RESUBMITTED).specializations(new HashSet<>()).build();
        when(doctorProfileRepository.findByVerificationStatus(VerificationStatus.PENDING)).thenReturn(List.of(doctor));
        when(doctorProfileRepository.findByVerificationStatus(VerificationStatus.RESUBMITTED)).thenReturn(List.of(resubmitted));

        service.getPendingDoctors();
        service.getResubmittedDoctors();

        verify(doctorService).toOwnerDto(doctor);
        verify(doctorService).toOwnerDto(resubmitted);
        verify(doctorService, times(2)).toOwnerDto(any());
    }

    @Test
    void aPetCareBusinessWithoutPaymentDetailsCannotBeApproved_butCanBeRejected() {
        com.vetconnect.domain.entities.ProviderProfile biz = com.vetconnect.domain.entities.ProviderProfile.builder().id(9L).businessName("No Pay Pets")
                .user(doctorUser).verificationStatus(VerificationStatus.PENDING).build();
        when(providerRepository.findById(9L)).thenReturn(Optional.of(biz));
        lenient().when(providerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(providerService.toOwnerDto(any())).thenReturn(new com.vetconnect.dto.care.CareDtos.ProviderDto());

        BadRequestException e = assertThrows(BadRequestException.class, () -> service.updateProviderVerification(9L, decision(VerificationStatus.APPROVED, "looks fine")));
        assertTrue(e.getMessage().contains("Payment details are missing"));
        assertEquals(VerificationStatus.PENDING, biz.getVerificationStatus());

        service.updateProviderVerification(9L, decision(VerificationStatus.REJECTED, "Add your payment details"));
        assertEquals(VerificationStatus.REJECTED, biz.getVerificationStatus());

        biz.setPayoutMethod(com.vetconnect.domain.enums.PayoutMethod.UPI);
        biz.setUpiId("nopay@upi");
        service.updateProviderVerification(9L, decision(VerificationStatus.APPROVED, "details added"));
        assertEquals(VerificationStatus.APPROVED, biz.getVerificationStatus());
    }

    @Test
    void anAccountThatHasNotConfirmedItsEmailIsNotInTheAdminQueue_andCannotBeDecided() {
        User unverifiedUser = User.builder().id(60L).email("new@x.com").emailVerified(false).build();
        DoctorProfile unverified = DoctorProfile.builder().id(11L).fullName("Dr. Unverified").user(unverifiedUser)
                .verificationStatus(VerificationStatus.PENDING).specializations(new HashSet<>()).build();
        when(doctorProfileRepository.findByVerificationStatus(VerificationStatus.PENDING)).thenReturn(List.of(doctor, unverified));
        when(doctorProfileRepository.findById(11L)).thenReturn(Optional.of(unverified));

        service.getPendingDoctors();
        verify(doctorService).toOwnerDto(doctor);
        verify(doctorService, never()).toOwnerDto(unverified);

        BadRequestException e = assertThrows(BadRequestException.class, () -> service.updateDoctorVerification(11L, decision(VerificationStatus.APPROVED, "ok")));
        assertTrue(e.getMessage().contains("has not confirmed their email"));
        assertEquals(VerificationStatus.PENDING, unverified.getVerificationStatus());

        com.vetconnect.domain.entities.ProviderProfile biz = com.vetconnect.domain.entities.ProviderProfile.builder().id(12L).businessName("Unverified Pets")
                .user(unverifiedUser).verificationStatus(VerificationStatus.PENDING).build();
        com.vetconnect.domain.entities.ProviderProfile okBiz = com.vetconnect.domain.entities.ProviderProfile.builder().id(13L).businessName("Verified Pets")
                .user(doctorUser).verificationStatus(VerificationStatus.PENDING).build();
        when(providerRepository.findByVerificationStatus(VerificationStatus.PENDING)).thenReturn(List.of(biz, okBiz));
        when(providerRepository.findById(12L)).thenReturn(Optional.of(biz));
        lenient().when(providerService.toOwnerDto(any())).thenReturn(new com.vetconnect.dto.care.CareDtos.ProviderDto());

        service.getPendingProviders();
        verify(providerService).toOwnerDto(okBiz);
        verify(providerService, never()).toOwnerDto(biz);
        assertThrows(BadRequestException.class, () -> service.updateProviderVerification(12L, decision(VerificationStatus.REJECTED, "no")));
    }
}
