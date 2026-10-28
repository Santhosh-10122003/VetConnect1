package com.vetconnect.repository;

import com.vetconnect.domain.entities.CareService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CareServiceRepository extends JpaRepository<CareService, Long> {

    List<CareService> findByProviderIdOrderByCategoryAscIsAddonAscNameAsc(Long providerId);

    List<CareService> findByProviderIdAndIsActiveTrueOrderByCategoryAscIsAddonAscNameAsc(Long providerId);

    Optional<CareService> findByIdAndProviderId(Long id, Long providerId);
}
