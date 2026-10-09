# StoreSignal AI
### Agentic Retail Intelligence & Conversion Platform

StoreSignal AI turns authorized in-store customer conversations and interaction signals into structured sales intelligence, staff coaching, unified shopper profiles, and approval-gated personalized follow-ups.

---

## Quick Start (Phase 1 Foundation)

### Prerequisites
- Node.js ≥ 20 (Node 22 LTS recommended)
- Docker & Docker Compose (for PostgreSQL + pgvector)

### Setup & Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL with pgvector:**
   ```bash
   docker compose up -d postgres
   ```

4. **Verify tests and typecheck:**
   ```bash
   npm run typecheck
   npm run test
   ```

5. **Start development services:**
   ```bash
   # Starts both Fastify API (:3001) and Vite Web (:5173)
   npm run dev
   ```

### Verification
- **API Health Check:** `curl http://localhost:3001/health`
- **Web App:** Open `http://localhost:5173` in your browser

---

## Operating Principles
1. **Evidence-First:** Every signal, question, and objection is linked to stable transcript segments.
2. **Grounded Product Facts:** Product specs and pricing are cited exclusively from verified knowledge chunks.
3. **Abstention by Design:** Insufficient evidence produces clear abstention, never hallucinated figures.
4. **Human in the Loop:** Generated follow-up actions remain strictly editable drafts requiring explicit approval.
5. **Privacy First:** Mandatory consent for audio/transcript processing, strict tenant isolation, and zero secret leakage.
