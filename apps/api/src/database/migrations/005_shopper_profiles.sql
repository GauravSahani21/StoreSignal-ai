-- Migration 005: Unified Shopper Profile and Cross-Visit Continuity
-- Tables for shopper-conversation linking with basis/authorizer, outcomes, and audit logs.

-- Conversation Shopper Links
CREATE TABLE IF NOT EXISTS conversation_shopper_links (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shopper_id VARCHAR(64) NOT NULL REFERENCES shoppers(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    basis VARCHAR(64) NOT NULL, -- 'explicit_customer_id', 'explicit_phone_hash', 'explicit_email_hash', 'anonymous_session'
    authorizer VARCHAR(64) NOT NULL, -- advisor user ID, 'customer_self_provided', 'system'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shopper_conv UNIQUE (org_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_shopper_links_shopper ON conversation_shopper_links(org_id, shopper_id);
CREATE INDEX IF NOT EXISTS idx_conv_shopper_links_conv ON conversation_shopper_links(org_id, conversation_id);

-- Outcomes Table (Manual and confirmed retail interaction outcomes)
CREATE TABLE IF NOT EXISTS outcomes (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shopper_id VARCHAR(64) REFERENCES shoppers(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE SET NULL,
    session_id VARCHAR(64),
    type VARCHAR(32) NOT NULL, -- 'purchase', 'missed_conversion', 'no_response'
    reason TEXT,
    value NUMERIC(12, 2),
    recorded_by VARCHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_org_shopper ON outcomes(org_id, shopper_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_org_conv ON outcomes(org_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_org_type ON outcomes(org_id, type);

/*
ROLLBACK NOTE:
DROP TABLE IF EXISTS outcomes CASCADE;
DROP TABLE IF EXISTS conversation_shopper_links CASCADE;
*/
