-- ---------------------------------------------------------------
-- Email OTP verification at sign-up
-- ---------------------------------------------------------------
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;
-- Every account that exists today predates OTP and stays verified (default TRUE above).
-- New sign-ups are inserted with email_verified = FALSE by the application.

CREATE TABLE email_verification_otps (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    failed_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_otps_user ON email_verification_otps(user_id);

-- ---------------------------------------------------------------
-- Location (customers and clinics)
-- ---------------------------------------------------------------
ALTER TABLE customer_profiles ADD COLUMN postal_code VARCHAR(20);
ALTER TABLE customer_profiles ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE customer_profiles ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE doctor_profiles ADD COLUMN clinic_city VARCHAR(100);
ALTER TABLE doctor_profiles ADD COLUMN clinic_postal_code VARCHAR(20);
ALTER TABLE doctor_profiles ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE doctor_profiles ADD COLUMN longitude DOUBLE PRECISION;

CREATE INDEX idx_doctor_city ON doctor_profiles(LOWER(clinic_city));

-- Sample data: the three seeded clinics are in different places (Sarah ~2 km from the demo customer,
-- Raj ~21 km, Emily ~69 km), which lets the location filter be demonstrated.
UPDATE doctor_profiles d SET clinic_city = 'Springfield', latitude = 39.7817, longitude = -89.6501
  FROM users u WHERE d.user_id = u.id AND u.email = 'dr.sarah@vetconnect.com';
UPDATE doctor_profiles d SET clinic_city = 'West Bay', latitude = 39.9000, longitude = -89.4500
  FROM users u WHERE d.user_id = u.id AND u.email = 'dr.raj@vetconnect.com';
UPDATE doctor_profiles d SET clinic_city = 'Northview', latitude = 40.3000, longitude = -89.2000
  FROM users u WHERE d.user_id = u.id AND u.email = 'dr.emily@vetconnect.com';
UPDATE customer_profiles c SET city = 'Springfield', latitude = 39.7990, longitude = -89.6440
  FROM users u WHERE c.user_id = u.id AND u.email = 'john.doe@example.com';

-- Any other existing clinic: take the part of its address after the first comma as the city.
UPDATE doctor_profiles SET clinic_city = TRIM(SPLIT_PART(clinic_address, ',', 2))
 WHERE clinic_city IS NULL AND POSITION(',' IN clinic_address) > 0 AND TRIM(SPLIT_PART(clinic_address, ',', 2)) <> '';
UPDATE doctor_profiles SET clinic_city = 'Unknown' WHERE clinic_city IS NULL;
ALTER TABLE doctor_profiles ALTER COLUMN clinic_city SET NOT NULL;

-- ---------------------------------------------------------------
-- Admin decision reasons and re-approval requests
-- ---------------------------------------------------------------
ALTER TABLE doctor_profiles ADD COLUMN verification_reason TEXT;
ALTER TABLE doctor_profiles ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE doctor_profiles ADD COLUMN resubmitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE doctor_profiles ADD COLUMN resubmit_note TEXT;
-- verification_status (VARCHAR(30)) gains the value RESUBMITTED; no schema change is needed.
