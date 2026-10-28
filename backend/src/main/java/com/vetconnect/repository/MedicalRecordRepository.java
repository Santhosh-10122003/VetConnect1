package com.vetconnect.repository;

import com.vetconnect.domain.entities.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, Long> {
    List<MedicalRecord> findByPetIdOrderByVisitDateDesc(Long petId);
    List<MedicalRecord> findByDoctorIdOrderByVisitDateDesc(Long doctorId);
}
