package com.vetconnect.controller;

import com.vetconnect.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class PetLandingControllerTest {

    private String body(ResponseEntity<byte[]> r) {
        return new String(r.getBody(), StandardCharsets.UTF_8);
    }

    @Test
    void thePageSaysToDownloadTheAppAndTriesToOpenIt_withoutShowingAnythingAboutThePet() {
        PetLandingController c = new PetLandingController(new AppProperties());
        ResponseEntity<byte[]> r = c.landing("999123456789012");
        assertEquals(200, r.getStatusCode().value());
        String html = body(r);
        assertTrue(html.contains("Download Jenni to view"));
        assertTrue(html.contains("jenni://find-pet?number=999123456789012"), "tries to open the app");
        assertFalse(html.toLowerCase().contains("owner:"), "no owner details on the page");
        assertTrue(html.contains("Search for <b>Jenni</b>"), "with no store links set it still tells people what to look for");
    }

    @Test
    void storeButtonsAppearWhenTheLinksAreSet_andAreEscaped() {
        AppProperties props = new AppProperties();
        props.getApp().setAndroidUrl("https://play.google.com/store/apps/details?id=com.jenni.app&x=\"><script>");
        props.getApp().setIosUrl("https://apps.apple.com/app/jenni/id1");
        String html = body(new PetLandingController(props).landing("999123456789012"));
        assertTrue(html.contains("Get it on Google Play") && html.contains("Download on the App Store"));
        assertFalse(html.contains("\"><script>"), "a link cannot break out of its attribute");
        assertFalse(html.contains("Search for <b>Jenni</b>"));
    }

    @Test
    void anythingThatIsNotAFifteenDigitNumberIsNotFound() {
        PetLandingController c = new PetLandingController(new AppProperties());
        for (String bad : new String[]{"12345", "99912345678901<", "abc", "9991234567890123"}) {
            assertEquals(404, c.landing(bad).getStatusCode().value(), bad);
        }
    }
}
