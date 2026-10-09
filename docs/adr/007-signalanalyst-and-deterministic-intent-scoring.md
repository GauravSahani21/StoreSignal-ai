# ADR 007: SignalAnalyst Agent and Deterministic Intent Scoring Engine

## Status
Accepted

## Context
Physical retail visits produce rich conversational signals (budget mentions, timelines, model preferences, financing queries, objections). However, having an LLM synthesize these into a subjective "score" leads to unpredictable score drift, hallucinations, and inability to explain or audit conversion scores to sales managers.

## Decision
1. **Separation of Extraction vs Scoring:**
   - **SignalAnalyst Agent (LLM Extraction):** Identifies customer intent signals, objections, preferences, and explicit budget/timeline constraints from conversation transcripts. Every extracted signal must provide evidence with stable `segmentId` and verbatim quote.
   - **IntentScorer Engine (Code Determinism):** Evaluates signals against a versioned rubric configuration (`DEFAULT_RUBRIC_CONFIG` v1.0.0). Scoring logic is 100% deterministic code with zero LLM guesswork.
2. **Explicit Basis Mandate (§6.3):**
   - For `budget` and `timeline`, the agent can only classify values as `explicit` if the cited segment's speaker is `customer` (never `advisor`).
   - If an advisor mentions a price and the customer has not agreed, it cannot be categorized as an explicit customer budget.
3. **Intent Scoring Rubric (§6.1):**
   - Base score: 20 points.
   - Positive weights: `asked_financing` (+15), `requested_trial_or_test_ride` (+20), `stated_timeline_near_term` (+20), `stated_budget_overlap` (+10), `asked_price_or_offers` (+12), `asked_availability_delivery` (+15), `returning_visit` (+8), `asked_for_followup` (+15), `compared_specific_competitor` (+5).
   - Negative weights: `stated_browsing_only` (-20), `stated_disinterest` (-30), `unresolved_blocking_objection` (-10).
   - Clamped strictly to `[0, 100]`. Bands: High (>= 70), Medium (40-69), Low (< 40).
4. **First-Class Abstention (§6.2):**
   - If customer dialogue volume is insufficient (< 1 segment or < 6 words), the scorer abstains (`score: null`, `band: null`, `confidence: 'insufficient_evidence'`).
   - If zero valid signals are found on non-trivial dialogue, the scorer returns `confidence: 'insufficient_evidence'` rather than inventing intent.
5. **Grounding Guard Gating:**
   - Signals whose segment IDs or quotes fail verification are stripped before the IntentScorer computes weights.

## Consequences
- Every point in the intent score is auditable and attributable to specific customer statements.
- Sales leadership can inspect the exact contributing signals, weights, and quotes for any lead.
