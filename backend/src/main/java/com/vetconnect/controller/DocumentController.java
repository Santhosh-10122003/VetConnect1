package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.DocumentDtos.DocumentDto;
import com.vetconnect.dto.DocumentDtos.DocumentLinkDto;
import com.vetconnect.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Verification documents", description = "Certificates and licences uploaded for the admin to check")
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping(value = "/api/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('DOCTOR','PROVIDER')")
    @Operation(summary = "Upload a certificate or licence (PDF, JPG or PNG, up to 5 MB)")
    public ResponseEntity<ApiResponse<DocumentDto>> upload(@AuthenticationPrincipal UserPrincipal user,
                                                           @RequestParam String type, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(ApiResponse.ok(documentService.upload(user.getId(), type, file)));
    }

    @GetMapping("/api/documents")
    @PreAuthorize("hasAnyRole('DOCTOR','PROVIDER')")
    @Operation(summary = "My uploaded documents")
    public ResponseEntity<ApiResponse<List<DocumentDto>>> mine(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.mine(user.getId())));
    }

    @DeleteMapping("/api/documents/{id}")
    @PreAuthorize("hasAnyRole('DOCTOR','PROVIDER')")
    @Operation(summary = "Remove one of my documents")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        documentService.delete(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/api/documents/{id}/link")
    @PreAuthorize("hasAnyRole('DOCTOR','PROVIDER','ADMIN')")
    @Operation(summary = "A short-lived link that opens the document (the owner, or an admin)")
    public ResponseEntity<ApiResponse<DocumentLinkDto>> link(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.link(user, id)));
    }

    /** Reached through a signed link, so it needs no sign-in header. */
    @GetMapping("/api/documents/{id}/file")
    @Operation(summary = "The document itself, through a signed link")
    public ResponseEntity<Resource> file(@PathVariable Long id, @RequestParam long exp, @RequestParam String sig) {
        var opened = documentService.open(id, exp, sig);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(opened.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(opened.name(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(opened.resource());
    }

    @GetMapping("/api/admin/documents/{ownerType}/{ownerId}")
    @Operation(summary = "Admin: the documents an applicant uploaded (ownerType is DOCTOR or PROVIDER)")
    public ResponseEntity<ApiResponse<List<DocumentDto>>> forOwner(@PathVariable String ownerType, @PathVariable Long ownerId) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.forOwner(ownerType, ownerId)));
    }
}
