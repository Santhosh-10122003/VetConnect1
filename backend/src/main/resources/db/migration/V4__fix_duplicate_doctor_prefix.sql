-- Earlier notification texts prefixed names that already start with "Dr." a second time.
UPDATE notifications SET message = REPLACE(message, 'Dr. Dr. ', 'Dr. ') WHERE message LIKE '%Dr. Dr. %';
UPDATE notifications SET title = REPLACE(title, 'Dr. Dr. ', 'Dr. ') WHERE title LIKE '%Dr. Dr. %';
