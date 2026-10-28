package com.vetconnect.repository;

import com.vetconnect.domain.entities.CareBooking;
import com.vetconnect.domain.enums.CareBookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface CareBookingRepository extends JpaRepository<CareBooking, Long> {

    boolean existsByPetId(Long petId);

    boolean existsByReference(String reference);

    /** Row lock, so two requests (pay twice, accept and cancel) cannot change one booking at the same time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM CareBooking b WHERE b.id = :id")
    java.util.Optional<CareBooking> findByIdForUpdate(@Param("id") Long id);

    Page<CareBooking> findByCustomerIdAndStatusInOrderByBookingDateDescIdDesc(Long customerId, Collection<CareBookingStatus> statuses, Pageable pageable);

    Page<CareBooking> findByProviderIdAndStatusInOrderByBookingDateAscIdAsc(Long providerId, Collection<CareBookingStatus> statuses, Pageable pageable);

    List<CareBooking> findByStatusAndExpiresAtBefore(CareBookingStatus status, Instant before);

    long countByProviderIdAndStatus(Long providerId, CareBookingStatus status);

    /**
     * Timed bookings (grooming / training) on a day that still occupy capacity:
     * paid or confirmed ones, plus unpaid ones whose hold has not run out.
     */
    @Query("SELECT b FROM CareBooking b WHERE b.provider.id = :providerId AND b.bookingDate = :date AND b.startTime IS NOT NULL "
            + "AND (b.status IN :solid OR (b.status = :awaiting AND b.expiresAt > :now))")
    List<CareBooking> findTimedHolding(@Param("providerId") Long providerId,
                                       @Param("date") LocalDate date,
                                       @Param("solid") Collection<CareBookingStatus> solid,
                                       @Param("awaiting") CareBookingStatus awaiting,
                                       @Param("now") Instant now);

    /** Boarding stays that overlap the nights from (inclusive) to to (exclusive) and still occupy capacity. */
    @Query("SELECT b FROM CareBooking b WHERE b.provider.id = :providerId AND b.startTime IS NULL AND b.checkOutDate IS NOT NULL "
            + "AND b.bookingDate < :to AND b.checkOutDate > :from "
            + "AND (b.status IN :solid OR (b.status = :awaiting AND b.expiresAt > :now))")
    List<CareBooking> findBoardingHolding(@Param("providerId") Long providerId,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to,
                                          @Param("solid") Collection<CareBookingStatus> solid,
                                          @Param("awaiting") CareBookingStatus awaiting,
                                          @Param("now") Instant now);
}
