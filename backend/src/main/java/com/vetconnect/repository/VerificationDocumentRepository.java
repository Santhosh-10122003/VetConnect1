package com.vetconnect.repository;

import com.vetconnect.domain.entities.VerificationDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VerificationDocumentRepository extends JpaRepository<VerificationDocument, Long> {
    List<VerificationDocument> findByOwnerTypeAndOwnerIdOrderByUploadedAtDesc(String ownerType, Long ownerId);

    long countByOwnerTypeAndOwnerId(String ownerType, Long ownerId);
}
