# ADR 010: Unified Shopper Profile, Permitted Identifier Resolution, and Cross-Visit Continuity

## Status
Accepted

## Context
In physical retail environments, shoppers return across multiple days or weeks. However, customer identity and privacy must adhere strictly to compliance regimes (DPDP / GDPR) and avoid unethical tracking:
1. **Strict Prohibition on Fuzzy Guessing (§10.1):** Profile merging across visits must NEVER rely on probabilistic or heuristic guessing (such as acoustic voice matching, apparel description, or speculative timing). Only explicit customer IDs, consented phone/email hashes, or explicit advisor confirmation are permitted.
2. **Graceful Anonymous Fallback:** When explicit identifiers or consent are absent, the visit must map to an isolated anonymous session (`anon-{uuid}`) that is never unified across sessions.
3. **Immediate Consent Revocation (§10.4):** If consent is revoked or absent, historical interaction data must immediately be withheld from agent prompts and analysis.
4. **Governed Cascade Deletion / Right to Erasure (§10.4):** Erasing a shopper profile must cleanly unlink conversations, purge profile-derived outcomes, and log a tamper-evident audit record with zero PII.
5. **Contextual Enrichment in Agent Pipeline:** Returning visitors should provide authorized historical context (past questions, unresolved objections, prior recommendations) to SignalAnalyst (e.g. `returning_visit` +8 rubric weight) and FollowUpOptimizer.

## Decision
1. **Resolution on Permitted Explicit Identifiers Only (`ShopperProfileService`):**
   - Resolves shoppers strictly on: `externalCustomerId`, `contactHash` (requires attested consent), or `anonymousId`.
   - Never performs fuzzy or speculative identity merging.
   - Conversation linking requires recorded `basis` (`explicit_customer_id`, `explicit_phone_hash`, `explicit_email_hash`, `anonymous_session`) and authenticated `authorizer`.
2. **Database Schema Migration (`005_shopper_profiles.sql`):**
   - `conversation_shopper_links` table with unique constraint on `(org_id, conversation_id)` and foreign keys to `conversations` and `shoppers`.
   - `outcomes` table recording physical retail interaction outcomes (`purchase`, `missed_conversion`, `no_response`) with reason, value, recordedBy, and timestamps.
   - `retention_until` timestamp column on `conversations` for governed data retention lifecycles.
3. **Multi-Agent Pipeline Integration:**
   - `OrchestratorEngine` invokes `ShopperProfileService.getHistoryContext(orgId, shopperId)` and injects authorized context into `SignalAnalyst` and `FollowUpOptimizer`.
   - `SignalAnalystAgent` detects returning visitors from history context and awards `returning_visit` (+8 rubric weight).
   - `FollowUpOptimizerAgent` factors past visits into draft synthesis when consent is active.
4. **Event Stream Integration (`StoreEventRepository`):**
   - Recording an outcome emits append-only store events: `PURCHASE_RECORDED` or `MISSED_CONVERSION_RECORDED`.
5. **Immediate Consent Revocation & Right to Erasure:**
   - `POST /api/shoppers/:id/revoke-consent`: Flags consent as revoked; history context immediately returns empty/unauthorized.
   - `DELETE /api/shoppers/:id`: Deletion cascade removes shopper profile, derived outcomes, unlinks conversations, and logs a tamper-evident, zero-PII audit record.
   - `POST /api/retention/purge`: Background retention purge job for expired conversations.
6. **Web Client Integration:**
   - Dedicated "Shopper Profile & Continuity" tab displaying identified vs anonymous status, visit count, returning visitor badge, extracted interests, objections, questions, and recommendations.
   - Interactive manual outcome recorder modal emitting store events.
   - Customer privacy action controls for immediate consent revocation and permanent profile erasure.

## Consequences
- Physical showroom visits benefit from cross-visit context without violating privacy or guessing identities.
- DPDP and GDPR compliance requirements are rigorously enforced with auditability.
