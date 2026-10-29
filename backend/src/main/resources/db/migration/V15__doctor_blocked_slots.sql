-- Slots a doctor has marked as booked themselves (a break, a personal errand...). Customers cannot book them.
CREATE TABLE doctor_blocked_slots (
    id BIGSERIAL PRIMARY KEY,
    doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_blocked_slot UNIQUE (doctor_id, slot_date, start_time)
);
CREATE INDEX idx_blocked_doctor_date ON doctor_blocked_slots(doctor_id, slot_date);
