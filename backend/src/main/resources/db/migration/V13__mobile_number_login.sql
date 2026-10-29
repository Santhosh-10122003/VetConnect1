-- Accounts are identified by their mobile number: stored in international form and unique.

-- Tidy what is already there: keep digits and a leading plus.
UPDATE users SET phone = NULLIF(regexp_replace(phone, '[^0-9+]', '', 'g'), '') WHERE phone IS NOT NULL;
UPDATE users SET phone = '+' || phone WHERE phone IS NOT NULL AND phone NOT LIKE '+%';
-- Numbers that are not usable as a login (too short or too long) are dropped; the account still signs in by email.
UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND phone !~ '^[+][1-9][0-9]{6,14}$';

-- The demo accounts that had no number get one.
UPDATE users SET phone = '+15550301' WHERE email = 'groomer@vetconnect.com' AND phone IS NULL;
UPDATE users SET phone = '+15550302' WHERE email = 'stay@vetconnect.com' AND phone IS NULL;
UPDATE users SET phone = '+15550100' WHERE email = 'admin@vetconnect.com' AND phone IS NULL;

-- A number can belong to one account only: when several shared one, the oldest account keeps it.
UPDATE users SET phone = NULL
WHERE phone IS NOT NULL AND id NOT IN (SELECT MIN(id) FROM users WHERE phone IS NOT NULL GROUP BY phone);

CREATE UNIQUE INDEX uq_users_phone ON users(phone) WHERE phone IS NOT NULL;
