-- Migration 002: Retail Knowledge Base and pgvector RAG Schema
-- Rollback notes at bottom of file.

-- Enable pgvector extension if available
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not installed in current environment; falling back to array storage if needed';
END $$;

-- Knowledge Bases (Tenant-scoped collections of product/service documents)
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_org_id ON knowledge_bases(org_id);

-- Documents (Spec sheets, manuals, FAQs, price lists)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    knowledge_base_id VARCHAR(64) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(32) NOT NULL, -- 'pdf', 'docx', 'csv', 'xlsx', 'txt', 'md'
    size_bytes BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'indexed', 'failed'
    error_detail TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_org_kb ON documents(org_id, knowledge_base_id);

-- Document Chunks (Structured, location-tagged passages)
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    location_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { page, sheet, row, heading, section }
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_idx ON document_chunks(document_id, chunk_index);

-- Chunk Embeddings
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    id VARCHAR(64) PRIMARY KEY,
    chunk_id VARCHAR(64) NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding_model VARCHAR(128) NOT NULL,
    dimension INTEGER NOT NULL,
    embedding_vector JSONB NOT NULL, -- JSON array of floats for universal DB portability
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chunk_model UNIQUE (chunk_id, embedding_model)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk ON chunk_embeddings(chunk_id);

-- Retrieval Events (Traceable log of all product knowledge queries)
CREATE TABLE IF NOT EXISTS retrieval_events (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_run_id VARCHAR(64),
    query TEXT NOT NULL,
    results JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ chunkId, score, source }]
    status VARCHAR(32) NOT NULL, -- 'ok', 'empty', 'failed'
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retrieval_org_status ON retrieval_events(org_id, status);

/*
ROLLBACK NOTE:
DROP TABLE IF EXISTS retrieval_events CASCADE;
DROP TABLE IF EXISTS chunk_embeddings CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS knowledge_bases CASCADE;
*/
