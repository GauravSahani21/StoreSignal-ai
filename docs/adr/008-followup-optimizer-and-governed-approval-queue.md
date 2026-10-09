# ADR 008: FollowUpOptimizer Agent and Governed Approval Queue Architecture

## Status
Accepted

## Context
Downstream customer follow-up in automotive and physical retail can easily alienate buyers if sent automatically without human oversight, if it contains hallucinated discounts or unverified vehicle specifications, or if it contacts shoppers without explicit consent. Furthermore, algorithmic metrics (such as internal intent scores or lead bands) must never leak into customer-facing outreach messages.

## Decision
1. **Governed Output Contract (§5.1):**
   - FollowUpOptimizer outputs structured recommendations: `recommendedAction`, `reason`, `channel` (`email`, `sms`, `whatsapp`, `call_task`, `none`), `subject`, `message`, `factsUsed` (`SourceRef[]`), `status: 'draft'`, `requiresHumanApproval: true`, and optional `blockedReason`.
   - `status` is strictly `'draft'` and `requiresHumanApproval` is literal `true` enforced by schema.
2. **Channel Consent Policy & Blocked Drafts (§5.1, §8):**
   - Channel selection is strictly restricted by customer consent. If consent is absent, the agent mandates `channel: 'none'`, `message: null`, and `blockedReason: 'no_consent'`.
   - If permitted contact channels are empty, `channel: 'none'` with `blockedReason: 'no_contact_channel'`.
3. **Grounding & Governance Guards in Code (§5.5):**
   - **Internal Score Leakage Guard:** Checks that `message` never contains terms such as `intent score`, `rubric`, `high intent`, `points`, or agent internal names.
   - **Facts Used & Numeric Grounding Guard:** Verifies every number, currency value, EMI amount, or specification in `message` exists in `factsUsed`, retrieved knowledge chunks, or customer statements.
4. **Draft Persistence & State Machine (§Phase 8):**
   - Initial state: `'draft'`.
   - `PATCH /api/drafts/:id`: Edits message/subject. Modifying an already approved or rejected draft is strictly rejected with `INVALID_STATE_TRANSITION` (409 Conflict).
   - `POST /api/drafts/:id/approve`: Human advisor or manager approves the draft. Records an immutable `ApprovalRecord` and emits lifecycle event `FOLLOW_UP_APPROVED`.
   - **Absolute Governance Invariant: Zero Outbound Dispatch.** No email/SMS/WhatsApp client exists in the codebase. Approval purely updates audit records and never triggers automated external dispatch.
   - `POST /api/drafts/:id/reject`: Rejects the draft, records approval record, and emits `FOLLOW_UP_REJECTED`.
   - `FOLLOW_UP_DRAFTED` event is emitted only when a valid draft (`channel !== 'none'`) is generated.
5. **Interactive UI Queue:**
   - Dedicated follow-up approval card in the web client supporting preview, inline editing, reviewer notes, approve/reject buttons, and policy blocked banners.

## Consequences
- No customer ever receives an unreviewed, ungrounded, or non-consented message.
- Sales leadership maintains an auditable log of which human approved every communication.
