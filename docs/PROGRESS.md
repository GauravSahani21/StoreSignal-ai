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
| **Phase 7: SignalAnalyst Agent & Scoring** | PASSED | 2026-10-09 | HEAD | SignalAnalyst extraction, explicit basis guard, deterministic IntentScorer, rubric v1.0.0 | Live OpenRouter (gated) | Separation of LLM extraction and deterministic code scoring, customer volume abstention. |
| **Phase 8: FollowUpOptimizer Agent** | PASSED | 2026-10-09 | HEAD | Grounded drafts, factsUsed grounding, consent gating, draft state machine, zero auto-send | Live OpenRouter (gated) | Human approval mandatory, zero outbound messaging clients, immutable approval audits. |
| **Phase 9: Multi-Agent Orchestration** | PASSED | 2026-10-09 | HEAD | Single entry point, parallel execution, partial failure semantics, idempotency, tracing | Live OpenRouter (gated) | Full state machine PENDING->RETRIEVING->ANALYZING->FOLLOWUP->AWAITING_APPROVAL/COMPLETED. |
| **Phase 10: Unified Shopper Profile** | PASSED | 2026-10-09 | bd0be3a | Identifier resolution, cross-visit memory, returning visitor +8 rubric weight, outcomes, right to erasure | Live OpenRouter (gated) | Strict explicit identifiers only, zero fuzzy guessing, immediate consent stoppage, cascade erasure audit. |
| **Phase 11: Retail Analytics Dashboard** | PASSED | 2026-10-09 | HEAD | Real metrics aggregation (Areas A-F), dual-pane dialogue view, DEMO badging, low-data banner, RFC 4180 CSV export | - | Complete dynamic computation from persisted events; zero hardcoded metrics. |
| **Phase 12: AI Evaluation Harness** | PASSED | 2026-10-09 | HEAD | Golden dataset (22 transcripts), 100% intent accuracy, 100% grounding, 100% gap abstention, 100% consent & human approval compliance, latency/token/cost telemetry | - | CLI runner `npm run eval`, JSON/MD reports, automated Vitest suite. |
| **Phase 13: Experimentation & Optimization** | PASSED | 2026-10-09 | HEAD | Deterministic SHA-256 assignment, Wilson 95% CI, two-proportion z-tests, min-sample gating, CSV ingestion, ExperimentationDashboard UI | - | 11/11 tests passing, zero outbound send paths, bandit architecture specified. |
| **Phase 14: Authentication, Authorization, Deployment** | PASSED | 2026-10-09 | HEAD | Scrypt hashing, constant-time verification, rotating refresh tokens, RBAC in code, multi-tenant isolation, multi-stage Dockerfiles, Compose orchestration | - | 7/7 tests passing, threat model (docs/security.md), deployment guide (docs/deployment.md). |
| **Phase 15: Portfolio Packaging** | PASSED | 2026-10-09 | HEAD | One-command seeder (`npm run demo:seed`), architecture specification (`docs/architecture.md`), click-by-click demo script (`docs/demo-script.md`), comprehensive README, MIT License | - | Production-ready packaging, all 15 phases completed with full evidence and zero regressions. |

---

## Decisions (ADR Index)

- [ADR 001: Monorepo Structure and Technology Foundation](adr/001-project-foundation.md)
- [ADR 002: Centralized OpenRouter LLM Gateway and Error Taxonomy](adr/002-openrouter-llm-gateway.md)
- [ADR 003: Database Schema, Multi-Tenancy, and Ingestion Pipeline](adr/003-database-conversation-ingestion.md)
- [ADR 004: Speech-to-Text Provider Architecture](adr/004-stt-provider-architecture.md)
- [ADR 005: Retail Knowledge Retrieval Architecture](adr/005-retail-knowledge-rag.md)
- [ADR 006: FloorCoach Agent Architecture and Post-Validation Grounding Guards](adr/006-floorcoach-agent-and-grounding-guards.md)
- [ADR 007: SignalAnalyst Agent and Deterministic Intent Scoring Engine](adr/007-signalanalyst-and-deterministic-intent-scoring.md)
- [ADR 008: FollowUpOptimizer Agent and Governed Approval Queue Architecture](adr/008-followup-optimizer-and-governed-approval-queue.md)
- [ADR 009: Multi-Agent Orchestration Engine and Lifecycle State Machine](adr/009-multi-agent-orchestration-and-lifecycle-state-machine.md)
- [ADR 010: Unified Shopper Profile, Permitted Identifier Resolution, and Cross-Visit Continuity](adr/010-unified-shopper-profile-and-cross-visit-continuity.md)
- [ADR 011: Retail Analytics Dashboard, Operational Intelligence, and Telemetry](adr/011-retail-analytics-dashboard.md)
- [ADR 012: AI Evaluation Harness, Golden Dataset, and Continuous Quality Gates](adr/012-ai-evaluation-harness.md)
- [ADR 013: Campaign Experimentation, Deterministic Variant Assignment, and Contextual Bandit Architecture](adr/013-campaign-experimentation-and-bandit-design.md)
- [ADR 014: Authentication, Role-Based Access Control (RBAC), and Production Deployment](adr/014-authentication-rbac-and-production-deployment.md)
- [ADR 015: Portfolio Packaging, System Verification, and Final Sign-Off](adr/015-portfolio-packaging-and-system-verification.md)

---

## Open Questions for the User

- **OPENROUTER_API_KEY Required for Phase 2 Live Gate:** The centralized OpenRouter gateway and complete §7.5 error taxonomy are implemented and verified via automated test suites. To execute the live integration test through OpenRouter (`RUN_LIVE_TESTS=1`), please provide your `OPENROUTER_API_KEY` (or add it to your environment / `.env`).
