-- Migration 004: Multi-Agent Workflow Orchestration Runs
-- Rollback notes at bottom of file.

CREATE TABLE IF NOT EXISTS workflow_runs (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING', 
    -- 'PENDING', 'RETRIEVING', 'ANALYZING', 'FOLLOWUP_PLANNING', 'AWAITING_APPROVAL', 'COMPLETED', 'PARTIAL', 'FAILED'
    step_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_detail TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_conv ON workflow_runs(org_id, conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_idempotency ON workflow_runs(org_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_state ON workflow_runs(org_id, state);

-- Rollback instructions:
-- DROP TABLE IF EXISTS workflow_runs;
