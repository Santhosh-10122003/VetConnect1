-- A doctor can mark a slot as booked for someone who called or walked in: keep who it is for.
ALTER TABLE doctor_blocked_slots ADD COLUMN customer_name VARCHAR(120);
ALTER TABLE doctor_blocked_slots ADD COLUMN customer_phone VARCHAR(20);
