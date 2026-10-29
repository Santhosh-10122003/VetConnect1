package com.vetconnect.repository;

import com.vetconnect.domain.entities.DoctorBlockedSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorBlockedSlotRepository extends JpaRepository<DoctorBlockedSlot, Long> {

    List<DoctorBlockedSlot> findByDoctorIdAndDate(Long doctorId, LocalDate date);

    boolean existsByDoctorIdAndDateAndStartTime(Long doctorId, LocalDate date, LocalTime startTime);

    Optional<DoctorBlockedSlot> findByIdAndDoctorId(Long id, Long doctorId);
}
