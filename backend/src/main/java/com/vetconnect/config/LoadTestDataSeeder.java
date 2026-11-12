package com.vetconnect.config;

import com.vetconnect.common.PhoneNumbers;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Fills the database with realistic volume for load tests. Runs only with the "loadtest" Spring profile and only
 * once (it stops if the first load-test customer already exists).
 *
 * <pre>
 *   customers  +91 9000000001 .. (LOADTEST_CUSTOMERS)   password LoadTest@123, each with 1-2 pets, all in Springfield
 *   doctors    +91 8000000001 .. (LOADTEST_DOCTORS)     password LoadTest@123, approved, Mon-Fri 09:00-17:00, 30 min slots
 *   history    LOADTEST_PAST_APPOINTMENTS completed appointments, so the appointment tables are not empty
 * </pre>
 * One password hash is shared by every account: hashing thousands of passwords one by one would take minutes.
 */
@Slf4j
@Component
@Profile("loadtest")
@Order(10) // after DataInitializer (specialities)
@RequiredArgsConstructor
public class LoadTestDataSeeder implements CommandLineRunner {

    public static final String PASSWORD = "LoadTest@123";
    private static final long CUSTOMER_PHONE_BASE = 9_000_000_000L;
    private static final long DOCTOR_PHONE_BASE = 8_000_000_000L;
    private static final int CHUNK = 500;

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final SpecializationRepository specializationRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PetRepository petRepository;
    private final AppointmentRepository appointmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    @Override
    @Transactional
    public void run(String... args) {
        AppProperties.LoadTest cfg = props.getLoadtest();
        String firstCustomerPhone = phone(CUSTOMER_PHONE_BASE + 1);
        if (userRepository.findByPhone(firstCustomerPhone).isPresent()) {
            log.info("Load-test data already present, skipping.");
            return;
        }
        long started = System.currentTimeMillis();
        String hash = passwordEncoder.encode(PASSWORD);
        Random rnd = new Random(42); // same data on every run
        List<Specialization> specs = specializationRepository.findAll();

        // doctors
        List<DoctorProfile> doctors = new ArrayList<>();
        for (int i = 1; i <= cfg.getDoctors(); i++) {
            String p = phone(DOCTOR_PHONE_BASE + i);
            User u = userRepository.save(User.builder().email(PhoneNumbers.placeholderEmail(p)).password(hash)
                    .phone(p).role(Role.ROLE_DOCTOR).isActive(true).emailVerified(true).build());
            Set<Specialization> mine = new HashSet<>();
            if (!specs.isEmpty()) mine.add(specs.get(rnd.nextInt(specs.size())));
            DoctorProfile d = doctorProfileRepository.save(DoctorProfile.builder().user(u)
                    .fullName("Dr. Load Test " + i).licenseNumber(String.format("LT-VET-%05d", i))
                    .degree("DVM").councilName("Load Test Council")
                    .clinicName("Load Test Clinic " + i).clinicAddress(i + " Test Street, Springfield").clinicCity("Springfield")
                    .latitude(39.78 + rnd.nextDouble() * 0.05).longitude(-89.65 + rnd.nextDouble() * 0.05)
                    .yearsOfExperience(1 + rnd.nextInt(20))
                    .consultationFee(BigDecimal.valueOf(30 + rnd.nextInt(10) * 10L))
                    .bio("Generated for load testing.")
                    .ratingAvg(BigDecimal.valueOf(3.5 + rnd.nextInt(16) / 10.0))
                    .reviewCount(rnd.nextInt(60))
                    .verificationStatus(VerificationStatus.APPROVED)
                    .specializations(mine).build());
            List<DoctorAvailability> week = new ArrayList<>();
            for (int day = 1; day <= 5; day++) {
                week.add(DoctorAvailability.builder().doctor(d).dayOfWeek(day)
                        .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).slotDurationMinutes(30)
                        .breakStartTime(LocalTime.of(13, 0)).breakEndTime(LocalTime.of(14, 0)).isActive(true).build());
            }
            availabilityRepository.saveAll(week);
            doctors.add(d);
        }
        log.info("Load-test: {} doctors created", doctors.size());

        // customers and their pets
        List<CustomerProfile> customers = new ArrayList<>();
        List<Pet> pets = new ArrayList<>();
        for (int base = 1; base <= cfg.getCustomers(); base += CHUNK) {
            int end = Math.min(cfg.getCustomers(), base + CHUNK - 1);
            List<User> users = new ArrayList<>();
            for (int i = base; i <= end; i++) {
                String p = phone(CUSTOMER_PHONE_BASE + i);
                users.add(User.builder().email(PhoneNumbers.placeholderEmail(p)).password(hash)
                        .phone(p).role(Role.ROLE_CUSTOMER).isActive(true).emailVerified(true).build());
            }
            users = userRepository.saveAll(users);
            List<CustomerProfile> profiles = new ArrayList<>();
            for (int k = 0; k < users.size(); k++) {
                profiles.add(CustomerProfile.builder().user(users.get(k)).fullName("Load Customer " + (base + k))
                        .address((base + k) + " Test Avenue").city("Springfield")
                        .latitude(39.78 + rnd.nextDouble() * 0.05).longitude(-89.65 + rnd.nextDouble() * 0.05).build());
            }
            profiles = customerProfileRepository.saveAll(profiles);
            List<Pet> batchPets = new ArrayList<>();
            for (CustomerProfile c : profiles) {
                int n = rnd.nextInt(10) < 3 ? 2 : 1;
                for (int j = 0; j < n; j++) {
                    batchPets.add(Pet.builder().customer(c).name("Pet" + c.getId() + "-" + j)
                            .species(rnd.nextBoolean() ? PetSpecies.DOG : PetSpecies.CAT).breed("Mixed")
                            .gender(rnd.nextBoolean() ? Gender.MALE : Gender.FEMALE)
                            .dateOfBirth(LocalDate.now().minusYears(1 + rnd.nextInt(10)))
                            .weight(BigDecimal.valueOf(3 + rnd.nextInt(30))).build());
                }
            }
            pets.addAll(petRepository.saveAll(batchPets));
            customers.addAll(profiles);
        }
        log.info("Load-test: {} customers and {} pets created", customers.size(), pets.size());

        // appointment history: every (doctor, day, slot) used once, so the unique "one booking per slot" index is never hit
        Map<Long, List<Pet>> petsByCustomer = new HashMap<>();
        for (Pet p : pets) petsByCustomer.computeIfAbsent(p.getCustomer().getId(), k -> new ArrayList<>()).add(p);
        List<Appointment> batch = new ArrayList<>();
        int made = 0;
        int ref = 0;
        outer:
        for (int daysAgo = 1; daysAgo <= 3650; daysAgo++) {
            LocalDate date = LocalDate.now().minusDays(daysAgo);
            for (DoctorProfile d : doctors) {
                for (int slot = 0; slot < 16; slot++) {
                    if (made >= cfg.getPastAppointments()) break outer;
                    LocalTime start = LocalTime.of(9, 0).plusMinutes(30L * slot);
                    if (!start.isBefore(LocalTime.of(13, 0)) && start.isBefore(LocalTime.of(14, 0))) continue; // lunch
                    CustomerProfile c = customers.get(rnd.nextInt(customers.size()));
                    List<Pet> mine = petsByCustomer.get(c.getId());
                    if (mine == null || mine.isEmpty()) continue;
                    batch.add(Appointment.builder().bookingReference("LT-" + (++ref))
                            .customer(c).doctor(d).pet(mine.get(0)).appointmentDate(date)
                            .startTime(start).endTime(start.plusMinutes(30)).reason("Load test history")
                            .status(AppointmentStatus.COMPLETED).totalAmount(d.getConsultationFee())
                            .currency(props.getCare().getCurrency()).build());
                    made++;
                    if (batch.size() >= CHUNK) {
                        appointmentRepository.saveAll(batch);
                        batch.clear();
                    }
                }
            }
        }
        if (!batch.isEmpty()) appointmentRepository.saveAll(batch);
        log.info("Load-test: {} past appointments created. Seeding took {} s.", made, (System.currentTimeMillis() - started) / 1000);
    }

    private static String phone(long national) {
        return "+91" + national;
    }
}
