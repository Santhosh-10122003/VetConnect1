-- A customer asking to move an appointment is a request the doctor approves or declines; until then the
-- appointment keeps its original slot.
ALTER TABLE appointments ADD COLUMN reschedule_date DATE;
ALTER TABLE appointments ADD COLUMN reschedule_start_time TIME;
ALTER TABLE appointments ADD COLUMN reschedule_end_time TIME;
ALTER TABLE appointments ADD COLUMN reschedule_note TEXT;
ALTER TABLE appointments ADD COLUMN reschedule_requested_at TIMESTAMP WITH TIME ZONE;
