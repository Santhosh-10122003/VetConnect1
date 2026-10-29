-- V13 put a plus sign in front of numbers that had been typed without a country code. Ten-digit mobile numbers that
-- start with 6, 7, 8 or 9 are Indian numbers (the app's default country), so they get +91 in front.
UPDATE users SET phone = '+91' || substr(phone, 2)
WHERE phone ~ '^[+][6-9][0-9]{9}$'
  AND NOT EXISTS (SELECT 1 FROM users other WHERE other.phone = '+91' || substr(users.phone, 2));
