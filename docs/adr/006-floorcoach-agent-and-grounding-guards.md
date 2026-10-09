# ADR 006: FloorCoach Agent Architecture and Post-Validation Grounding Guards

## Status
Accepted

## Context
Sales staff in physical retail environments require immediate, accurate objection handling and spec verification during customer interactions. LLM outputs cannot be trusted blindly, as hallucinated prices, unverified discounts, or fabricated warranty durations cause legal and business liabilities.

## Decision
1. **Agent Output Contract (§5.1):** FloorCoach outputs structured items with `customerQuestion`, `evidence` (stable segment IDs + exact quotes), `objectionType` (from controlled vocabulary), `suggestedResponse`, `supportingSources` (subset of retrieved chunks), `answerStatus`, and `nextStep`.
2. **Grounding Guards Enforced in Code (§5.5):**
   - **Evidence Existence:** Verifies every cited segmentId exists in the active transcript.
   - **Quote Containment:** Verifies the cited quote is a normalized substring of the referenced dialogue segment.
   - **Source Subset:** Validates that every supporting source was actually present in the retrieved chunk set.
   - **Numeric/Spec Grounding:** Verifies every number, currency amount, or duration mentioned in `suggestedResponse` appears in a cited chunk or the customer's own dialogue.
3. **First-Class Abstention:** Questions regarding unverified specs or deliberate gaps (e.g. absent accessory pricing) are marked `needs_verification` and moved to `unresolved` with reason `no_source_found`.
4. **Repair-Retry Loop:** The agent attempts up to 2 repair retries with explicit Zod or guard failure messages before cleanly terminating with `AgentOutputInvalidError`.
5. **Persistence:** Agent runs, validation results, and outputs are persisted to `agent_runs` for complete auditability.

## Consequences
- Grounding is enforced deterministically by code, not prompt compliance.
- Unverified knowledge gaps cannot produce fabricated numbers.
