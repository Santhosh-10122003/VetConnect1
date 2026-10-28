package com.vetconnect.repository;

import com.vetconnect.domain.entities.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {
    Page<Review> findByDoctorIdOrderByCreatedAtDesc(Long doctorId, Pageable pageable);
    boolean existsByAppointmentId(Long appointmentId);
    Optional<Review> findByAppointmentId(Long appointmentId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.doctor.id = :doctorId")
    Double calculateAverageRatingForDoctor(@Param("doctorId") Long doctorId);

    long countByDoctorId(Long doctorId);
}
