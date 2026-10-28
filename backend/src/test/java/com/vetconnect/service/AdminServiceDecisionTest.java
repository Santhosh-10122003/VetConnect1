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
}
