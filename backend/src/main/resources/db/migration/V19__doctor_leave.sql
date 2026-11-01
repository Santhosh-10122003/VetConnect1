-- Days a doctor is away (a holiday, a conference...). Customers cannot book any slot on them.
CREATE TABLE doctor_leave (
    id BIGSERIAL PRIMARY KEY,
    doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_leave_dates CHECK (to_date >= from_date)
);
CREATE INDEX idx_leave_doctor_dates ON doctor_leave(doctor_id, from_date, to_date);
