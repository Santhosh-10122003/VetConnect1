package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.domain.entities.CustomerProfile;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.Pet;
import com.vetconnect.domain.entities.ProviderProfile;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.AppointmentStatus;
import com.vetconnect.domain.enums.CareBookingStatus;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.domain.enums.WalletTxnType;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Deleting your own account. Everything that identifies the person is removed (name, number, address, payment
 * details, pets' details, documents, notifications, sign-in) and the number can be used to sign up again. What other
 * people's records and the accounts of money depend on (a past appointment, a payment, a review) stays, but now
 * points at "Deleted ..." instead of at a person.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private static final List<AppointmentStatus> OPEN_APPOINTMENTS = List.of(AppointmentStatus.AWAITING_PAYMENT, AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED);
    private static final List<CareBookingStatus> OPEN_BOOKINGS = List.of(CareBookingStatus.AWAITING_PAYMENT, CareBookingStatus.REQUESTED, CareBookingStatus.CONFIRMED);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomerProfileRepository customerProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final ProviderProfileRepository providerProfileRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final CareServiceRepository careServiceRepository;
    private final PetRepository petRepository;
    private final AppointmentRepository appointmentRepository;
    private final CareBookingRepository careBookingRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final NotificationRepository notificationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final DocumentService documentService;
    private final ProviderService providerService;

    /**
     * A pet owner who runs a pet-care business turns their account into a business account. The pets and the history
     * stay with the account, but the app then opens as a business (an account has one role). The business is
     * reviewed by an admin like any other, and it is refused while the owner still has bookings open.
     */
    @Transactional
    public com.vetconnect.dto.care.CareDtos.ProviderDto becomeBusiness(Long userId, com.vetconnect.dto.care.CareDtos.ProviderRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (user.getRole() != Role.ROLE_CUSTOMER) {
            throw new BadRequestException("Only a pet-owner account can be turned into a pet-care business.");
        }
        CustomerProfile customer = customerProfileRepository.findByUserId(userId).orElse(null);
        if (customer != null) {
            long open = appointmentRepository.countByCustomerIdAndStatusInAndAppointmentDateGreaterThanEqual(customer.getId(), OPEN_APPOINTMENTS, LocalDate.now())
                    + careBookingRepository.countByCustomerIdAndStatusIn(customer.getId(), OPEN_BOOKINGS);
            if (open > 0) throw new BadRequestException("You have " + open + " upcoming booking" + (open == 1 ? "" : "s") + " as a pet owner. Cancel " + (open == 1 ? "it" : "them") + " first.");
        }
        user.setRole(Role.ROLE_PROVIDER);
        userRepository.saveAndFlush(user);
        var created = providerService.createProfile(userId, request); // validates the business details (licence, vet, payment...)
        log.info("Pet owner turned into a pet-care business: userId={} providerId={}", userId, created.getId());
        return created;
    }

    @Transactional
    public void deleteAccount(Long userId, String password) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("That password is not correct.");
        }
        if (user.getRole() == Role.ROLE_ADMIN) {
            throw new BadRequestException("An admin account cannot be deleted from the app.");
        }
        LocalDate today = LocalDate.now();
        CustomerProfile customer = customerProfileRepository.findByUserId(userId).orElse(null);
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId).orElse(null);
        ProviderProfile provider = providerProfileRepository.findByUserId(userId).orElse(null);

        // nobody is left waiting on a person who is gone
        if (customer != null) {
            long open = appointmentRepository.countByCustomerIdAndStatusInAndAppointmentDateGreaterThanEqual(customer.getId(), OPEN_APPOINTMENTS, today)
                    + careBookingRepository.countByCustomerIdAndStatusIn(customer.getId(), OPEN_BOOKINGS);
            if (open > 0) throw new BadRequestException("You have " + open + " upcoming booking" + (open == 1 ? "" : "s") + ". Cancel " + (open == 1 ? "it" : "them") + " first, then delete your account.");
        }
        if (doctor != null) {
            long open = appointmentRepository.countByDoctorIdAndStatusInAndAppointmentDateGreaterThanEqual(doctor.getId(), OPEN_APPOINTMENTS, today);
            if (open > 0) throw new BadRequestException("Customers have " + open + " upcoming appointment" + (open == 1 ? "" : "s") + " with you. Complete, reject or cancel " + (open == 1 ? "it" : "them") + " first.");
        }
        if (provider != null) {
            long open = careBookingRepository.countByProviderIdAndStatusIn(provider.getId(), OPEN_BOOKINGS);
            if (open > 0) throw new BadRequestException("Customers have " + open + " open pet-care booking" + (open == 1 ? "" : "s") + " with you. Finish or cancel " + (open == 1 ? "it" : "them") + " first.");
        }
        if (doctor != null || provider != null) {
            BigDecimal earned = walletTransactionRepository.total(userId, WalletTxnType.CREDIT);
            BigDecimal refunded = walletTransactionRepository.total(userId, WalletTxnType.DEBIT);
            if (earned.subtract(refunded).signum() > 0) {
                throw new BadRequestException("Your wallet still holds money that has not been paid out to you. Contact support to be paid, then delete your account.");
            }
        }

        if (customer != null) scrub(customer);
        if (doctor != null) scrub(doctor);
        if (provider != null) scrub(provider);

        notificationRepository.deleteAllForUser(userId);
        refreshTokenRepository.deleteByUser(user);

        // the sign-in is gone: the number and email are free again, and nothing can log in as this account
        user.setEmail("deleted-" + user.getId() + "@deleted.invalid");
        user.setPhone("deleted-" + user.getId());
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setEmailVerified(false);
        user.setIsActive(false);
        userRepository.save(user);
        log.info("Account deleted: userId={} role={}", userId, user.getRole());
    }

    private void scrub(CustomerProfile c) {
        c.setFullName("Deleted user");
        c.setAddress(null); c.setCity(null); c.setPostalCode(null); c.setState(null); c.setCountry(null);
        c.setLatitude(null); c.setLongitude(null); c.setEmergencyContact(null); c.setAvatarUrl(null);
        customerProfileRepository.save(c);
        for (Pet pet : petRepository.findByCustomerId(c.getId())) {
            boolean hasHistory = appointmentRepository.existsByPetId(pet.getId()) || careBookingRepository.existsByPetId(pet.getId())
                    || !medicalRecordRepository.findByPetIdOrderByVisitDateDesc(pet.getId()).isEmpty();
            if (!hasHistory) {
                petRepository.delete(pet);
            } else { // a record that other people keep: no longer tells who the pet or its owner was
                pet.setName("Pet"); pet.setBreed(null); pet.setDateOfBirth(null); pet.setAllergies(null);
                pet.setExistingConditions(null); pet.setMicrochipNumber(null); pet.setAvatarUrl(null);
                petRepository.save(pet);
            }
        }
    }

    private void scrub(DoctorProfile d) {
        d.setFullName("Deleted doctor");
        d.setLicenseNumber("DELETED-" + d.getId());
        d.setDegree(null); d.setCouncilName(null);
        d.setClinicName("Deleted clinic"); d.setClinicAddress("-"); d.setClinicCity("-");
        d.setClinicPostalCode(null); d.setClinicState(null); d.setClinicCountry(null);
        d.setLatitude(null); d.setLongitude(null); d.setBio(null); d.setAvatarUrl(null);
        d.setPayoutMethod(null); d.setUpiId(null); d.setAccountHolderName(null);
        d.setBankAccountNumber(null); d.setIfscCode(null); d.setBankName(null);
        d.setVerificationStatus(VerificationStatus.REJECTED); // never listed again
        d.setVerificationReason("Account deleted");
        doctorProfileRepository.save(d);
        availabilityRepository.findByDoctorId(d.getId()).forEach(a -> { a.setIsActive(false); availabilityRepository.save(a); });
        documentService.deleteAllFor("DOCTOR", d.getId());
    }

    private void scrub(ProviderProfile p) {
        p.setBusinessName("Deleted business"); p.setDescription(null); p.setPhone(null);
        p.setRegistrationNumber(null); p.setVetPartnerName(null); p.setVetPartnerPhone(null);
        p.setAddress("-"); p.setCity("-"); p.setState(null); p.setCountry(null); p.setPostalCode(null);
        p.setLatitude(null); p.setLongitude(null);
        p.setPayoutMethod(null); p.setUpiId(null); p.setAccountHolderName(null);
        p.setBankAccountNumber(null); p.setIfscCode(null); p.setBankName(null);
        p.setVerificationStatus(VerificationStatus.REJECTED);
        p.setVerificationReason("Account deleted");
        providerProfileRepository.save(p);
        careServiceRepository.findByProviderIdOrderByCategoryAscIsAddonAscNameAsc(p.getId()).forEach(s -> { s.setIsActive(false); careServiceRepository.save(s); });
        documentService.deleteAllFor("PROVIDER", p.getId());
    }
}
