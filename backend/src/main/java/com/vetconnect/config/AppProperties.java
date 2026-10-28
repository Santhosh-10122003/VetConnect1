package com.vetconnect.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "vetconnect")
@Getter
@Setter
public class AppProperties {
    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private Reset reset = new Reset();
    private Otp otp = new Otp();
    private Location location = new Location();
    private Geo geo = new Geo();
    private Care care = new Care();
    private Payments payments = new Payments();
    private Clinic clinic = new Clinic();

    @Getter
    @Setter
    public static class Jwt {
        private String secret = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
        private long expirationMs = 86400000; // 24 hours
        private long refreshExpirationMs = 604800000; // 7 days
    }

    @Getter
    @Setter
    public static class Reset {
        private long tokenExpirationMs = 1800000; // 30 minutes
        private int maxFailedAttempts = 5;
    }

    @Getter
    @Setter
    public static class Otp {
        private long expirationMs = 600000; // 10 minutes
        private int maxFailedAttempts = 5;
        private long resendCooldownMs = 30000; // minimum gap between two codes
    }

    @Getter
    @Setter
    public static class Location {
        private double defaultRadiusKm = 25;
        private double maxRadiusKm = 100;
    }

    @Getter
    @Setter
    public static class Geo {
        private String nominatimUrl = "https://nominatim.openstreetmap.org";
        /** Nominatim's usage policy requires an identifying User-Agent. */
        private String userAgent = "VetConnect/1.0 (pet care app)";
        private int timeoutMs = 6000;
        private int requestsPerMinutePerClient = 30;
    }

    /** Pet-care bookings: grooming, boarding and training. */
    @Getter
    @Setter
    public static class Care {
        /** How long an unpaid booking holds its slot. */
        private int holdMinutes = 15;
        /** A customer who cancels at least this long before the start gets the advance back. */
        private int cancellationWindowHours = 24;
        private int maxBoardingNights = 30;
        private int maxAdvanceBookingDays = 180;
        private String currency = "USD";
        private String currencySymbol = "$";
    }

    @Getter
    @Setter
    public static class Payments {
        /** "simulated" is a test-mode gateway with no real money; "razorpay" takes real (or Razorpay test-mode) payments. */
        private String gateway = "simulated";
        private Razorpay razorpay = new Razorpay();
    }

    @Getter
    @Setter
    public static class Razorpay {
        /** Public key id (rzp_test_... or rzp_live_...); the app uses it to open the checkout. */
        private String keyId = "";
        /** Secret: stays on the server, signs and verifies payments. Never sent to the app. */
        private String keySecret = "";
        private String apiUrl = "https://api.razorpay.com/v1";
    }

    /** Advance payment for vet appointments. */
    @Getter
    @Setter
    public static class Clinic {
        /** Share of the consultation fee paid up front (the rest is paid at the clinic). */
        private int advancePercent = 50;
    }

    @Getter
    @Setter
    public static class Cors {
        private String allowedOrigins = "*";
        private String allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
        private String allowedHeaders = "*";
    }
}
