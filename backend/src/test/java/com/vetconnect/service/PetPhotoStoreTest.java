package com.vetconnect.service;

import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class PetPhotoStoreTest {

    @TempDir Path dir;
    private PetPhotoStore store;

    private static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        props.getUploads().setDir(dir.toString());
        store = new PetPhotoStore(props);
    }

    private MockMultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("file", name, "image/jpeg", bytes);
    }

    @Test
    void aJpgOrPngIsKeptUnderARandomNameAndFoundAgain() {
        String url = store.save(file("../../my dog.jpg", JPG));
        assertTrue(url.startsWith("/pet-photos/") && url.endsWith(".jpg"));
        assertFalse(url.contains("dog"));
        assertTrue(store.save(file("x.png", PNG)).endsWith(".png"));
        assertNotNull(store.load(url.substring("/pet-photos/".length())));
        assertEquals("image/png", PetPhotoStore.contentType("a.png"));
    }

    @Test
    void anythingElseIsRefusedWhateverItIsCalled() {
        assertThrows(BadRequestException.class, () -> store.save(file("dog.jpg", "<html>not a photo</html>".getBytes(StandardCharsets.UTF_8))));
        assertThrows(BadRequestException.class, () -> store.save(file("dog.jpg", new byte[0])));
    }

    @Test
    void onlyNamesWeGaveOutCanBeOpened() {
        assertThrows(ResourceNotFoundException.class, () -> store.load("../application.yml"));
        assertThrows(ResourceNotFoundException.class, () -> store.load("photo.jpg"));
        assertThrows(ResourceNotFoundException.class, () -> store.load("11111111-1111-1111-1111-111111111111.jpg"));
    }

    @Test
    void deletingRemovesTheFileAndIgnoresOtherAddresses() throws Exception {
        String url = store.save(file("a.jpg", JPG));
        Path onDisk = dir.resolve("pet-photos").resolve(url.substring("/pet-photos/".length()));
        assertTrue(Files.exists(onDisk));
        store.delete("https://elsewhere.example/x.jpg");
        store.delete(null);
        assertTrue(Files.exists(onDisk));
        store.delete(url);
        assertFalse(Files.exists(onDisk));
    }
}
