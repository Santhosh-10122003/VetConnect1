-- Certificates and licences that doctors and pet-care businesses upload so an admin can check them.
-- The file itself is kept on disk (vetconnect.uploads.dir); this row says whose it is and what it is.
CREATE TABLE verification_documents (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(10) NOT NULL,
    owner_id BIGINT NOT NULL,
    doc_type VARCHAR(30) NOT NULL,
    original_name VARCHAR(200) NOT NULL,
    stored_name VARCHAR(100) NOT NULL UNIQUE,
    content_type VARCHAR(50) NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_verification_documents_owner ON verification_documents(owner_type, owner_id);
