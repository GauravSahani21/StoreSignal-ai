# ADR 009: Multi-Agent Orchestration Engine and Lifecycle State Machine

## Status
Accepted

## Context
A governed physical retail intelligence platform cannot allow individual agents to run ad-hoc or trigger uncontrolled side effects. FloorCoach, SignalAnalyst, and FollowUpOptimizer have explicit dependencies, partial failure requirements, and concurrency concerns:
1. FloorCoach and SignalAnalyst are independent after knowledge retrieval and should execute in parallel for low latency.
2. FollowUpOptimizer strictly requires validated SignalAnalyst intelligence (and optional FloorCoach inputs) and must be skipped if SignalAnalyst fails.
3. Concurrent duplicate submissions on the same conversation must be serialized or deduplicated to avoid duplicate drafts and divergent state.

## Decision
1. **Governed State Machine (§5.2):**
   - Workflow states: `PENDING → RETRIEVING → ANALYZING (coach ∥ analyst) → FOLLOWUP_PLANNING → AWAITING_APPROVAL → COMPLETED`, plus terminal `PARTIAL` and `FAILED`.
   - Step states: `PENDING, RUNNING, SUCCEEDED, FAILED, SKIPPED (with reason), TIMED_OUT`.
2. **Parallel Analysis via `Promise.allSettled`:**
   - After RAG retrieval completes, FloorCoach and SignalAnalyst execute concurrently.
   - If FloorCoach fails: execution continues; step is marked `FAILED`, FloorCoach output is null, and workflow results in `PARTIAL`.
   - If SignalAnalyst fails: FollowUpOptimizer is skipped (`SKIPPED: missing_dependency: signal_analyst_failed`), and workflow ends in `PARTIAL` (or `FAILED` if FloorCoach also failed).
3. **Idempotency & Deduplication (§5.3):**
   - Idempotency key: `${conversationId}:${transcriptVersion}:${CONFIG_VERSION}`.
   - Duplicate calls return the existing completed run without invoking LLMs or creating duplicate drafts or events.
   - An explicit `forceReRun: true` parameter creates a new versioned workflow run (`version = N + 1`).
4. **Concurrency Lock:**
   - Exclusive lock per conversation with automatic TTL expiration (30 seconds) to prevent race conditions during long-running agent workflows.
5. **Audit Trace & Timeline Events:**
   - Every state transition, step start/completion, duration, and error emits an immutable `WorkflowEvent`.
   - Single entry point endpoint: `POST /api/conversations/:id/process`.
   - Inspection endpoints: `GET /api/workflows/:id`, `GET /api/workflows/:id/events`, and `GET /api/conversations/:id/trace`.
6. **Web Client Workflow Timeline:**
   - Interactive pipeline component displaying step status, latency, duration, and event log.

## Consequences
- Complex multi-agent executions are predictable, fully observable, and recoverable under partial failures.
- Zero duplicate outreach drafts or side effects can occur from duplicate submissions.
