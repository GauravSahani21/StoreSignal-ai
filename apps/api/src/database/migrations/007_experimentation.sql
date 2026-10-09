-- Migration 007: Campaign Drafting & Honest Experimentation Platform
-- Stores experiments, variants, deterministic assignments, and real outcome events.

-- 1. Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    hypothesis TEXT NOT NULL,
    target_type VARCHAR(64) NOT NULL, -- 'followup_prompt', 'rubric_config', 'channel_strategy'
    status VARCHAR(32) NOT NULL DEFAULT 'draft', -- 'draft', 'running', 'paused', 'completed'
    eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    traffic_allocation_pct INT NOT NULL DEFAULT 100,
    min_sample_size INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_org_status ON experiments(org_id, status);

-- 2. Experiment Variants Table
CREATE TABLE IF NOT EXISTS experiment_variants (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    experiment_id VARCHAR(64) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL, -- 'control', 'variant_a', 'variant_b'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight INT NOT NULL DEFAULT 50, -- e.g. 50 vs 50
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_control BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(experiment_id, key)
);

CREATE INDEX IF NOT EXISTS idx_experiment_variants_exp ON experiment_variants(experiment_id);

-- 3. Deterministic Experiment Assignments Table
CREATE TABLE IF NOT EXISTS experiment_assignments (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    experiment_id VARCHAR(64) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id VARCHAR(64) NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL, -- 'shopper', 'conversation'
    entity_id VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, experiment_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_lookup ON experiment_assignments(org_id, experiment_id, entity_id);

-- 4. Experiment Events & Outcome Ingestion Table
CREATE TABLE IF NOT EXISTS experiment_events (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    experiment_id VARCHAR(64) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id VARCHAR(64) NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    assignment_id VARCHAR(64) REFERENCES experiment_assignments(id) ON DELETE SET NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- 'exposure', 'send', 'response', 'conversion', 'cost_recorded'
    value NUMERIC(12, 2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_events_exp_var ON experiment_events(experiment_id, variant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_experiment_events_org_created ON experiment_events(org_id, created_at);

/*
ROLLBACK NOTE:
DROP TABLE IF EXISTS experiment_events CASCADE;
DROP TABLE IF EXISTS experiment_assignments CASCADE;
DROP TABLE IF EXISTS experiment_variants CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
*/
