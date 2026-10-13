<div align="center">

# StoreSignal AI

### Agentic Retail Intelligence & Conversion Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Vitest](https://img.shields.io/badge/Tests-114_passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Built by [Gaurav Sahani](https://gauravsahani.codes/)**

*A full-stack, production-grade AI system that captures physical retail conversations, grounds every claim in verified product documentation, scores commercial intent deterministically, and enforces human approval before any follow-up reaches a customer.*

</div>

---

## What This Project Solves

Physical retail — automotive showrooms, luxury goods, real estate — has a fundamental data blindspot: **in-store conversations are invisible to digital systems**. When a customer walks out, their objections, questions, and intent signals are lost forever.

StoreSignal AI fixes this end-to-end:

| Problem | StoreSignal AI Solution |
|---|---|
| Conversations vanish when customers leave | Audio ingestion → STT → persistent transcript segments with stable IDs |
| Advisors misquote specs under pressure | RAG grounding guards reject any LLM claim not verbatim in the product docs |
| Managers can't coach advisors without data | Real-time signal extraction, aggregated objection analytics per store |
| Generic "Thanks for visiting!" follow-ups | Personalized drafts generated per shopper intent — but **zero dispatch without manager approval** |

---

## System Architecture

```
Physical Showroom Audio
         │
         ▼ Consent Check
 Ingestion & Segmentation Engine
         │ Stable Segment IDs [seg-0], [seg-1] ...
         ▼
    STT Engine (Groq Whisper / Mock)
         │
         ▼
 Multi-Agent Orchestrator
    ├──▶ pgvector RAG Retrieval  ──▶ FloorCoach Agent ──▶ Grounding Guard
    │         (cosine sim ≥ 0.40)        (fact-verified)       ├─ PASS → Validated Coaching
    │                                                           └─ FAIL → Abstention (no hallucination)
    │
    └──▶ SignalAnalyst Agent ──▶ Deterministic Intent Scorer (Rubric v1.0.0)
                                         │
                                         ▼
                              FollowUpOptimizer Agent
                                         │
                                         ▼
                              Governed Approval Queue
                              (Manager: Approve / Reject / Edit)
                                         │
                                         ▼
                              Immutable Audit Trail → Store Analytics
```

For entity-relationship diagrams, lifecycle state machines, and full trust boundary documentation, see [`docs/architecture.md`](docs/architecture.md).

---

## Key Engineering Highlights

### 1. Multi-Agent Orchestration with Partial Failure Semantics
Three specialized agents (FloorCoach, SignalAnalyst, FollowUpOptimizer) run in a coordinated pipeline with distributed conversation locking, explicit state machines (`PENDING → PROCESSING → COMPLETED`), and graceful partial failure handling. See [`apps/api/src/orchestration/`](apps/api/src/orchestration/).

### 2. RAG Grounding Guards — Zero Hallucination Architecture
After every LLM generation, post-generation code guards verify:
- Every quoted number exists verbatim in the retrieved pgvector chunks
- Source chunk ID sets are proper subsets of what was retrieved
- No numeric token in the response is ungrounded

If verification fails → **clean abstention** (the system says "I don't know" rather than fabricating a spec). See [`apps/api/src/agents/`](apps/api/src/agents/).

### 3. Deterministic Intent Scoring (Rubric v1.0.0)
The LLM extracts signals; a pure TypeScript rubric engine computes the score. Completely deterministic, unit-testable, and auditable — no hidden LLM judgment in the scoring pipeline. Cross-visit memory grants a `+8` continuity weight for repeat shoppers. See [`apps/api/src/scoring/`](apps/api/src/scoring/).

### 4. Multi-Tenant RBAC with GDPR/DPDP Compliance
- **Auth:** Native Node.js `scrypt` (OWASP-grade memory-hard, no `node-gyp` dependencies)
- **RBAC:** Role-gated endpoints for `store_manager`, `advisor`, and `admin`
- **Right to Erasure:** Database cascade deletes audio, transcripts, embeddings, and shopper profiles while generating a zero-PII audit hash — compliant with GDPR and India's DPDP Act 2023

### 5. Campaign Experimentation Engine
Deterministic SHA-256 variant bucketing + statistical significance testing (Wilson score confidence intervals, two-proportion z-tests) for A/B testing follow-up strategies without waiting for showroom foot traffic. See [`apps/api/src/experiments/`](apps/api/src/experiments/).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | Fastify 5, TypeScript 5.6, Node.js 22 |
| **Frontend** | React 18, Vite, TypeScript |
| **Database** | PostgreSQL 16 + `pgvector` (vector similarity search) |
| **LLM Gateway** | Groq (primary, ultra-fast LPU), OpenRouter, NVIDIA NIM — unified client with automatic fallback |
| **STT** | Groq Whisper API (live) / MockSTTProvider (hermetic tests) |
| **Embeddings** | OpenAI `text-embedding-3-small` (prod) / deterministic mock (tests) |
| **Testing** | Vitest, 114 tests across 13 suites |
| **Infrastructure** | Docker Compose (PostgreSQL + pgvector) |
| **Monorepo** | npm workspaces |

---

## Quick Start (≤ 5 Commands)

```bash
# 1. Clone the repository
git clone https://github.com/GauravSahani21/StoreSignal-ai.git && cd StoreSignal-ai

# 2. Configure environment
cp .env.example .env
# Add your Groq API key (free at console.groq.com) to GROQ_API_KEY=

# 3. Install monorepo dependencies
npm install

# 4. Spin up PostgreSQL with pgvector and seed demo showroom data
docker compose up -d postgres && npm run demo:seed

# 5. Launch API (:3001) + Web UI (:5173) in dev mode
npm run dev
```

- **Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- **API Health Check:** `curl http://localhost:3001/health`

---

## Guided Demo Tour (3–5 minutes)

Follow [`docs/demo-script.md`](docs/demo-script.md) to walk through the full platform:

1. **Retail Analytics** — Live aggregated metrics across 2 multi-tenant stores (Indiranagar & Koramangala): intent distribution, conversion rates, evidence-linked objection quotes
2. **Live Dialogue Studio** — Ingest a physical dialogue with consent checks, watch speaker normalization, trigger parallel agent execution with full execution traces
3. **Deliberate Knowledge Gap** — Submit a query for an uncataloged spec and verify FloorCoach **abstains cleanly** without hallucinating figures
4. **Governed Follow-Up Queue** — Review personalized WhatsApp drafts; confirm zero drafts can dispatch without explicit manager approval
5. **Unified Shopper Profile** — Cross-visit memory linking repeat shoppers with continuity intent bonus
6. **Campaign Simulator** — Run deterministic variant bucketing and significance testing live in-browser

---

## Test Coverage

```bash
npm test              # 114 unit + integration tests across 13 suites
npm run typecheck     # Strict TypeScript across all workspaces
npm run eval          # 22-case AI Evaluation Harness (100% pass rate)
npm run build         # Production build verification
```

| Test Suite | Tests | Coverage Area |
|---|---|---|
| `ai-routes.test.ts` | 14 | OpenRouter/Groq integration, error taxonomy |
| `auth-rbac.test.ts` | 7 | Scrypt hashing, token rotation, RBAC guards |
| `conversations.test.ts` | 8 | Ingestion, segmentation, consent enforcement |
| `rag.test.ts` | 7 | Structure-aware chunking, pgvector retrieval |
| `floor-coach.test.ts` | 6 | Grounding guards, quote containment, gap abstention |
| `signal-analyst.test.ts` | 7 | Signal extraction, deterministic intent rubric |
| `followup.test.ts` | 6 | Draft governance, approval state machine |
| `orchestrator.test.ts` | 7 | Multi-agent engine, locking, failure resilience |
| `shopper-profile.test.ts` | 7 | Cross-visit memory, GDPR erasure cascade |
| `analytics.test.ts` | 6 | Aggregation, CSV export |
| `experiments.test.ts` | 11 | SHA-256 bucketing, Wilson intervals, z-tests |
| `eval-harness.test.ts` | 5 | 22-case golden dataset evaluation gates |
| + others | ~21 | STT, scoring, auth flows |

---

## What's Production-Grade vs. Demo

### ✅ Production-Grade & Live in Code
- **Database:** 8 migration scripts — multi-tenancy, vector indexes, RBAC, full conversation lifecycle
- **Intent Scorer:** Fully implemented deterministic rubric engine with volume caps and cross-visit weights
- **Grounding Guards:** Active post-generation algorithmic verifiers (quote containment, source subset, numeric token validation)
- **Multi-Agent State Machine:** Real distributed locking, partial failure semantics, lifecycle management
- **Auth & RBAC:** scrypt hashing, constant-time verification, rotating refresh tokens, role-gated endpoints
- **GDPR / DPDP Right-to-Erasure:** Real cascade deletion generating zero-PII audit hashes
- **AI Eval Harness:** 22-case golden benchmark, 100% pass rate across all quality dimensions

### 🔶 Demo / Mock Adapters (swappable in one config line)
- **Embeddings:** Deterministic token-hash vector projector for offline test execution (swap: set `EMBEDDING_PROVIDER=openai`)
- **STT:** WhisperSTTProvider (live Groq) + MockSTTProvider (hermetic tests)
- **Outcome Simulator:** In-browser deterministic runner for A/B significance testing without real foot traffic

---

## Limitations & Honest Failure Analysis

1. **Strict Numeric Grounding Trade-Off:** The FloorCoach guard rejects any figure not in the RAG chunks — eliminates hallucinations, but also flags unscripted advisor discounts as ungrounded until officially cataloged
2. **Acoustic Overlap:** High ambient noise in busy showrooms requires directional mic arrays or lapel mics; single omnidirectional mics struggle with simultaneous speaker diarization
3. **Hinglish / Code-Mixed Speech:** Metropolitan Indian showrooms mix Hindi, Kannada, Tamil, and English. Groq Whisper handles it reasonably well; colloquial slang benefits from continuous prompt contextualization

---

## Future Roadmap

- **Streaming WebSocket STT:** Real-time low-latency transcription for live earbud whispering during active negotiations
- **Enterprise Messaging Adapters:** WhatsApp Business Cloud API, Gupshup, SendGrid (post-manager-approval dispatch)
- **Bidirectional CRM/POS Sync:** Webhooks for Salesforce Automotive Cloud, HubSpot, SAP Customer Experience
- **Contextual Multi-Armed Bandits:** Thompson Sampling for dynamic variant allocation based on shopper persona and intent score

---

## Project Structure

```
storesignal-ai/
├── apps/
│   ├── api/                    # Fastify 5 backend
│   │   └── src/
│   │       ├── agents/         # FloorCoach, SignalAnalyst, FollowUpOptimizer
│   │       ├── orchestration/  # Multi-agent engine, distributed locking
│   │       ├── rag/            # pgvector retrieval, chunking, embedding
│   │       ├── scoring/        # Deterministic intent rubric engine
│   │       ├── auth/           # scrypt, JWT, RBAC middleware
│   │       ├── analytics/      # Store metrics, CSV export
│   │       ├── experiments/    # A/B engine, statistical significance
│   │       ├── shoppers/       # Cross-visit profiles, GDPR erasure
│   │       ├── database/       # Migrations, seed scripts
│   │       ├── providers/      # LLM, STT, embedding provider adapters
│   │       └── tests/          # 114 tests across 13 suites
│   └── web/                    # React 18 + Vite dashboard
├── docs/
│   ├── architecture.md         # Full system architecture & ER diagrams
│   ├── demo-script.md          # Step-by-step 5-minute demo guide
│   ├── security.md             # Auth, RBAC, privacy controls
│   ├── adr/                    # 15 Architectural Decision Records
│   └── ...
├── docker-compose.yml          # PostgreSQL + pgvector setup
└── package.json                # npm workspaces monorepo root
```

---

## Author

**Gaurav Sahani**
[gauravsahani.codes](https://gauravsahani.codes/) · [GitHub](https://github.com/GauravSahani21)

---

## License

[MIT License](LICENSE)
