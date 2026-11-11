package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Where pets' profile photos live. A photo is a JPG or PNG (judged by its own bytes, not its name), kept under a random
 * name. Photos are not secret (they are shown on screens and cards), so they open by their unguessable name without a
 * sign-in; everything else a pet has stays behind the owner's login.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetPhotoStore {

    public static final String URL_PREFIX = "/pet-photos/";
    private static final Pattern NAME = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)$");

    private final AppProperties appProperties;

    private Path dir() throws IOException {
        Path d = Paths.get(appProperties.getUploads().getDir(), "pet-photos").toAbsolutePath().normalize();
        Files.createDirectories(d);
        return d;
    }

    /** Stores the photo and returns the address to keep on the pet, like /pet-photos/<name>.jpg. */
    public String save(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Choose a photo to upload.");
        if (file.getSize() > appProperties.getUploads().getMaxBytes()) {
            throw new BadRequestException("That photo is too large. The limit is " + (appProperties.getUploads().getMaxBytes() / (1024 * 1024)) + " MB.");
        }
        try {
            byte[] b = file.getBytes();
            String ext;
            if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) ext = "jpg";
            else if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') ext = "png";
            else throw new BadRequestException("Upload a JPG or PNG photo.");
            String name = UUID.randomUUID() + "." + ext;
            Files.write(dir().resolve(name), b);
            return URL_PREFIX + name;
        } catch (IOException e) {
            log.error("Could not store a pet photo: {}", e.getMessage());
            throw new BadRequestException("The photo could not be saved. Please try again.");
        }
    }

    /** Removes the file behind an address we gave out; anything else (an old link, null) is ignored. */
    public void delete(String url) {
        if (url == null || !url.startsWith(URL_PREFIX)) return;
        String name = url.substring(URL_PREFIX.length());
        if (!NAME.matcher(name).matches()) return;
        try {
            Files.deleteIfExists(dir().resolve(name));
        } catch (IOException e) {
            log.warn("Could not delete pet photo {}", name);
        }
    }

    public Resource load(String name) {
        if (name == null || !NAME.matcher(name).matches()) throw new ResourceNotFoundException("Photo not found.");
        try {
            Path p = dir().resolve(name).normalize();
            if (!p.startsWith(dir()) || !Files.isRegularFile(p)) throw new ResourceNotFoundException("Photo not found.");
            return new FileSystemResource(p);
        } catch (IOException e) {
            throw new ResourceNotFoundException("Photo not found.");
        }
    }

    public static String contentType(String name) {
        return name.endsWith(".png") ? "image/png" : "image/jpeg";
    }
}
