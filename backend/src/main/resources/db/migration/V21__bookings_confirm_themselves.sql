-- A paid booking is confirmed at once now (no doctor approval). Requests that were still waiting are confirmed too.
UPDATE appointments SET status = 'CONFIRMED' WHERE status = 'PENDING';
UPDATE care_bookings SET status = 'CONFIRMED' WHERE status = 'REQUESTED';
