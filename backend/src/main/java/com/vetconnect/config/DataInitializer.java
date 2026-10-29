package com.vetconnect.config;

import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final SpecializationRepository specializationRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PetRepository petRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final ReviewRepository reviewRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProviderProfileRepository providerRepository;
    private final CareServiceRepository careServiceRepository;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Checking and seeding VetConnect base data...");

        // 1. Specializations
        Map<String, Specialization> specs = new HashMap<>();
        seedSpecialization(specs, "General Veterinary Care", "Routine check-ups, wellness exams, vaccinations, and preventive healthcare.", "paw");
        seedSpecialization(specs, "Small Animal Dermatology", "Diagnosis and treatment of skin, coat, and ear conditions in pets.", "shield-alert");
        seedSpecialization(specs, "Veterinary Dentistry", "Dental exams, cleanings, tooth extractions, and oral health care.", "tooth");
        seedSpecialization(specs, "Soft Tissue & Orthopedic Surgery", "Surgical procedures including spay/neuter, mass removal, and orthopedic care.", "scissors");
        seedSpecialization(specs, "Exotic & Avian Care", "Specialized medicine and healthcare for birds, reptiles, rabbits, and small mammals.", "feather");
        seedSpecialization(specs, "Cardiology & Internal Medicine", "Heart disease management, diagnostic ultrasound, and chronic illness care.", "heart-pulse");
        seedSpecialization(specs, "Ophthalmology", "Comprehensive eye examinations, corneal treatments, and vision care.", "eye");

        // 2. Admin User
        if (!userRepository.existsByEmail("admin@vetconnect.com")) {
            User admin = User.builder()
                    .email("admin@vetconnect.com")
                    .password(passwordEncoder.encode("Admin@1234"))
                    .phone("+1 555-0100")
                    .role(Role.ROLE_ADMIN)
                    .isActive(true)
                    .build();
            userRepository.save(admin);
            log.info("Seeded Admin: admin@vetconnect.com");
        }

        // 3. Doctor 1: Dr. Sarah Jenkins
        DoctorProfile doc1 = null;
        if (!userRepository.existsByEmail("dr.sarah@vetconnect.com")) {
            User docUser1 = User.builder()
                    .email("dr.sarah@vetconnect.com")
                    .password(passwordEncoder.encode("Doctor@1234"))
                    .phone("+1 555-0111")
                    .role(Role.ROLE_DOCTOR)
                    .isActive(true)
                    .build();
            docUser1 = userRepository.save(docUser1);

            doc1 = DoctorProfile.builder()
                    .user(docUser1)
                    .fullName("Dr. Sarah Jenkins, DVM")
                    .licenseNumber("VET-US-98214")
                    .clinicName("Paws & Claws Veterinary Hospital")
                    .clinicAddress("742 Evergreen Terrace, Springfield")
                    .clinicCity("Springfield").latitude(39.7817).longitude(-89.6501)
                    .yearsOfExperience(8)
                    .consultationFee(new BigDecimal("65.00"))
                    .bio("Compassionate veterinarian specializing in dermatology, canine wellness, and preventive medicine. Dedicated to stress-free handling.")
                    .ratingAvg(new BigDecimal("4.90"))
                    .reviewCount(24)
                    .verificationStatus(VerificationStatus.APPROVED)
                    .avatarUrl("https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300")
                    .specializations(new HashSet<>(Arrays.asList(specs.get("General Veterinary Care"), specs.get("Small Animal Dermatology"))))
                    .build();
            doc1 = doctorProfileRepository.save(doc1);
            seedAvailability(doc1);
            log.info("Seeded Doctor: dr.sarah@vetconnect.com");
        } else {
            doc1 = doctorProfileRepository.findByUserEmail("dr.sarah@vetconnect.com").orElse(null);
        }

        // 4. Doctor 2: Dr. Raj Patel
        DoctorProfile doc2 = null;
        if (!userRepository.existsByEmail("dr.raj@vetconnect.com")) {
            User docUser2 = User.builder()
                    .email("dr.raj@vetconnect.com")
                    .password(passwordEncoder.encode("Doctor@1234"))
                    .phone("+1 555-0122")
                    .role(Role.ROLE_DOCTOR)
                    .isActive(true)
                    .build();
            docUser2 = userRepository.save(docUser2);

            doc2 = DoctorProfile.builder()
                    .user(docUser2)
                    .fullName("Dr. Raj Patel, BVSc & AH")
                    .licenseNumber("VET-US-84512")
                    .clinicName("Metro Animal Surgical Center")
                    .clinicAddress("1204 Pine Grove Ave, West Bay")
                    .clinicCity("West Bay").latitude(39.9000).longitude(-89.4500)
                    .yearsOfExperience(12)
                    .consultationFee(new BigDecimal("90.00"))
                    .bio("Board-certified orthopedic surgeon with extensive experience in soft tissue reconstruction, joint health, and complex trauma care.")
                    .ratingAvg(new BigDecimal("4.85"))
                    .reviewCount(38)
                    .verificationStatus(VerificationStatus.APPROVED)
                    .avatarUrl("https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300")
                    .specializations(new HashSet<>(Arrays.asList(specs.get("Soft Tissue & Orthopedic Surgery"), specs.get("Veterinary Dentistry"))))
                    .build();
            doc2 = doctorProfileRepository.save(doc2);
            seedAvailability(doc2);
            log.info("Seeded Doctor: dr.raj@vetconnect.com");
        } else {
            doc2 = doctorProfileRepository.findByUserEmail("dr.raj@vetconnect.com").orElse(null);
        }

        // 5. Doctor 3: Dr. Emily Wong
        if (!userRepository.existsByEmail("dr.emily@vetconnect.com")) {
            User docUser3 = User.builder()
                    .email("dr.emily@vetconnect.com")
                    .password(passwordEncoder.encode("Doctor@1234"))
                    .phone("+1 555-0133")
                    .role(Role.ROLE_DOCTOR)
                    .isActive(true)
                    .build();
            docUser3 = userRepository.save(docUser3);

            DoctorProfile doc3 = DoctorProfile.builder()
                    .user(docUser3)
                    .fullName("Dr. Emily Wong, DVM")
                    .licenseNumber("VET-US-77401")
                    .clinicName("Avian & Exotic Pet Care Center")
                    .clinicAddress("330 Sunset Blvd, Northview")
                    .clinicCity("Northview").latitude(40.3000).longitude(-89.2000)
                    .yearsOfExperience(6)
                    .consultationFee(new BigDecimal("75.00"))
                    .bio("Specialist in avian, reptile, and small mammal medicine. Passionate about dietary wellness and habitat enrichment.")
                    .ratingAvg(new BigDecimal("4.95"))
                    .reviewCount(19)
                    .verificationStatus(VerificationStatus.APPROVED)
                    .avatarUrl("https://images.unsplash.com/photo-1594824813576-905e94bcf9db?auto=format&fit=crop&q=80&w=300")
                    .specializations(new HashSet<>(Arrays.asList(specs.get("Exotic & Avian Care"), specs.get("General Veterinary Care"))))
                    .build();
            doc3 = doctorProfileRepository.save(doc3);
            seedAvailability(doc3);
            log.info("Seeded Doctor: dr.emily@vetconnect.com");
        }

        // 6. Customer 1: John Doe
        CustomerProfile customer1 = null;
        if (!userRepository.existsByEmail("john.doe@example.com")) {
            User custUser1 = User.builder()
                    .email("john.doe@example.com")
                    .password(passwordEncoder.encode("Customer@1234"))
                    .phone("+1 555-0201")
                    .role(Role.ROLE_CUSTOMER)
                    .isActive(true)
                    .build();
            custUser1 = userRepository.save(custUser1);

            customer1 = CustomerProfile.builder()
                    .user(custUser1)
                    .fullName("John Doe")
                    .address("456 Elm Street")
                    .city("Springfield").latitude(39.7990).longitude(-89.6440)
                    .emergencyContact("+1 555-0209")
                    .avatarUrl("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200")
                    .build();
            customer1 = customerProfileRepository.save(customer1);
            log.info("Seeded Customer: john.doe@example.com");

            // Seed Pets for John Doe
            Pet pet1 = Pet.builder()
                    .customer(customer1)
                    .name("Buddy")
                    .species(PetSpecies.DOG)
                    .breed("Golden Retriever")
                    .dateOfBirth(LocalDate.now().minusYears(3))
                    .gender(Gender.MALE)
                    .weight(new BigDecimal("31.50"))
                    .allergies("Chicken, Pollen")
                    .existingConditions("Mild seasonal skin itch")
                    .microchipNumber("985141002345891")
                    .avatarUrl("https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=300")
                    .build();
            pet1 = petRepository.save(pet1);

            Pet pet2 = Pet.builder()
                    .customer(customer1)
                    .name("Milo")
                    .species(PetSpecies.CAT)
                    .breed("British Shorthair")
                    .dateOfBirth(LocalDate.now().minusYears(2))
                    .gender(Gender.MALE)
                    .weight(new BigDecimal("4.80"))
                    .allergies("None")
                    .existingConditions("None")
                    .microchipNumber("985141002345892")
                    .avatarUrl("https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=300")
                    .build();
            pet2 = petRepository.save(pet2);

            // Seed sample Appointments
            if (doc1 != null) {
                // Completed past appointment
                Appointment pastAppt = Appointment.builder()
                        .bookingReference("VC-20261015-8812")
                        .customer(customer1)
                        .doctor(doc1)
                        .pet(pet1)
                        .appointmentDate(LocalDate.now().minusDays(10))
                        .startTime(LocalTime.of(10, 0))
                        .endTime(LocalTime.of(10, 30))
                        .reason("Annual wellness checkup and skin evaluation")
                        .status(AppointmentStatus.COMPLETED)
                        .notes("Patient was calm and cooperative. Ear canal clear.")
                        .build();
                pastAppt = appointmentRepository.save(pastAppt);

                // Medical record for past appointment
                MedicalRecord medRecord = MedicalRecord.builder()
                        .pet(pet1)
                        .appointment(pastAppt)
                        .doctor(doc1)
                        .visitDate(LocalDate.now().minusDays(10))
                        .diagnosis("Mild Atopic Dermatitis")
                        .symptoms("Scratching around neck and lower abdomen; slight erythema.")
                        .clinicalNotes("Temperature 38.4C, heart/lungs clear. No fleas detected.")
                        .treatmentPlan("Hypoallergenic shampoo once weekly, oral antihistamine as needed.")
                        .weightAtVisit(new BigDecimal("31.20"))
                        .build();
                medRecord = medicalRecordRepository.save(medRecord);

                Prescription rx = Prescription.builder()
                        .medicalRecord(medRecord)
                        .medicationName("Apoquel (Oclacitinib)")
                        .dosage("16 mg")
                        .frequency("Once daily with food")
                        .durationDays(14)
                        .instructions("Administer in morning with meal. Discontinue if gastrointestinal upset occurs.")
                        .build();
                prescriptionRepository.save(rx);

                // Sample Review
                Review review = Review.builder()
                        .doctor(doc1)
                        .customer(customer1)
                        .appointment(pastAppt)
                        .rating(5)
                        .comment("Dr. Sarah was wonderful with Buddy! He usually gets very nervous at the vet, but she handled him with such gentle patience.")
                        .build();
                reviewRepository.save(review);

                // Upcoming appointment
                Appointment upcomingAppt = Appointment.builder()
                        .bookingReference("VC-20261028-4421")
                        .customer(customer1)
                        .doctor(doc1)
                        .pet(pet1)
                        .appointmentDate(LocalDate.now().plusDays(3))
                        .startTime(LocalTime.of(14, 0))
                        .endTime(LocalTime.of(14, 30))
                        .reason("Follow-up dermatology check and booster vaccination")
                        .status(AppointmentStatus.CONFIRMED)
                        .notes("Skin re-evaluation.")
                        .build();
                appointmentRepository.save(upcomingAppt);

                // Welcome notification
                Notification notif = Notification.builder()
                        .user(custUser1)
                        .title("Welcome to VetConnect!")
                        .message("Your account is ready. You can now book appointments, track vaccinations, and manage healthcare for your pets.")
                        .notificationType(NotificationType.GENERAL)
                        .isRead(false)
                        .build();
                notificationRepository.save(notif);
            }
        }

        seedPetCare();

        log.info("VetConnect database initialization complete.");
    }

    // ------------------------------------------------------------------ demo pet-care businesses

    private void seedPetCare() {
        // 1) a grooming salon
        ProviderProfile groomer = seedProvider("groomer@vetconnect.com", "Groomer@1234", "+1 555-0301", "Happy Paws Grooming",
                "Gentle grooming for dogs and cats: baths, haircuts and nail care by certified groomers.",
                "88 Maple Street, Springfield", "Springfield", 39.7850, -89.6480, EnumSet.of(CareCategory.GROOMING), 2, 0, 30);
        if (groomer != null) {
            seedService(groomer, CareCategory.GROOMING, "Bath & Brush", "Shampoo, blow-dry, brush out and ear check.", 60, false, "25", "35", "45", "60");
            seedService(groomer, CareCategory.GROOMING, "Full Groom", "Bath, haircut or trim, nails and ears.", 90, false, "40", "55", "70", "90");
            seedService(groomer, CareCategory.GROOMING, "Nail Trim", "Quick clip and file.", 15, true, "8", "8", "10", "12");
            seedService(groomer, CareCategory.GROOMING, "Teeth Brushing", "Fresh breath add-on.", 10, true, "6", "6", "8", "10");
        }

        // 2) boarding and training
        ProviderProfile stay = seedProvider("stay@vetconnect.com", "Stay@1234", "+1 555-0302", "Cozy Tails Boarding & Training",
                "Comfortable overnight stays with daily walks, plus obedience classes for puppies and adult dogs.",
                "12 Lakeview Road, West Bay", "West Bay", 39.9020, -89.4480, EnumSet.of(CareCategory.BOARDING, CareCategory.TRAINING), 2, 6, 30);
        if (stay != null) {
            seedService(stay, CareCategory.BOARDING, "Standard Boarding", "A cosy kennel, two walks a day and meals included.", null, false, "18", "24", "30", "40");
            seedService(stay, CareCategory.BOARDING, "Deluxe Suite", "A private suite with a bed, extra playtime and a daily photo update.", null, false, "30", "40", "50", "65");
            seedService(stay, CareCategory.BOARDING, "Extra Walk", "One more walk per day of the stay.", null, true, "10", "10", "12", "15");
            seedService(stay, CareCategory.TRAINING, "Basic Obedience", "Sit, stay, come and loose-lead walking.", 60, false, "30", "30", "35", "40");
            seedService(stay, CareCategory.TRAINING, "Puppy Socialisation", "A small, supervised play and learning class.", 45, false, "25", "25", "30", "35");
        }

        // 3) a vet clinic that also offers grooming (the same account as Dr. Sarah)
        userRepository.findByEmail("dr.sarah@vetconnect.com").ifPresent(sarah -> {
            if (!providerRepository.existsByUserId(sarah.getId())) {
                ProviderProfile spa = seedProviderFor(sarah, "Paws & Claws Pet Spa",
                        "Medicated and wellness baths from the team at Paws & Claws Veterinary Hospital.",
                        "742 Evergreen Terrace, Springfield", "Springfield", 39.7817, -89.6501, EnumSet.of(CareCategory.GROOMING), 1, 0, 30);
                seedService(spa, CareCategory.GROOMING, "Wellness Bath", "Gentle bath with a skin and coat check by a vet nurse.", 45, false, "30", "40", "50", "65");
                seedService(spa, CareCategory.GROOMING, "Medicated Bath", "For skin conditions, as advised by your vet.", 60, false, "40", "50", "60", "75");
                log.info("Seeded pet-care profile for Dr. Sarah's clinic");
            }
        });
    }

    private ProviderProfile seedProvider(String email, String password, String phone, String business, String description, String address,
                                         String city, double lat, double lng, Set<CareCategory> categories, int concurrent, int boarding, int slotMinutes) {
        if (userRepository.existsByEmail(email)) return null;
        User user = userRepository.save(User.builder().email(email).password(passwordEncoder.encode(password)).phone(phone)
                .role(Role.ROLE_PROVIDER).isActive(true).build());
        ProviderProfile p = seedProviderFor(user, business, description, address, city, lat, lng, categories, concurrent, boarding, slotMinutes);
        log.info("Seeded pet-care provider: {}", email);
        return p;
    }

    private ProviderProfile seedProviderFor(User user, String business, String description, String address, String city, double lat, double lng,
                                            Set<CareCategory> categories, int concurrent, int boarding, int slotMinutes) {
        ProviderProfile p = ProviderProfile.builder()
                .user(user).businessName(business).description(description).phone(user.getPhone())
                .address(address).city(city).latitude(lat).longitude(lng)
                .concurrentCapacity(concurrent).boardingCapacity(boarding).slotMinutes(slotMinutes).advancePercent(30)
                .verificationStatus(VerificationStatus.APPROVED)
                .payoutMethod(com.vetconnect.domain.enums.PayoutMethod.UPI)
                .upiId(business.toLowerCase().replaceAll("[^a-z]", "") + "@upi")
                .build();
        p.getCategories().addAll(categories);
        for (int day = 1; day <= 7; day++) {
            p.getHours().add(ProviderHours.builder().provider(p).dayOfWeek(day)
                    .openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(day <= 6).build());
        }
        return providerRepository.save(p);
    }

    private void seedService(ProviderProfile p, CareCategory category, String name, String description, Integer minutes, boolean addon,
                             String small, String medium, String large, String giant) {
        boolean night = category == CareCategory.BOARDING && !addon;
        careServiceRepository.save(CareService.builder()
                .provider(p).category(category).name(name).description(description)
                .pricingUnit(night ? PricingUnit.PER_NIGHT : PricingUnit.PER_SESSION)
                .durationMinutes(minutes)
                .priceSmall(new BigDecimal(small)).priceMedium(new BigDecimal(medium)).priceLarge(new BigDecimal(large)).priceGiant(new BigDecimal(giant))
                .isAddon(addon).isActive(true).build());
    }

    private void seedSpecialization(Map<String, Specialization> map, String name, String desc, String icon) {
        Specialization s = specializationRepository.findByName(name)
                .orElseGet(() -> specializationRepository.save(
                        Specialization.builder().name(name).description(desc).iconName(icon).build()
                ));
        map.put(name, s);
    }

    private void seedAvailability(DoctorProfile doc) {
        if (availabilityRepository.findByDoctorId(doc.getId()).isEmpty()) {
            for (int day = 1; day <= 5; day++) {
                DoctorAvailability avail = DoctorAvailability.builder()
                        .doctor(doc)
                        .dayOfWeek(day)
                        .startTime(LocalTime.of(9, 0))
                        .endTime(LocalTime.of(17, 0))
                        .slotDurationMinutes(30)
                        .breakStartTime(LocalTime.of(13, 0))
                        .breakEndTime(LocalTime.of(14, 0))
                        .isActive(true)
                        .build();
                availabilityRepository.save(avail);
            }
        }
    }
}
