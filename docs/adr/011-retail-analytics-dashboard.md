# ADR 011: Retail Analytics Dashboard, Operational Intelligence, and Telemetry

## Status
Accepted

## Context
Physical retail operations require comprehensive visibility across conversations, conversion performance, agent activity, and showroom dynamics without sacrificing operational truth:
1. **Honest Metrics over Fabricated Numbers (§0.2, §13):** Every KPI and chart must calculate dynamically from real persisted records (conversations, transcripts, outcomes, workflow runs, usage events). Hardcoded metrics or dummy calculations are strictly prohibited.
2. **Statistical Transparency & Low Data Handling (§13):** Physical store pilots frequently launch with small cohorts. When sample size N < 5, the system must clearly display a statistical confidence disclaimer banner rather than presenting misleading percentages as high-confidence conclusions.
3. **Dual-Pane Conversation Intelligence Workspace (Area B):** Store managers and floor coaches need to inspect dialogues with speaker-by-speaker transcripts juxtaposed against structured agent extractions (intent scoring, detected questions, objections with direct quote evidence, FloorCoach suggested responses, and follow-up drafts).
4. **Governed Follow-Up Queue Visibility (Area E):** Clear oversight of drafts pending human review, approved drafts, rejected drafts, and channel distributions (WhatsApp, Email, SMS, Call Task, None/Blocked).
5. **Agent Telemetry & Token Cost Attribution (Area D):** Transparent operational accounting of model invocations, latency percentiles (p50/p95), prompt/completion tokens, and USD costs across pipeline agents (`retrieval`, `floor_coach`, `signal_analyst`, `followup_optimizer`).
6. **Data Export Compliance (RFC 4180 CSV):** Store operations require standard CSV exports of analytical store events for offline auditing and BI integration.

## Decision
1. **Database Schema Migration (`006_analytics_dashboard.sql`):**
   - Added `usage_events` table tracking per-step model, latency, tokens, and cost.
   - Added indexes on `conversations(org_id, store_id, created_at)` and `store_events(org_id, event_type, created_at)`.
2. **Usage Telemetry Logging in Orchestration (`UsageEventRepository`):**
   - Enhanced `OrchestratorEngine` to emit structured `usage_events` records for every agent invocation (`retrieval`, `floor_coach`, `signal_analyst`, `followup_optimizer`).
3. **Core Analytics Service (`StoreAnalyticsService`):**
   - Implemented Areas A through F per §13:
     - **Area A (Overview KPIs):** Conversations, unique authorized shoppers, conversions, revenue in INR, conversion rate %, avg latency ms, workflow success rate %, AI tokens & cost, low-data flag (`isLowDataState`).
     - **Area B (Workspace & Dual-Pane):** Filterable conversation table with intent badges; single conversation intelligence view juxtaposing full dialogue turns with structured agent signals.
     - **Area C (Shopper Insights):** Intent band distribution (high, medium, low, abstained), identified vs anonymous shoppers, returning visitor conversion rate comparison, top product interests.
     - **Area D (Agent Telemetry):** Per-agent invocations, success rate %, p50/p95 latency ms, token breakdown, total cost USD.
     - **Area E (Follow-Up Queue):** Draft status breakdown (draft, approved, rejected) and communication channel breakdown.
     - **Area F (Store Insights):** Frequent objections with direct quote evidence, missed conversion reasons, revenue by store.
     - **RFC 4180 CSV Export:** Direct streamable CSV endpoint with proper field escaping.
4. **REST API Endpoints (`apps/api/src/routes/analytics.ts`):**
   - `GET /api/analytics/overview`
   - `GET /api/analytics/conversations`
   - `GET /api/analytics/conversations/:id`
   - `GET /api/analytics/shoppers`
   - `GET /api/analytics/agents`
   - `GET /api/analytics/followups`
   - `GET /api/analytics/store-insights`
   - `GET /api/analytics/export/csv`
   - All endpoints support filtering by `storeId`, `from`, `to`, and `demoFilter` (`all`, `real_only`, `demo_only`).
5. **Seeded Realistic Multi-Store Demo Records (`seed.ts`):**
   - 6 realistic showroom dialogues across 2 locations (`store-indiranagar-01` and `store-koramangala-02`) showcasing diverse scenarios (high intent test ride, accessory inquiry, EV charging hesitation, price sensitivity, immediate vehicle booking, brief hours inquiry).
   - Flagged with `isDemo: true` and visible `DEMO DATA ACTIVE` UI indicators.
6. **Frontend Web Dashboard (`RetailAnalyticsDashboard.tsx`):**
   - Modern, executive-grade React component adhering to design guidelines.
   - Real-time store and demo filtering, CSV export, interactive dual-pane inspector, and low-data statistical warning banner.

## Consequences
- Operations leaders, showroom managers, and floor coaches have a single pane of glass for physical retail conversation intelligence.
- Zero synthetic numbers; all metrics are grounded in verified transactional and telemetry records.
- Complete compliance with privacy, human-in-the-loop review, and token cost accountability.
