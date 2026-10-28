package com.vetconnect.repository;

import com.vetconnect.domain.entities.CareReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CareReviewRepository extends JpaRepository<CareReview, Long> {

    boolean existsByBookingId(Long bookingId);

    Page<CareReview> findByProviderIdOrderByCreatedAtDesc(Long providerId, Pageable pageable);

    long countByProviderId(Long providerId);

    @Query("SELECT AVG(r.rating) FROM CareReview r WHERE r.provider.id = :providerId")
    Double averageRating(@Param("providerId") Long providerId);
}
