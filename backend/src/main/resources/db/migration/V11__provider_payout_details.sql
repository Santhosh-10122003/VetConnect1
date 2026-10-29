-- Where a pet-care business gets paid. Mandatory for every business and every clinic that offers pet care;
-- until they are filled in the provider is not shown to customers and cannot be approved.
ALTER TABLE provider_profiles ADD COLUMN payout_method VARCHAR(10);
ALTER TABLE provider_profiles ADD COLUMN upi_id VARCHAR(100);
ALTER TABLE provider_profiles ADD COLUMN account_holder_name VARCHAR(100);
ALTER TABLE provider_profiles ADD COLUMN bank_account_number VARCHAR(30);
ALTER TABLE provider_profiles ADD COLUMN ifsc_code VARCHAR(15);
ALTER TABLE provider_profiles ADD COLUMN bank_name VARCHAR(100);

-- The demo businesses get demo details so the sample data keeps working.
UPDATE provider_profiles SET payout_method = 'UPI', upi_id = 'happypaws@upi' WHERE business_name = 'Happy Paws Grooming' AND payout_method IS NULL;
UPDATE provider_profiles SET payout_method = 'UPI', upi_id = 'cozytails@upi' WHERE business_name = 'Cozy Tails Boarding & Training' AND payout_method IS NULL;
UPDATE provider_profiles SET payout_method = 'UPI', upi_id = 'pawsandclaws@upi' WHERE business_name = 'Paws & Claws Pet Spa' AND payout_method IS NULL;
