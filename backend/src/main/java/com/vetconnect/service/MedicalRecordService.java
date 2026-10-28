package com.vetconnect.service;

import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.dto.medical.CreateMedicalRecordRequest;
import com.vetconnect.dto.medical.CreatePrescriptionRequest;
import com.vetconnect.dto.medical.MedicalRecordDto;
import com.vetconnect.dto.medical.PrescriptionDto;
import com.vetconnect.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PetRepository petRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<MedicalRecordDto> getMedicalRecordsByPetId(Long petId, Long userId) {
        validatePetAccess(petId, userId);
        return medicalRecordRepository.findByPetIdOrderByVisitDateDesc(petId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public MedicalRecordDto createMedicalRecord(Long petId, Long userId, CreateMedicalRecordRequest request) {
        DoctorProfile doctor = doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> {
                    log.warn("Medical record rejected: userId={} is not a doctor", userId);
                    return new UnauthorizedException("Only veterinary doctors can create medical records");
                });

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found with ID: " + petId));

        Appointment appointment = null;
        if (request.getAppointmentId() != null) {
            appointment = appointmentRepository.findById(request.getAppointmentId())
                    .orElse(null);
        }

        MedicalRecord record = MedicalRecord.builder()
                .pet(pet)
                .appointment(appointment)
                .doctor(doctor)
                .visitDate(request.getVisitDate() != null ? request.getVisitDate() : LocalDate.now())
                .diagnosis(request.getDiagnosis())
                .symptoms(request.getSymptoms())
                .clinicalNotes(request.getClinicalNotes())
                .treatmentPlan(request.getTreatmentPlan())
                .weightAtVisit(request.getWeightAtVisit() != null ? request.getWeightAtVisit() : pet.getWeight())
                .prescriptions(new ArrayList<>())
                .build();

        record = medicalRecordRepository.save(record);

        if (request.getPrescriptions() != null) {
            for (CreatePrescriptionRequest pReq : request.getPrescriptions()) {
                Prescription prescription = Prescription.builder()
                        .medicalRecord(record)
                        .medicationName(pReq.getMedicationName())
                        .dosage(pReq.getDosage())
                        .frequency(pReq.getFrequency())
                        .durationDays(pReq.getDurationDays())
                        .instructions(pReq.getInstructions())
                        .build();
                prescription = prescriptionRepository.save(prescription);
                record.getPrescriptions().add(prescription);
            }
        }

        // Update pet's recorded weight if provided
        if (request.getWeightAtVisit() != null) {
            pet.setWeight(request.getWeightAtVisit());
            petRepository.save(pet);
        }

        log.info("Medical record created: recordId={} petId={} doctorId={} prescriptions={}", record.getId(), petId, doctor.getId(), record.getPrescriptions().size());
        return toDto(record);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionDto> getPrescriptionsByPetId(Long petId, Long userId) {
        validatePetAccess(petId, userId);
        return prescriptionRepository.findByMedicalRecordPetIdOrderByCreatedAtDesc(petId)
                .stream()
                .map(this::toPrescriptionDto)
                .collect(Collectors.toList());
    }

    private void validatePetAccess(Long petId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == Role.ROLE_ADMIN || user.getRole() == Role.ROLE_DOCTOR) {
            return;
        }

        CustomerProfile customer = customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new UnauthorizedException("Customer not found"));

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

        if (!pet.getCustomer().getId().equals(customer.getId())) {
            throw new UnauthorizedException("You do not have access to this pet's medical records");
        }
    }

    public MedicalRecordDto toDto(MedicalRecord m) {
        return MedicalRecordDto.builder()
                .id(m.getId())
                .petId(m.getPet().getId())
                .petName(m.getPet().getName())
                .appointmentId(m.getAppointment() != null ? m.getAppointment().getId() : null)
                .bookingReference(m.getAppointment() != null ? m.getAppointment().getBookingReference() : null)
                .doctorId(m.getDoctor().getId())
                .doctorName(m.getDoctor().getFullName())
                .clinicName(m.getDoctor().getClinicName())
                .visitDate(m.getVisitDate())
                .diagnosis(m.getDiagnosis())
                .symptoms(m.getSymptoms())
                .clinicalNotes(m.getClinicalNotes())
                .treatmentPlan(m.getTreatmentPlan())
                .weightAtVisit(m.getWeightAtVisit())
                .prescriptions(m.getPrescriptions() != null ? m.getPrescriptions().stream()
                        .map(this::toPrescriptionDto).collect(Collectors.toList()) : List.of())
                .createdAt(m.getCreatedAt())
                .build();
    }

    public PrescriptionDto toPrescriptionDto(Prescription p) {
        return PrescriptionDto.builder()
                .id(p.getId())
                .medicalRecordId(p.getMedicalRecord().getId())
                .medicationName(p.getMedicationName())
                .dosage(p.getDosage())
                .frequency(p.getFrequency())
                .durationDays(p.getDurationDays())
                .instructions(p.getInstructions())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
