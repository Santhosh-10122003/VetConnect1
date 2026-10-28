package com.vetconnect.repository;

import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.enums.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorProfileRepository extends JpaRepository<DoctorProfile, Long> {

    boolean existsByLicenseNumberIgnoreCase(String licenseNumber);
    Optional<DoctorProfile> findByUser(User user);
    Optional<DoctorProfile> findByUserId(Long userId);
    Optional<DoctorProfile> findByUserEmail(String email);
    List<DoctorProfile> findByVerificationStatus(VerificationStatus status);

    @Query("SELECT DISTINCT d FROM DoctorProfile d " +
            "LEFT JOIN d.specializations s " +
            "WHERE d.verificationStatus = :status " +
            "AND (CAST(:query AS string) IS NULL OR LOWER(d.fullName) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) " +
            "     OR LOWER(d.clinicName) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) " +
            "     OR LOWER(d.clinicAddress) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))) " +
            "AND (:specializationId IS NULL OR s.id = :specializationId) " +
            "AND (:maxFee IS NULL OR d.consultationFee <= :maxFee) " +
            "AND (:minRating IS NULL OR d.ratingAvg >= :minRating)")
    Page<DoctorProfile> searchDoctors(
            @Param("status") VerificationStatus status,
            @Param("query") String query,
            @Param("specializationId") Long specializationId,
            @Param("maxFee") BigDecimal maxFee,
            @Param("minRating") BigDecimal minRating,
            Pageable pageable
    );
}
