-- A blank license number was accepted once (the field is optional in the app) and blocks every later blank one.
UPDATE doctor_profiles SET license_number = 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8)) WHERE TRIM(license_number) = '';
