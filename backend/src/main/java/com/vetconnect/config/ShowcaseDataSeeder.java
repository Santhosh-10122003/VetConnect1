package com.vetconnect.config;

import com.vetconnect.common.PhoneNumbers;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

/**
 * Three ready-made accounts around pincode 641041 (Coimbatore) for showing the app: a pet owner, a veterinarian and a
 * pet-care business. Off by default. Turn on with SEED_SHOWCASE_DATA=true and give each account its password in
 * SHOWCASE_OWNER_PASSWORD / SHOWCASE_VET_PASSWORD / SHOWCASE_CARE_PASSWORD. An account whose password is not set is
 * skipped, so no password is ever written into the code or the repository. Accounts that already exist are left alone.
 *
 * The mobile numbers start with 0, which no real Indian mobile number does, so a reset code can never reach a stranger.
 */
@Slf4j
@Component
@Order(5) // after DataInitializer (specialities)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vetconnect.showcase.enabled", havingValue = "true")
public class ShowcaseDataSeeder implements CommandLineRunner {

    public static final String OWNER_PHONE = "+910000064101";
    public static final String VET_PHONE = "+910000064102";
    public static final String CARE_PHONE = "+910000064103";

    private static final String PINCODE = "641041";
    private static final String CITY = "Coimbatore";
    private static final String STATE = "Tamil Nadu";
    private static final String COUNTRY = "India";
    // approximate centre of the Coimbatore area; an exact pin is not needed for the city match
    private static final double LAT = 11.0600;
    private static final double LNG = 76.9900;

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PetRepository petRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final SpecializationRepository specializationRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final ProviderProfileRepository providerRepository;
    private final CareServiceRepository careServiceRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    @Override
    @Transactional
    public void run(String... args) {
        AppProperties.Showcase cfg = props.getShowcase();
        owner(cfg.getOwnerPassword());
        vet(cfg.getVetPassword());
        care(cfg.getCarePassword());
    }

    private boolean skip(String phone, String password, String what) {
        if (password == null || password.isBlank()) {
            log.warn("Showcase {} skipped: its password variable is not set.", what);
            return true;
        }
        if (userRepository.existsByPhone(phone)) {
            log.info("Showcase {} already exists ({}), left unchanged.", what, phone);
            return true;
        }
        return false;
    }

    private User user(String phone, String password, Role role) {
        return userRepository.save(User.builder().email(PhoneNumbers.placeholderEmail(phone))
                .password(passwordEncoder.encode(password)).phone(phone).role(role)
                .isActive(true).emailVerified(true).build());
    }

    private void owner(String password) {
        if (skip(OWNER_PHONE, password, "pet owner")) return;
        User u = user(OWNER_PHONE, password, Role.ROLE_CUSTOMER);
        CustomerProfile c = customerProfileRepository.save(CustomerProfile.builder().user(u).fullName("Demo Pet Owner")
                .address("Near Saravanampatti, Coimbatore").city(CITY).state(STATE).country(COUNTRY).postalCode(PINCODE)
                .latitude(LAT + 0.004).longitude(LNG + 0.004).build());
        petRepository.save(Pet.builder().customer(c).name("Buddy").species(PetSpecies.DOG).breed("Labrador")
                .gender(Gender.MALE).weight(new BigDecimal("28.00")).build());
        log.info("Showcase pet owner created: {}", OWNER_PHONE);
    }

    private void vet(String password) {
        if (skip(VET_PHONE, password, "veterinarian")) return;
        User u = user(VET_PHONE, password, Role.ROLE_DOCTOR);
        Set<Specialization> specs = new HashSet<>();
        specializationRepository.findByName("General Veterinary Care").ifPresent(specs::add);
        DoctorProfile d = doctorProfileRepository.save(DoctorProfile.builder().user(u)
                .fullName("Dr. Demo Veterinarian").licenseNumber("TN-DEMO-641041").degree("BVSc & AH")
                .councilName("Tamil Nadu Veterinary Council")
                .clinicName("Demo Pet Clinic, Coimbatore").clinicAddress("Near Saravanampatti, Coimbatore")
                .clinicCity(CITY).clinicState(STATE).clinicCountry(COUNTRY).clinicPostalCode(PINCODE)
                .latitude(LAT).longitude(LNG).yearsOfExperience(6).consultationFee(new BigDecimal("500.00"))
                .bio("Sample veterinarian for showing the app.")
                .verificationStatus(VerificationStatus.APPROVED)
                .payoutMethod(PayoutMethod.UPI).upiId("demovet@upi")
                .specializations(specs).build());
        for (int day = 1; day <= 6; day++) {
            availabilityRepository.save(DoctorAvailability.builder().doctor(d).dayOfWeek(day)
                    .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).slotDurationMinutes(30)
                    .breakStartTime(LocalTime.of(13, 0)).breakEndTime(LocalTime.of(14, 0)).isActive(true).build());
        }
        log.info("Showcase veterinarian created: {}", VET_PHONE);
    }

    private void care(String password) {
        if (skip(CARE_PHONE, password, "pet-care business")) return;
        User u = user(CARE_PHONE, password, Role.ROLE_PROVIDER);
        ProviderProfile p = ProviderProfile.builder().user(u).businessName("Demo Pet Care, Coimbatore")
                .description("Sample grooming, boarding and training business for showing the app.")
                .phone(CARE_PHONE).address("Near Saravanampatti, Coimbatore").city(CITY).state(STATE).country(COUNTRY)
                .postalCode(PINCODE).latitude(LAT + 0.002).longitude(LNG - 0.003)
                .concurrentCapacity(2).boardingCapacity(6).slotMinutes(30).advancePercent(30)
                .verificationStatus(VerificationStatus.APPROVED)
                .payoutMethod(PayoutMethod.UPI).upiId("demopetcare@upi").build();
        p.getCategories().addAll(EnumSet.of(CareCategory.GROOMING, CareCategory.BOARDING, CareCategory.TRAINING));
        for (int day = 1; day <= 7; day++) {
            p.getHours().add(ProviderHours.builder().provider(p).dayOfWeek(day)
                    .openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(day <= 6).build());
        }
        p = providerRepository.save(p);
        service(p, CareCategory.GROOMING, "Bath & Brush", "Shampoo, blow-dry and brush out.", 60, false, "400", "500", "700", "900");
        service(p, CareCategory.GROOMING, "Full Groom", "Bath, haircut or trim, nails and ears.", 90, false, "700", "900", "1200", "1500");
        service(p, CareCategory.BOARDING, "Standard Boarding", "A cosy kennel, two walks a day and meals included.", null, false, "500", "600", "800", "1000");
        service(p, CareCategory.TRAINING, "Basic Obedience", "Sit, stay, come and loose-lead walking.", 60, false, "600", "600", "700", "800");
        log.info("Showcase pet-care business created: {}", CARE_PHONE);
    }

    private void service(ProviderProfile p, CareCategory category, String name, String description, Integer minutes, boolean addon,
                         String small, String medium, String large, String giant) {
        careServiceRepository.save(CareService.builder().provider(p).category(category).name(name).description(description)
                .pricingUnit(category == CareCategory.BOARDING && !addon ? PricingUnit.PER_NIGHT : PricingUnit.PER_SESSION)
                .durationMinutes(minutes)
                .priceSmall(new BigDecimal(small)).priceMedium(new BigDecimal(medium)).priceLarge(new BigDecimal(large)).priceGiant(new BigDecimal(giant))
                .isAddon(addon).isActive(true).build());
    }
}
