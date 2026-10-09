-- Migration 006: Retail Analytics Dashboard and AI Usage Events
-- Tables and indexes for usage metrics, AI token accounting, and store analytics aggregations.

-- Usage Events Table (Per-agent LLM/embedding execution tracking)
CREATE TABLE IF NOT EXISTS usage_events (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE SET NULL,
    workflow_run_id VARCHAR(64) REFERENCES workflow_runs(id) ON DELETE SET NULL,
    agent VARCHAR(64) NOT NULL, -- 'floor_coach', 'signal_analyst', 'followup_optimizer', 'retrieval', 'stt'
    model VARCHAR(128) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org_created ON usage_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_agent ON usage_events(org_id, agent);
CREATE INDEX IF NOT EXISTS idx_usage_events_conv ON usage_events(conversation_id);

-- Additional indexes on conversations and store_events for analytics queries
CREATE INDEX IF NOT EXISTS idx_conversations_org_store_created ON conversations(org_id, store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_org_is_demo ON conversations(org_id, is_demo);
CREATE INDEX IF NOT EXISTS idx_store_events_org_type ON store_events(org_id, type);
CREATE INDEX IF NOT EXISTS idx_store_events_org_store ON store_events(org_id, store_id);

/*
ROLLBACK NOTE:
DROP TABLE IF EXISTS usage_events CASCADE;
*/
