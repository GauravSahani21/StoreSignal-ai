-- Migration 001: Core Entities Schema
-- Forward migration for organizations, stores, products, shoppers, sessions, consents, conversations, and transcripts.
-- Rollback notes at bottom of file.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (Multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stores (Physical retail locations)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_org_id ON stores(org_id);

-- Users & Memberships
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'advisor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(org_id, email);

-- Products (Retail catalogue with attributes and demo flag)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price_min NUMERIC(12, 2) NOT NULL,
    price_max NUMERIC(12, 2) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_org_sku UNIQUE (org_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(org_id, category);

-- Shoppers (Persistent shopper entity, strictly consented or anonymous)
CREATE TABLE IF NOT EXISTS shoppers (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    external_customer_id VARCHAR(128),
    contact_hash VARCHAR(128),
    anonymous_id VARCHAR(64) NOT NULL,
    consent_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shoppers_org_anon ON shoppers(org_id, anonymous_id);
CREATE INDEX IF NOT EXISTS idx_shoppers_contact_hash ON shoppers(org_id, contact_hash);

-- Interaction Sessions (Visits to showroom)
CREATE TABLE IF NOT EXISTS interaction_sessions (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shopper_id VARCHAR(64) REFERENCES shoppers(id) ON DELETE SET NULL,
    store_id VARCHAR(64) REFERENCES stores(id) ON DELETE RESTRICT,
    advisor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_org_shopper ON interaction_sessions(org_id, shopper_id);

-- Consent Records (Verifiable consent audit trail)
CREATE TABLE IF NOT EXISTS consent_records (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    scope VARCHAR(64) NOT NULL, -- 'audio_recording', 'transcript_processing', 'follow_up_contact'
    method VARCHAR(32) NOT NULL, -- 'verbal', 'written', 'digital'
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    evidence_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_org_subject ON consent_records(org_id, subject, scope);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id VARCHAR(64) REFERENCES interaction_sessions(id) ON DELETE SET NULL,
    source VARCHAR(32) NOT NULL, -- 'transcript_import', 'audio_upload', 'mic_recording'
    language VARCHAR(16) NOT NULL DEFAULT 'en',
    status VARCHAR(32) NOT NULL DEFAULT 'ingested', -- 'ingested', 'processing', 'completed', 'failed'
    retention_until TIMESTAMPTZ,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON conversations(org_id, status);

-- Audio Files (Metadata only; zero storage of raw audio in database)
CREATE TABLE IF NOT EXISTS audio_files (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    storage_ref VARCHAR(255) NOT NULL,
    duration_ms INTEGER,
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_conv_id ON audio_files(conversation_id);

-- Transcripts (Versioned)
CREATE TABLE IF NOT EXISTS transcripts (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transcript_conv_ver UNIQUE (conversation_id, version)
);
CREATE INDEX IF NOT EXISTS idx_transcripts_conv ON transcripts(conversation_id);

-- Transcript Segments (Stable IDs for immutable evidence linking)
CREATE TABLE IF NOT EXISTS transcript_segments (
    id VARCHAR(64) PRIMARY KEY,
    transcript_id VARCHAR(64) NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    speaker VARCHAR(32) NOT NULL, -- 'advisor', 'customer', 'unknown'
    start_ms INTEGER,
    end_ms INTEGER,
    text TEXT NOT NULL,
    language VARCHAR(16),
    confidence NUMERIC(4, 3)
);
CREATE INDEX IF NOT EXISTS idx_segments_transcript_idx ON transcript_segments(transcript_id, index);

-- Store Events (Append-only unified event stream)
CREATE TABLE IF NOT EXISTS store_events (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_id VARCHAR(64),
    session_id VARCHAR(64),
    shopper_id VARCHAR(64),
    conversation_id VARCHAR(64),
    type VARCHAR(64) NOT NULL, -- 'WALK_IN', 'PRODUCT_QUESTION', 'OBJECTION_DETECTED', etc.
    source VARCHAR(32) NOT NULL, -- 'agent', 'manual', 'csv_import', 'system'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_org_type ON store_events(org_id, type);
CREATE INDEX IF NOT EXISTS idx_events_org_session ON store_events(org_id, session_id);

-- Audit Logs (Tamper-evident operations trail with zero sensitive content)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_action ON audit_logs(org_id, action);

/*
ROLLBACK NOTE:
To cleanly revert Migration 001:
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS store_events CASCADE;
DROP TABLE IF EXISTS transcript_segments CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS audio_files CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS consent_records CASCADE;
DROP TABLE IF EXISTS interaction_sessions CASCADE;
DROP TABLE IF EXISTS shoppers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
*/
