-- ===============================================================
-- Pet care: grooming, boarding and training providers
-- ===============================================================

CREATE TABLE provider_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(150) NOT NULL,
    description TEXT,
    phone VARCHAR(30),
    registration_number VARCHAR(100),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- how many pets can be handled at the same time (grooming / training) and overnight (boarding)
    concurrent_capacity INT NOT NULL DEFAULT 1,
    boarding_capacity INT NOT NULL DEFAULT 0,
    slot_minutes INT NOT NULL DEFAULT 30,
    -- share of the price the customer pays up front to book
    advance_percent INT NOT NULL DEFAULT 30,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    verification_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resubmitted_at TIMESTAMP WITH TIME ZONE,
    resubmit_note TEXT,
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    review_count INT NOT NULL DEFAULT 0,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_provider_advance CHECK (advance_percent BETWEEN 10 AND 100),
    CONSTRAINT chk_provider_capacity CHECK (concurrent_capacity BETWEEN 1 AND 50 AND boarding_capacity BETWEEN 0 AND 500)
);
CREATE INDEX idx_provider_city ON provider_profiles(LOWER(city));
CREATE INDEX idx_provider_status ON provider_profiles(verification_status);

CREATE TABLE provider_categories (
    provider_id BIGINT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    PRIMARY KEY (provider_id, category)
);

CREATE TABLE provider_hours (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_provider_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT uq_provider_day UNIQUE (provider_id, day_of_week)
);

-- A menu entry: a service (bath, boarding, obedience class...) or an add-on to one.
CREATE TABLE care_services (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    pricing_unit VARCHAR(20) NOT NULL DEFAULT 'PER_SESSION',
    duration_minutes INT,
    price_small NUMERIC(10, 2) NOT NULL,
    price_medium NUMERIC(10, 2) NOT NULL,
    price_large NUMERIC(10, 2) NOT NULL,
    price_giant NUMERIC(10, 2) NOT NULL,
    is_addon BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_care_prices CHECK (price_small >= 0 AND price_medium >= 0 AND price_large >= 0 AND price_giant >= 0)
);
CREATE INDEX idx_care_services_provider ON care_services(provider_id);

CREATE TABLE care_bookings (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(30) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
    provider_id BIGINT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    pet_size VARCHAR(10) NOT NULL,
    -- grooming / training: the day and time; boarding: check-in date (no times)
    booking_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    check_out_date DATE,
    nights INT,
    notes TEXT,
    total_amount NUMERIC(10, 2) NOT NULL,
    advance_amount NUMERIC(10, 2) NOT NULL,
    balance_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(30) NOT NULL,
    -- an unpaid booking holds its slot only until this moment
    expires_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_care_bookings_provider_date ON care_bookings(provider_id, booking_date);
CREATE INDEX idx_care_bookings_customer ON care_bookings(customer_id);
CREATE INDEX idx_care_bookings_status ON care_bookings(status);

-- What was ordered, with the price at that moment (later menu edits do not change old bookings).
CREATE TABLE care_booking_items (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES care_bookings(id) ON DELETE CASCADE,
    service_id BIGINT REFERENCES care_services(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_care_items_booking ON care_booking_items(booking_id);

CREATE TABLE care_payments (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES care_bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(30) NOT NULL,
    gateway VARCHAR(30) NOT NULL,
    gateway_order_id VARCHAR(100),
    gateway_payment_id VARCHAR(100),
    refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_care_payments_booking ON care_payments(booking_id);

CREATE TABLE care_reviews (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE REFERENCES care_bookings(id) ON DELETE CASCADE,
    provider_id BIGINT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_care_reviews_provider ON care_reviews(provider_id);
