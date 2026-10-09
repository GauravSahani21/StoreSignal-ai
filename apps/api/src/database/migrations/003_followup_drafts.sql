-- Migration 003: Follow-Up Drafts, Approvals, and Workflow Events
-- Rollback notes at bottom of file.

-- Follow-Up Drafts
CREATE TABLE IF NOT EXISTS follow_up_drafts (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    channel VARCHAR(32) NOT NULL, -- 'email', 'sms', 'whatsapp', 'call_task', 'none'
    subject TEXT,
    message TEXT,
    facts_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_action TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'rejected'
    requires_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
    blocked_reason VARCHAR(64), -- 'no_consent', 'no_contact_channel', 'insufficient_evidence', 'opted_out'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_org_conv ON follow_up_drafts(org_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_drafts_org_status ON follow_up_drafts(org_id, status);

-- Human Approval Records
CREATE TABLE IF NOT EXISTS approval_records (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    draft_id VARCHAR(64) NOT NULL REFERENCES follow_up_drafts(id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL, -- 'approved', 'rejected'
    reviewer_id VARCHAR(64) NOT NULL,
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_org_draft ON approval_records(org_id, draft_id);

-- Workflow & Lifecycle Events
CREATE TABLE IF NOT EXISTS workflow_events (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- 'FOLLOW_UP_DRAFTED', 'FOLLOW_UP_APPROVED', 'FOLLOW_UP_REJECTED'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_org_conv ON workflow_events(org_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_type ON workflow_events(event_type);

-- Rollback instructions:
-- DROP TABLE IF EXISTS workflow_events;
-- DROP TABLE IF EXISTS approval_records;
-- DROP TABLE IF EXISTS follow_up_drafts;
