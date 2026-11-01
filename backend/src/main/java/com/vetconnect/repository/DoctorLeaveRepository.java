package com.vetconnect.repository;

import com.vetconnect.domain.entities.DoctorLeave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorLeaveRepository extends JpaRepository<DoctorLeave, Long> {

    /** Leave that is still running or has not started yet, soonest first. */
    List<DoctorLeave> findByDoctorIdAndToDateGreaterThanEqualOrderByFromDateAsc(Long doctorId, LocalDate today);

    /** Is the doctor away on that day? */
    boolean existsByDoctorIdAndFromDateLessThanEqualAndToDateGreaterThanEqual(Long doctorId, LocalDate day, LocalDate sameDay);

    Optional<DoctorLeave> findByIdAndDoctorId(Long id, Long doctorId);
}
