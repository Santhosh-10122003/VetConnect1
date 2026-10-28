-- Country and state next to the existing city/district so that "Springfield" in two countries is not the same place.
ALTER TABLE customer_profiles ADD COLUMN country VARCHAR(100);
ALTER TABLE customer_profiles ADD COLUMN state VARCHAR(100);

ALTER TABLE doctor_profiles ADD COLUMN clinic_country VARCHAR(100);
ALTER TABLE doctor_profiles ADD COLUMN clinic_state VARCHAR(100);
