package com.vetconnect.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

public final class DocumentDtos {

    private DocumentDtos() {
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DocumentDto {
        private Long id;
        private String type;
        private String name;
        private String contentType;
        private long sizeBytes;
        private Instant uploadedAt;
    }

    /** A short-lived address the browser or phone can open without a sign-in header. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DocumentLinkDto {
        private String path;
        private long expiresAt;
    }
}
