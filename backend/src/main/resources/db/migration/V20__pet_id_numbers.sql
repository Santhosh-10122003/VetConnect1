-- Every pet gets a unique 15-digit ID number (shown as its microchip number) that the app creates itself.
-- First tidy what is there: blanks become empty, and a number typed in twice keeps only its first pet.
UPDATE pets SET microchip_number = NULL WHERE microchip_number IS NOT NULL AND btrim(microchip_number) = '';
UPDATE pets SET microchip_number = NULL WHERE id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY microchip_number ORDER BY id) AS rn
        FROM pets WHERE microchip_number IS NOT NULL
    ) t WHERE t.rn > 1
);
-- then give every pet without one a random number (999 + 12 random digits)
UPDATE pets SET microchip_number = '999' || lpad((floor(random() * 1000000000000))::bigint::text, 12, '0')
WHERE microchip_number IS NULL;
CREATE UNIQUE INDEX uq_pets_microchip_number ON pets(microchip_number) WHERE microchip_number IS NOT NULL;
