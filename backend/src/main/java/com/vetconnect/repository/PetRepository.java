package com.vetconnect.repository;

import com.vetconnect.domain.entities.Pet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PetRepository extends JpaRepository<Pet, Long> {
    List<Pet> findByCustomerId(Long customerId);
    Optional<Pet> findByIdAndCustomerId(Long id, Long customerId);
    long countByCustomerId(Long customerId);
}
