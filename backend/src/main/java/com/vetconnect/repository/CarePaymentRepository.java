package com.vetconnect.repository;

import com.vetconnect.domain.entities.CarePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CarePaymentRepository extends JpaRepository<CarePayment, Long> {

    List<CarePayment> findByBookingIdOrderByIdDesc(Long bookingId);

    Optional<CarePayment> findFirstByBookingIdOrderByIdDesc(Long bookingId);

    Optional<CarePayment> findFirstByAppointmentIdOrderByIdDesc(Long appointmentId);
}
