-- Time-change requests no longer wait for the doctor: any still open are dropped (the appointment keeps its time).
UPDATE appointments SET reschedule_date = NULL, reschedule_start_time = NULL, reschedule_end_time = NULL, reschedule_note = NULL, reschedule_requested_at = NULL WHERE reschedule_date IS NOT NULL;
