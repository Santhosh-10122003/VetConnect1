-- Flyway Migration V2: Seed Data for Specializations and Initial Settings

INSERT INTO specializations (name, description, icon_name) VALUES
('General Veterinary Care', 'Routine check-ups, wellness exams, vaccinations, and preventive healthcare.', 'paw'),
('Small Animal Dermatology', 'Diagnosis and treatment of skin, coat, and ear conditions in pets.', 'shield-alert'),
('Veterinary Dentistry', 'Dental exams, cleanings, tooth extractions, and oral health care.', 'tooth'),
('Soft Tissue & Orthopedic Surgery', 'Surgical procedures including spay/neuter, mass removal, and orthopedic care.', 'scissors'),
('Exotic & Avian Care', 'Specialized medicine and healthcare for birds, reptiles, rabbits, and small mammals.', 'feather'),
('Cardiology & Internal Medicine', 'Heart disease management, diagnostic ultrasound, and chronic illness care.', 'heart-pulse'),
('Ophthalmology', 'Comprehensive eye examinations, corneal treatments, and vision care.', 'eye')
ON CONFLICT (name) DO NOTHING;
