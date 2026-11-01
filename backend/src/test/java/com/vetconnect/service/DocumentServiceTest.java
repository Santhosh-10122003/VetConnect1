package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.exceptions.UnauthorizedException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.DoctorProfile;
import com.vetconnect.domain.entities.ProviderProfile;
import com.vetconnect.domain.entities.VerificationDocument;
import com.vetconnect.domain.enums.Role;
import com.vetconnect.dto.DocumentDtos.DocumentDto;
import com.vetconnect.dto.DocumentDtos.DocumentLinkDto;
import com.vetconnect.repository.DoctorProfileRepository;
import com.vetconnect.repository.ProviderProfileRepository;
import com.vetconnect.repository.VerificationDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock private VerificationDocumentRepository documentRepository;
    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private ProviderProfileRepository providerProfileRepository;

    @TempDir Path dir;
    private final List<VerificationDocument> saved = new ArrayList<>();
    private AppProperties props;
    private DocumentService service;

    private static final byte[] PDF = "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8);
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.getUploads().setDir(dir.toString());
        Clock clock = Clock.fixed(Instant.parse("2026-11-01T10:00:00Z"), ZoneOffset.UTC);
        service = new DocumentService(documentRepository, doctorProfileRepository, providerProfileRepository, props, clock);
        lenient().when(doctorProfileRepository.findByUserId(2L)).thenReturn(Optional.of(DoctorProfile.builder().id(20L).build()));
        lenient().when(doctorProfileRepository.findByUserId(3L)).thenReturn(Optional.of(DoctorProfile.builder().id(21L).build()));
        lenient().when(providerProfileRepository.findByUserId(4L)).thenReturn(Optional.of(ProviderProfile.builder().id(40L).build()));
        lenient().when(doctorProfileRepository.findByUserId(4L)).thenReturn(Optional.empty());
        lenient().when(documentRepository.save(any(VerificationDocument.class))).thenAnswer(i -> {
            VerificationDocument d = i.getArgument(0);
            d.setId(100L + saved.size());
            saved.add(d);
            return d;
        });
        lenient().when(documentRepository.findById(anyLong())).thenAnswer(i -> saved.stream().filter(d -> d.getId().equals(i.getArgument(0))).findFirst());
        lenient().when(documentRepository.countByOwnerTypeAndOwnerId(anyString(), anyLong())).thenAnswer(i ->
                saved.stream().filter(d -> d.getOwnerType().equals(i.getArgument(0)) && d.getOwnerId().equals(i.getArgument(1))).count());
    }

    private MockMultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("file", name, "application/octet-stream", bytes);
    }

    private UserPrincipal user(long id, Role role) {
        return UserPrincipal.builder().id(id).email("x@x.com").role(role).build();
    }

    @Test
    void aPdfOrImageIsStoredUnderARandomNameAndKindIsJudgedByItsBytes() throws Exception {
        DocumentDto pdf = service.upload(2L, "registration_certificate", file("../../evil name.exe", PDF));
        assertEquals("application/pdf", pdf.getContentType());
        assertEquals("REGISTRATION_CERTIFICATE", pdf.getType());
        VerificationDocument row = saved.get(0);
        assertTrue(row.getStoredName().endsWith(".pdf"));
        assertFalse(row.getStoredName().contains("evil"));
        assertFalse(row.getOriginalName().contains("/"));
        assertTrue(Files.exists(dir.resolve(row.getStoredName())));
        assertEquals("image/png", service.upload(4L, "TRADE_LICENCE", file("licence.png", PNG)).getContentType());
    }

    @Test
    void otherFilesAreRefusedWhateverTheyAreCalled() {
        assertTrue(assertThrows(BadRequestException.class, () -> service.upload(2L, "DEGREE", file("degree.pdf", "MZ-not-a-pdf".getBytes(StandardCharsets.UTF_8)))).getMessage().contains("PDF, JPG or PNG"));
        assertThrows(BadRequestException.class, () -> service.upload(2L, "DEGREE", file("x.pdf", new byte[0])));
        assertThrows(BadRequestException.class, () -> service.upload(2L, "SELFIE", file("x.pdf", PDF)));
        assertEquals(0, saved.size());
    }

    @Test
    void tooLargeAndTooManyAreRefused() {
        props.getUploads().setMaxBytes(10);
        assertTrue(assertThrows(BadRequestException.class, () -> service.upload(2L, "DEGREE", file("x.pdf", PDF))).getMessage().contains("too large"));
        props.getUploads().setMaxBytes(5 * 1024 * 1024);
        props.getUploads().setMaxPerOwner(1);
        service.upload(2L, "DEGREE", file("a.pdf", PDF));
        assertTrue(assertThrows(BadRequestException.class, () -> service.upload(2L, "DEGREE", file("b.pdf", PDF))).getMessage().contains("Remove one"));
    }

    @Test
    void onlyDoctorsAndBusinessesCanUpload() {
        assertThrows(BadRequestException.class, () -> service.upload(9L, "DEGREE", file("a.pdf", PDF)));
    }

    @Test
    void theOwnerAndAnAdminCanOpenItButAnotherDoctorCannot() {
        DocumentDto d = service.upload(2L, "DEGREE", file("a.pdf", PDF));
        assertNotNull(service.link(user(2L, Role.ROLE_DOCTOR), d.getId()).getPath());
        assertNotNull(service.link(user(1L, Role.ROLE_ADMIN), d.getId()).getPath());
        assertThrows(UnauthorizedException.class, () -> service.link(user(3L, Role.ROLE_DOCTOR), d.getId()));
        assertThrows(ResourceNotFoundException.class, () -> service.link(user(1L, Role.ROLE_ADMIN), 999L));
    }

    @Test
    void aSignedLinkOpensTheFileButATamperedOrExpiredOneDoesNot() {
        DocumentDto d = service.upload(2L, "DEGREE", file("a.pdf", PDF));
        DocumentLinkDto link = service.link(user(1L, Role.ROLE_ADMIN), d.getId());
        String sig = link.getPath().substring(link.getPath().indexOf("sig=") + 4);
        long exp = link.getExpiresAt();

        assertEquals("application/pdf", service.open(d.getId(), exp, sig).contentType());
        assertThrows(ResourceNotFoundException.class, () -> service.open(d.getId(), exp, sig.replace(sig.charAt(0), sig.charAt(0) == 'a' ? 'b' : 'a')));
        assertThrows(ResourceNotFoundException.class, () -> service.open(d.getId(), exp + 1, sig), "a longer expiry needs a new signature");
        assertThrows(ResourceNotFoundException.class, () -> service.open(d.getId() + 1, exp, sig), "a link is for one document");
        // five minutes later the same link is dead
        DocumentService later = new DocumentService(documentRepository, doctorProfileRepository, providerProfileRepository, props,
                Clock.fixed(Instant.parse("2026-11-01T10:06:00Z"), ZoneOffset.UTC));
        assertThrows(ResourceNotFoundException.class, () -> later.open(d.getId(), exp, sig));
    }

    @Test
    void deletingRemovesTheFileAndOnlyTheOwnerCanDoIt() throws Exception {
        DocumentDto d = service.upload(2L, "DEGREE", file("a.pdf", PDF));
        Path onDisk = dir.resolve(saved.get(0).getStoredName());
        assertThrows(ResourceNotFoundException.class, () -> service.delete(3L, d.getId()));
        assertTrue(Files.exists(onDisk));
        service.delete(2L, d.getId());
        assertFalse(Files.exists(onDisk));
    }

    @Test
    void documentsChangeOnlyWhileSigningUpOrAfterARejection() {
        com.vetconnect.domain.entities.DoctorProfile doctor = com.vetconnect.domain.entities.DoctorProfile.builder().id(22L).build();
        lenient().when(doctorProfileRepository.findByUserId(7L)).thenReturn(Optional.of(doctor));
        // right after sign-up the application is still waiting for its first review
        DocumentDto first = service.upload(7L, "DEGREE", file("a.pdf", PDF));
        for (var closed : new com.vetconnect.domain.enums.VerificationStatus[]{com.vetconnect.domain.enums.VerificationStatus.RESUBMITTED, com.vetconnect.domain.enums.VerificationStatus.APPROVED}) {
            doctor.setVerificationStatus(closed);
            assertTrue(assertThrows(BadRequestException.class, () -> service.upload(7L, "DEGREE", file("b.pdf", PDF))).getMessage().contains("only if the admin rejects"), closed.name());
            assertThrows(BadRequestException.class, () -> service.delete(7L, first.getId()), closed.name());
            assertEquals(1, service.mine(7L).size() >= 0 ? saved.size() : 0, "nothing was added");
        }
        // the admin rejects it: now the applicant can add and remove
        doctor.setVerificationStatus(com.vetconnect.domain.enums.VerificationStatus.REJECTED);
        assertNotNull(service.upload(7L, "REGISTRATION_CERTIFICATE", file("c.pdf", PDF)));
        service.delete(7L, first.getId());
    }
}
