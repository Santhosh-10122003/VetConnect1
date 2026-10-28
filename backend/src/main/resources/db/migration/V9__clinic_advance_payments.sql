-- Vet appointments take an advance payment (50% of the consultation fee by default), like pet-care bookings.
-- care_payments now holds the advance for either a pet-care booking or a vet appointment.

ALTER TABLE appointments ADD COLUMN total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN advance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN balance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN currency VARCHAR(3);
ALTER TABLE appointments ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Appointments created before advance payments were charged the whole fee at the clinic.
UPDATE appointments a SET total_amount = d.consultation_fee, balance_amount = d.consultation_fee
FROM doctor_profiles d WHERE a.doctor_id = d.id;

-- A slot is free again once its appointment is cancelled, rejected or its unpaid hold has expired.
DROP INDEX idx_unique_active_doctor_slot;
CREATE UNIQUE INDEX idx_unique_active_doctor_slot
ON appointments (doctor_id, appointment_date, start_time)
WHERE status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED');

ALTER TABLE care_payments ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE care_payments ADD COLUMN appointment_id BIGINT REFERENCES appointments(id) ON DELETE CASCADE;
ALTER TABLE care_payments ADD CONSTRAINT chk_care_payments_target
    CHECK ((booking_id IS NOT NULL AND appointment_id IS NULL) OR (booking_id IS NULL AND appointment_id IS NOT NULL));
CREATE INDEX idx_care_payments_appointment ON care_payments(appointment_id);
