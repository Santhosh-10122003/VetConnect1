package com.vetconnect.controller;

import com.vetconnect.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;

/**
 * The page a pet's QR code opens in a phone's browser. It tries to open the Jenni app; if the app is not installed it says
 * to download it. It never shows anything about the pet or its owner: those are only shown inside the app.
 */
@RestController
@RequestMapping("/api/p")
@RequiredArgsConstructor
@Tag(name = "Pets", description = "Endpoints for managing pet profiles")
public class PetLandingController {

    private final AppProperties appProperties;

    @GetMapping(value = "/{number}", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "The page a pet's QR code opens: open the Jenni app, or download it to see the owner")
    public ResponseEntity<byte[]> landing(@PathVariable String number) {
        if (!number.matches("\\d{15}")) {
            return ResponseEntity.status(404).contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                    .body("<!doctype html><meta charset=utf-8><title>Jenni</title><p style='font-family:sans-serif;padding:24px'>This pet link is not valid.</p>".getBytes(StandardCharsets.UTF_8));
        }
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Referrer-Policy", "no-referrer")
                .body(page(number).getBytes(StandardCharsets.UTF_8));
    }

    private String store(String url, String label) {
        return url == null || url.isBlank() ? "" : "<a class=\"store\" href=\"" + HtmlUtils.htmlEscape(url) + "\">" + label + "</a>";
    }

    String page(String number) {
        String stores = store(appProperties.getApp().getAndroidUrl(), "Get it on Google Play") + store(appProperties.getApp().getIosUrl(), "Download on the App Store");
        String noStores = stores.isEmpty() ? "<p class=\"small\">Search for <b>Jenni</b> in the App Store or Google Play.</p>" : "";
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"robots\" content=\"noindex\"><title>Jenni: a pet was found</title><style>"
                + "body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center}"
                + ".card{max-width:380px;margin:24px;padding:32px 24px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;text-align:center}"
                + ".logo{width:64px;height:64px;border-radius:32px;background:#0f1115;color:#fff;font-size:30px;line-height:64px;margin:0 auto 16px}"
                + "h1{font-size:24px;margin:0 0 10px}p{color:#64748b;line-height:1.5;margin:8px 0}.small{font-size:13px}"
                + ".store,.open{display:block;margin:12px 0 0;padding:14px;border-radius:16px;background:#0f1115;color:#fff;text-decoration:none;font-weight:700}"
                + ".open{background:#2b95d6}"
                + "</style></head><body><div class=\"card\"><div class=\"logo\">J</div>"
                + "<h1>Download Jenni to view</h1>"
                + "<p>This pet's tag is a Jenni QR code. Install the free Jenni app to see who the owner is and how to reach them.</p>"
                + stores + noStores
                + "<a class=\"open\" id=\"open\" href=\"jenni://find-pet?number=" + number + "\">I have Jenni: open it</a>"
                + "<script>setTimeout(function(){location.href='jenni://find-pet?number=" + number + "';},300);</script>"
                + "</div></body></html>";
    }
}
