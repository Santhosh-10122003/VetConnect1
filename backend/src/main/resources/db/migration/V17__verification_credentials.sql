-- What an admin needs to check a veterinarian against the State Veterinary Council register
-- (the registration number is the existing license_number column).
ALTER TABLE doctor_profiles ADD COLUMN degree VARCHAR(100);
ALTER TABLE doctor_profiles ADD COLUMN council_name VARCHAR(150);

-- What an admin needs to check a pet-care business: the trade licence is registration_number,
-- and the vet it works with (on call or partner).
ALTER TABLE provider_profiles ADD COLUMN vet_partner_name VARCHAR(150);
ALTER TABLE provider_profiles ADD COLUMN vet_partner_phone VARCHAR(20);
