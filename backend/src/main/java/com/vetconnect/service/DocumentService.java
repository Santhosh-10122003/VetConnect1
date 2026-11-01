package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.VerificationDocument;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.domain.enums.VerificationStatus;
import com.vetconnect.dto.DocumentDtos.DocumentDto;
import com.vetconnect.dto.DocumentDtos.DocumentLinkDto;
import com.vetconnect.repository.DoctorProfileRepository;
import com.vetconnect.repository.ProviderProfileRepository;
import com.vetconnect.repository.VerificationDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Certificates and licences that doctors and pet-care businesses upload so an admin can check them against the
 * State Veterinary Council register or the municipal trade-licence records. Only PDF, JPG and PNG are accepted
 * (the file's own bytes decide that, not its name), they are stored under a random name, and they open through a
 * short-lived signed link so no document is ever public.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Set<String> TYPES = Set.of("DEGREE", "REGISTRATION_CERTIFICATE", "TRADE_LICENCE", "ID_PROOF", "OTHER");

    private final VerificationDocumentRepository documentRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final ProviderProfileRepository providerProfileRepository;
    private final AppProperties appProperties;
    private final Clock clock;

    private record Owner(String type, Long id, VerificationStatus status) {
    }

    /**
     * New documents come with the sign-up (the application is still waiting for its first review) or after the admin
     * rejected it. While it is being reviewed, or once it is approved, what the admin sees must not change under them.
     */
    private static void requireChangeable(Owner owner) {
        if (owner.status() != VerificationStatus.PENDING && owner.status() != VerificationStatus.REJECTED) {
            throw new BadRequestException("Documents can be changed only if the admin rejects your application.");
        }
    }

    /** What the file really is, judged by its first bytes; null if it is none of the accepted kinds. */
    private static String[] sniff(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return new String[]{"application/pdf", "pdf"};
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return new String[]{"image/png", "png"};
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return new String[]{"image/jpeg", "jpg"};
        return null;
    }

    private Owner ownerOf(Long userId) {
        var doctor = doctorProfileRepository.findByUserId(userId);
        if (doctor.isPresent()) return new Owner("DOCTOR", doctor.get().getId(), doctor.get().getVerificationStatus());
        var provider = providerProfileRepository.findByUserId(userId);
        if (provider.isPresent()) return new Owner("PROVIDER", provider.get().getId(), provider.get().getVerificationStatus());
        throw new BadRequestException("Only doctors and pet-care businesses upload verification documents.");
    }

    private Path dir() throws IOException {
        Path d = Paths.get(appProperties.getUploads().getDir()).toAbsolutePath().normalize();
        Files.createDirectories(d);
        return d;
    }

    @Transactional
    public DocumentDto upload(Long userId, String type, MultipartFile file) {
        Owner owner = ownerOf(userId);
        requireChangeable(owner);
        String docType = type == null ? "" : type.trim().toUpperCase();
        if (!TYPES.contains(docType)) throw new BadRequestException("Choose what kind of document this is.");
        if (file == null || file.isEmpty()) throw new BadRequestException("Choose a file to upload.");
        long max = appProperties.getUploads().getMaxBytes();
        if (file.getSize() > max) throw new BadRequestException("That file is too large. The limit is " + (max / (1024 * 1024)) + " MB.");
        if (documentRepository.countByOwnerTypeAndOwnerId(owner.type(), owner.id()) >= appProperties.getUploads().getMaxPerOwner()) {
            throw new BadRequestException("You can keep up to " + appProperties.getUploads().getMaxPerOwner() + " documents. Remove one first.");
        }
        try {
            byte[] bytes = file.getBytes();
            String[] kind = sniff(bytes);
            if (kind == null) throw new BadRequestException("Upload a PDF, JPG or PNG file.");
            String stored = UUID.randomUUID() + "." + kind[1];
            Files.write(dir().resolve(stored), bytes);
            String name = file.getOriginalFilename() == null ? "document." + kind[1] : file.getOriginalFilename().replaceAll("[\\\\/\\r\\n]", "_");
            if (name.length() > 150) name = name.substring(name.length() - 150);
            VerificationDocument saved = documentRepository.save(VerificationDocument.builder()
                    .ownerType(owner.type()).ownerId(owner.id()).docType(docType).originalName(name)
                    .storedName(stored).contentType(kind[0]).sizeBytes(bytes.length).build());
            log.info("Verification document uploaded: id={} owner={}#{} type={} size={}", saved.getId(), owner.type(), owner.id(), docType, bytes.length);
            return toDto(saved);
        } catch (IOException e) {
            log.error("Could not store a verification document: {}", e.getMessage());
            throw new BadRequestException("The file could not be saved. Please try again.");
        }
    }

    public List<DocumentDto> mine(Long userId) {
        Owner owner = ownerOf(userId);
        return documentRepository.findByOwnerTypeAndOwnerIdOrderByUploadedAtDesc(owner.type(), owner.id()).stream().map(this::toDto).toList();
    }

    /** Removes every document (rows and files) of a profile: used when the account is deleted. */
    @Transactional
    public void deleteAllFor(String ownerType, Long ownerId) {
        for (VerificationDocument d : documentRepository.findByOwnerTypeAndOwnerIdOrderByUploadedAtDesc(ownerType, ownerId)) {
            documentRepository.delete(d);
            try {
                Files.deleteIfExists(dir().resolve(d.getStoredName()));
            } catch (IOException e) {
                log.warn("Could not delete the file of document {}", d.getId());
            }
        }
    }

    /** For the admin reviewing one applicant. */
    public List<DocumentDto> forOwner(String ownerType, Long ownerId) {
        String t = ownerType == null ? "" : ownerType.toUpperCase();
        if (!t.equals("DOCTOR") && !t.equals("PROVIDER")) throw new BadRequestException("Unknown owner type.");
        return documentRepository.findByOwnerTypeAndOwnerIdOrderByUploadedAtDesc(t, ownerId).stream().map(this::toDto).toList();
    }

    @Transactional
    public void delete(Long userId, Long documentId) {
        Owner owner = ownerOf(userId);
        requireChangeable(owner);
        VerificationDocument d = documentRepository.findById(documentId)
                .filter(x -> x.getOwnerType().equals(owner.type()) && x.getOwnerId().equals(owner.id()))
                .orElseThrow(() -> new ResourceNotFoundException("Document not found."));
        documentRepository.delete(d);
        try {
            Files.deleteIfExists(dir().resolve(d.getStoredName()));
        } catch (IOException e) {
            log.warn("Document row removed but its file could not be deleted: {}", d.getStoredName());
        }
        log.info("Verification document deleted: id={} owner={}#{}", documentId, owner.type(), owner.id());
    }

    /** A link that opens the document for a few minutes. Admins may open any; owners only their own. */
    public DocumentLinkDto link(UserPrincipal user, Long documentId) {
        VerificationDocument d = documentRepository.findById(documentId).orElseThrow(() -> new ResourceNotFoundException("Document not found."));
        if (user.getRole() != Role.ROLE_ADMIN) {
            Owner owner = ownerOf(user.getId());
            if (!d.getOwnerType().equals(owner.type()) || !d.getOwnerId().equals(owner.id())) throw new UnauthorizedException("You cannot open this document.");
        }
        long exp = clock.millis() + appProperties.getUploads().getLinkMinutes() * 60_000L;
        return DocumentLinkDto.builder().path("/documents/" + documentId + "/file?exp=" + exp + "&sig=" + sign(documentId, exp)).expiresAt(exp).build();
    }

    public record Opened(Resource resource, String contentType, String name) {
    }

    /** Opens the file behind a signed link; anything wrong with the link is a plain "not found". */
    public Opened open(Long documentId, long exp, String sig) {
        if (exp < clock.millis() || sig == null || !MessageDigest.isEqual(sign(documentId, exp).getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8))) {
            throw new ResourceNotFoundException("This link has expired. Open the document again.");
        }
        VerificationDocument d = documentRepository.findById(documentId).orElseThrow(() -> new ResourceNotFoundException("Document not found."));
        try {
            Path p = dir().resolve(d.getStoredName()).normalize();
            if (!p.startsWith(dir()) || !Files.isRegularFile(p)) throw new ResourceNotFoundException("Document not found.");
            return new Opened(new FileSystemResource(p), d.getContentType(), d.getOriginalName());
        } catch (IOException e) {
            throw new ResourceNotFoundException("Document not found.");
        }
    }

    private String sign(Long id, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(("documents:" + appProperties.getJwt().getSecret()).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((id + ":" + exp).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign the link", e);
        }
    }

    private DocumentDto toDto(VerificationDocument d) {
        return DocumentDto.builder().id(d.getId()).type(d.getDocType()).name(d.getOriginalName()).contentType(d.getContentType())
                .sizeBytes(d.getSizeBytes()).uploadedAt(d.getUploadedAt()).build();
    }
}
