# ADR 001: Monorepo Structure and Technology Foundation

## Status
Accepted

## Context
StoreSignal AI requires a portfolio-grade, production-minded architecture combining a responsive React web frontend, a strict high-performance Fastify backend, and future centralized modules for AI orchestration, database persistence, RAG knowledge retrieval, and evaluation harnesses.

## Decision
1. **Repository Layout:** Use npm workspaces with `apps/api` (Fastify + TypeScript + Pino + Zod) and `apps/web` (React 18 + Vite + Tailwind CSS + TypeScript).
2. **Backend Framework:** Fastify over Express for native schema-based validation speed, modern TypeScript types, async plugin lifecycle, and lightweight overhead.
3. **Configuration & Secrets:** Zod-based fail-fast configuration loader (`apps/api/src/config/env.ts`) that guarantees secrets (database passwords, API keys) never leak in error messages, logs, or API payloads.
4. **Error Handling:** Centralized typed error hierarchy inheriting from `AppError`, mapped to a standard `{ error: { code, message, requestId } }` envelope.
5. **Database Strategy:** PostgreSQL with the `pgvector/pgvector:pg16` image via Docker Compose, parameterized queries with connection pooling, and tenant isolation by `org_id`.

## Consequences
- Fastify server can be unit/integration tested cleanly using `.inject()` without opening network ports.
- Web app and API maintain separate build pipelines and type definitions while sharing common repo commands (`npm run dev`, `npm run build`, `npm run test`, `npm run typecheck`).
- Strict TypeScript (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`) prevents common bugs across all packages.
