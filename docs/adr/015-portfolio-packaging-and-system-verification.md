# ADR 015: Portfolio Packaging, System Verification, and Final Sign-Off

## Status
Accepted

## Context
Across Phases 1 through 14, StoreSignal AI was engineered phase by phase in strict compliance with the Master Prompt Operating Contract (§0.1–§0.6, §20.2). Each phase established verifiable architectural components:
1. Monorepo foundation with Fastify 5, React 18, and pgvector PostgreSQL.
2. Centralized OpenRouter gateway with strict §7.5 error taxonomy.
3. Database persistence with stable conversation segmentation and mandatory customer consent.
4. Extensible STT provider abstraction with versioned edits and Right to Erasure cascade.
5. Structure-aware RAG with pgvector embeddings, cosine similarity thresholds, and deliberate knowledge gaps.
6. FloorCoach agent with post-generation grounding guards (quote containment, numeric grounding, gap abstention).
7. SignalAnalyst agent with deterministic code-based Intent Scoring (v1.0.0 rubric).
8. FollowUpOptimizer agent with strict draft governance, facts-used verification, and zero automated send paths.
9. Multi-agent orchestration engine with parallel execution, partial failure semantics, distributed locking, and lifecycle state machines.
10. Unified shopper profile with permitted identifier resolution, cross-visit memory (+8 rubric weight), immediate consent stoppage, and GDPR/DPDP deletion cascades.
11. Retail analytics dashboard with live persisted metric aggregations across Areas A–F and RFC 4180 CSV export.
12. Comprehensive AI evaluation harness with 22 golden cases, 100% quality gate compliance, and automated cost/latency telemetry.
13. Campaign experimentation engine with deterministic SHA-256 variant assignment, 95% Wilson score intervals, and two-proportion z-tests.
14. Authentication and RBAC with native scrypt password hashing, constant-time verification, rotating refresh tokens, multi-tenant isolation, and multi-stage Docker deployment.

Phase 15 requires consolidating the platform into a production-grade, portfolio-ready repository with comprehensive documentation, seamless one-command demonstration setup, and complete verification evidence.

## Decision
1. **One-Command Demo Seeder (`npm run demo:seed`):**
   - Provide an idempotent database seeding script (`apps/api/src/scripts/seed.ts`) that initializes two realistic vehicle retail dealerships (`store-indiranagar-01` and `store-koramangala-02`), test advisors, knowledge manual chunks, live conversation dialogues, unified shopper profiles, follow-up drafts, and experimentation campaigns.
2. **System Architecture Specification (`docs/architecture.md`):**
   - Formalize the system topology, multi-agent orchestration flowchart, lifecycle state machine, entity-relationship data model, and security trust boundaries with Mermaid diagrams.
3. **Click-by-Click Demonstration Script (`docs/demo-script.md`):**
   - Provide an exact 3–5 minute evaluative walkthrough covering showroom ingestion, deliberate gap abstention, cross-visit shopper memory, draft human approval, analytics drill-down, and experimentation variant simulation.
4. **Honest "Real vs. Demo" Transparency & Limitation Disclosure:**
   - Clearly delineate production-grade implementations (database schemas, deterministic intent scoring, grounding validation guards, RBAC, evaluation harness) from demonstration adapters (synthetic mock embeddings, simulated customer outcome conversions, mock STT for non-Whisper runs).
5. **Master Root Documentation (`README.md`):**
   - Restructure the repository `README.md` into an executive- and engineering-grade presentation featuring high-level architecture diagrams, $\le 5$ command quickstart, guided tour, technical trade-offs, limitations, and future roadmap.

## Consequences
### Positive
- Fully reproducible platform that can be demonstrated and audited end-to-end in under 5 minutes.
- Explicit transparency regarding AI guardrails, abstentions, and human-in-the-loop governance.
- Production readiness proven through 114 passing unit/integration tests and 22 golden evaluation benchmarks.

### Negative / Trade-offs
- The live evaluation suite requires OpenRouter API credentials to benchmark external frontier models; in offline mode, deterministic mock/test providers validate the guardrail logic.
- Physical audio devices require Web Audio API or hardware microphones; showroom demonstrations utilize simulated microphone recordings and text transcripts.
