package com.vetconnect.controller;

import com.vetconnect.service.PetPhotoStore;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/pet-photos")
@RequiredArgsConstructor
@Tag(name = "Pets", description = "Endpoints for managing pet profiles")
public class PetPhotoController {

    private final PetPhotoStore photoStore;

    @GetMapping("/{name}")
    @Operation(summary = "A pet's profile photo")
    public ResponseEntity<Resource> photo(@PathVariable String name) {
        Resource r = photoStore.load(name);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(PetPhotoStore.contentType(name)))
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .body(r);
    }
}
