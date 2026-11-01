package com.vetconnect.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** A certificate or licence uploaded by a doctor ("DOCTOR") or a pet-care business ("PROVIDER"). */
@Entity
@Table(name = "verification_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerificationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_type", nullable = false, length = 10)
    private String ownerType;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "doc_type", nullable = false, length = 30)
    private String docType;

    @Column(name = "original_name", nullable = false, length = 200)
    private String originalName;

    /** The random name the file has on disk: nothing the uploader typed ever becomes part of a path. */
    @Column(name = "stored_name", nullable = false, unique = true, length = 100)
    private String storedName;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @CreationTimestamp
    @Column(name = "uploaded_at", updatable = false)
    private Instant uploadedAt;
}
