package com.vetconnect.repository;

import com.vetconnect.domain.entities.Appointment;
import com.vetconnect.domain.enums.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    boolean existsByPetId(Long petId);

    Optional<Appointment> findByBookingReference(String bookingReference);

    Page<Appointment> findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(Long customerId, Pageable pageable);

    Page<Appointment> findByCustomerIdAndStatusInOrderByAppointmentDateDescStartTimeDesc(
            Long customerId, Collection<AppointmentStatus> statuses, Pageable pageable);

    Page<Appointment> findByDoctorIdOrderByAppointmentDateDescStartTimeDesc(Long doctorId, Pageable pageable);

    Page<Appointment> findByDoctorIdAndStatusInOrderByAppointmentDateDescStartTimeDesc(
            Long doctorId, Collection<AppointmentStatus> statuses, Pageable pageable);

    List<Appointment> findByDoctorIdAndAppointmentDateAndStatusNotIn(
            Long doctorId, LocalDate date, Collection<AppointmentStatus> excludedStatuses);

    boolean existsByDoctorIdAndAppointmentDateAndStartTimeAndStatusNotIn(
            Long doctorId, LocalDate date, LocalTime startTime, Collection<AppointmentStatus> excludedStatuses);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Appointment a WHERE a.id = :id")
    Optional<Appointment> findByIdForUpdate(@Param("id") Long id);

    List<Appointment> findByStatusAndExpiresAtBefore(AppointmentStatus status, java.time.Instant before);

    long countByStatus(AppointmentStatus status);

    long countByDoctorId(Long doctorId);

    long countByDoctorIdAndAppointmentDate(Long doctorId, LocalDate appointmentDate);

    @Query("SELECT a FROM Appointment a WHERE a.appointmentDate = :date AND a.status = 'CONFIRMED'")
    List<Appointment> findConfirmedAppointmentsByDate(@Param("date") LocalDate date);
}
