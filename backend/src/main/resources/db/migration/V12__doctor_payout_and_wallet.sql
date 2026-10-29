-- Doctors also give payment details at sign-up, and every advance paid for their appointments is credited to a wallet.
ALTER TABLE doctor_profiles ADD COLUMN payout_method VARCHAR(10);
ALTER TABLE doctor_profiles ADD COLUMN upi_id VARCHAR(100);
ALTER TABLE doctor_profiles ADD COLUMN account_holder_name VARCHAR(100);
ALTER TABLE doctor_profiles ADD COLUMN bank_account_number VARCHAR(30);
ALTER TABLE doctor_profiles ADD COLUMN ifsc_code VARCHAR(15);
ALTER TABLE doctor_profiles ADD COLUMN bank_name VARCHAR(100);

-- The demo doctors get demo UPI ids.
UPDATE doctor_profiles d SET payout_method = 'UPI', upi_id = split_part(u.email, '@', 1) || '@upi'
FROM users u WHERE d.user_id = u.id AND u.email IN ('dr.sarah@vetconnect.com', 'dr.raj@vetconnect.com', 'dr.emily@vetconnect.com') AND d.payout_method IS NULL;

CREATE TABLE wallet_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference VARCHAR(60),
    payment_id BIGINT REFERENCES care_payments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_wallet_credit_payment ON wallet_transactions(payment_id) WHERE type = 'CREDIT' AND payment_id IS NOT NULL;
CREATE INDEX idx_wallet_user ON wallet_transactions(user_id, id DESC);

-- Advances that were already paid before wallets existed are credited too (and refunds debited).
INSERT INTO wallet_transactions (user_id, type, amount, currency, description, reference, payment_id, created_at)
SELECT d.user_id, 'CREDIT', p.amount, p.currency, 'Advance for vet visit ' || a.booking_reference, a.booking_reference, p.id, COALESCE(p.paid_at, p.created_at)
FROM care_payments p JOIN appointments a ON a.id = p.appointment_id JOIN doctor_profiles d ON d.id = a.doctor_id
WHERE p.status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');
INSERT INTO wallet_transactions (user_id, type, amount, currency, description, reference, payment_id, created_at)
SELECT pr.user_id, 'CREDIT', p.amount, p.currency, 'Advance for pet-care booking ' || b.reference, b.reference, p.id, COALESCE(p.paid_at, p.created_at)
FROM care_payments p JOIN care_bookings b ON b.id = p.booking_id JOIN provider_profiles pr ON pr.id = b.provider_id
WHERE p.status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');
INSERT INTO wallet_transactions (user_id, type, amount, currency, description, reference, payment_id, created_at)
SELECT d.user_id, 'DEBIT', p.refunded_amount, p.currency, 'Refund to customer for ' || a.booking_reference, a.booking_reference, p.id, COALESCE(p.refunded_at, p.created_at)
FROM care_payments p JOIN appointments a ON a.id = p.appointment_id JOIN doctor_profiles d ON d.id = a.doctor_id
WHERE p.refunded_amount > 0;
INSERT INTO wallet_transactions (user_id, type, amount, currency, description, reference, payment_id, created_at)
SELECT pr.user_id, 'DEBIT', p.refunded_amount, p.currency, 'Refund to customer for ' || b.reference, b.reference, p.id, COALESCE(p.refunded_at, p.created_at)
FROM care_payments p JOIN care_bookings b ON b.id = p.booking_id JOIN provider_profiles pr ON pr.id = b.provider_id
WHERE p.refunded_amount > 0;
