# StoreSignal AI - Progress Ledger

This document tracks the verified completion of each phase in accordance with the StoreSignal AI Operating Contract (§0.1 - §0.6, §20.2).

## Phase Progress Table

| Phase | Status | Date | Commit | Live-verified items | NOT RUN items | Notes |
|---|---|---|---|---|---|---|
| **Phase 1: Project Foundation** | PASSED | 2026-10-09 | bad5d28 | Fastify server, /health endpoint, Zod config validation, safe error envelopes, React+Vite build, Postgres docker compose | Live external DB calls (schema deferred to Phase 3) | Strict TypeScript, zero leaked secrets, health route returns 200 with no secrets. |
| **Phase 2: OpenRouter Connection** | BLOCKED | 2026-10-09 | dd19b0e | - | Live OpenRouter verification | Centralized AIProvider, error taxonomy, timeouts, and mocked unit/integration tests passed (25/25). Awaiting OPENROUTER_API_KEY for live gate. |
| **Phase 3: Database & Conversation Ingestion** | PASSED | 2026-10-09 | 35a094b | Repositories, segmentation, consent enforcement, seeding | - | Full schema, org_id tenant isolation, stable segment IDs, idempotent seed. |
| **Phase 4: Speech-to-Text** | PASSED | 2026-10-09 | a306afc | Audio ingestion, Mock & Whisper STT, versioned edit, right to erasure | Live Whisper API (gated) | Consent required, content validation, size limits, Hinglish evaluation documented. |
| **Phase 5: Retail Knowledge Retrieval (RAG)** | PASSED | 2026-10-09 | da5232e | Structure-aware chunking, semantic retrieval, deliberate gaps | - | High retrieval hit-rate, traceable sources, abstention on gaps verified. |
| **Phase 6: FloorCoach Agent** | PASSED | 2026-10-09 | 611cc8e | Grounding guards, RAG citations, gap abstention, repair loop | Live OpenRouter (gated) | Grounding guards enforced in code; unverified gaps move to unresolved without invented numbers. |
| **Phase 7: SignalAnalyst Agent & Scoring** | IN PROGRESS | 2026-10-09 | - | - | - | Shopper intelligence, explicit vs inferred, deterministic intent rubric engine. |
| **Phase 8: FollowUpOptimizer Agent** | NOT STARTED | - | - | - | - | Draft generation, grounding guards, human approval gate, zero auto-send. |
| **Phase 9: Multi-Agent Orchestration** | NOT STARTED | - | - | - | - | State machine, parallel execution, retries, idempotency, event tracing. |
| **Phase 10: Unified Shopper Profile** | NOT STARTED | - | - | - | - | Cross-visit continuity, permitted identifiers, deletion/retention, outcome tracking. |
| **Phase 11: Retail Analytics Dashboard** | NOT STARTED | - | - | - | - | Real data views, conversation workspace, metrics aggregation, DEMO badging. |
| **Phase 12: AI Evaluation Harness** | NOT STARTED | - | - | - | - | Golden dataset (≥20 transcripts), accuracy, abstention, latency, cost metrics. |
| **Phase 13: Experimentation & Optimization** | NOT STARTED | - | - | - | - | Experiment variants, deterministic assignment, statistical checks with warnings. |
| **Phase 14: Authentication, Authorization, Deployment** | NOT STARTED | - | - | - | - | RBAC, tenant isolation, production Docker, security audit. |
| **Phase 15: Portfolio Packaging** | NOT STARTED | - | - | - | - | Polished README, architecture docs, demo script, verification checklist. |

---

## Decisions (ADR Index)

- [ADR 001: Monorepo Structure and Technology Foundation](adr/001-project-foundation.md)
- [ADR 002: Centralized OpenRouter LLM Gateway and Error Taxonomy](adr/002-openrouter-llm-gateway.md)

---

## Open Questions for the User

- **OPENROUTER_API_KEY Required for Phase 2 Live Gate:** The centralized OpenRouter gateway and complete §7.5 error taxonomy are implemented and verified via automated test suites. To execute the live integration test through OpenRouter (`RUN_LIVE_TESTS=1`), please provide your `OPENROUTER_API_KEY` (or add it to your environment / `.env`).
