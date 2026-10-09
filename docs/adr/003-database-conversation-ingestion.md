# ADR 003: Core Data Architecture, Multi-Tenant Repositories, and Mandatory Consent

## Status
Accepted

## Context
StoreSignal AI processes sensitive showroom conversations. The platform must enforce strict tenant isolation, immutable segment referencing for evidence citation, and privacy-first consent enforcement where no dialogue may be ingested without an explicit consent record.

## Decision
1. **Multi-Tenant Scoping by org_id:** All database tables and repository operations require and filter on `org_id`. Cross-tenant data leakage is prevented at the repository layer.
2. **Stable Transcript Segments:** Dialogues are parsed by `segmentTranscript` into structured segments with deterministic hashes (`seg-{version}-{index}-{hash}`). Evidence references in all downstream agents cite these stable IDs, preserving traceability even across revisions.
3. **Mandatory Consent Ingestion Gate:** The `POST /api/conversations` endpoint strictly rejects requests without explicit consent attestation (`hasConsent: true`), automatically generating a verifiable `consent_records` entry.
4. **Data Model & Migrations:** Forward-only SQL migrations (`001_core_schema.sql`) define UUID primary keys, relational constraints, jsonb attribute storage, and documented rollback strategies.
5. **Seeded Catalogue (Appendix D):** A fictional automotive brand ("Vayu Motors") is created with 6 distinct products across commuter, mid-range, touring, EV scooter, and premium categories, explicitly flagged `is_demo: true`.

## Consequences
- Every conversation is safely isolated to its organization.
- Downstream agents (FloorCoach, SignalAnalyst, FollowUpOptimizer) can rely on immutable transcript segment IDs.
- Seeding is idempotent and safe for repeated executions.
