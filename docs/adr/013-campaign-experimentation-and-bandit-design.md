# ADR 013: Campaign Experimentation, Deterministic Variant Assignment, and Contextual Bandit Architecture

## Status
Accepted

## Context
Physical showroom retail operations require scientific, honest campaign experimentation to test prompt variations, follow-up templates, and communication strategies (§12, §15):
1. **Honest Statistical Guardrails (§12, §15):** Physical dealerships frequently encounter small sample sizes ($N < 50$). Declaring "winners" or calculating naive point estimates without uncertainty margins leads to premature false discoveries. The platform must enforce:
   - **Wilson Score Intervals:** Robust asymmetric 95% confidence intervals bounded in $[0, 1]$ even for extreme proportions ($0/N$ or $N/N$).
   - **Minimum Sample Size Gating:** Winner declaration is strictly blocked if any variant has $N < \text{minSampleSize}$ (default $N = 30$).
   - **Hypothesis Testing:** Two-proportion z-tests requiring $p < 0.05$ and non-overlapping confidence intervals before a winner is declared.
   - **Prominent Disclaimers:** Visible warnings noting observational limits ("Correlation does not prove customer causation").
2. **Deterministic Cryptographic Assignment:** A shopper or conversation must consistently experience the identical experiment variant across multiple visits or advisor interactions without server-side race conditions.
3. **Zero Outbound Sending Path:** Experimentation records exposures, sends, and responses from human-governed actions. It does **not** introduce any autonomous messaging clients or unapproved messaging dispatch (§0.1, §12).
4. **Contextual Bandit Architecture Specification (§12, §15):** The system must formally define the mathematical framework for future multi-armed / contextual bandit optimization while maintaining intellectual honesty (never conflating simple heuristic rules with "reinforcement learning").

---

## Decision

### 1. Database Schema (`007_experimentation.sql`)
- `experiments`: Tracks hypothesis, target type (`followup_prompt`, `rubric_config`, `channel_strategy`), status (`draft`, `running`, `paused`, `completed`), eligibility rules JSON, traffic allocation %, and minimum sample size.
- `experiment_variants`: Configures variant keys (`control`, `variant_a`), descriptions, traffic weights (e.g. 50/50), and parameters JSON.
- `experiment_assignments`: Records immutable, deterministic entity bindings (`shopper` or `conversation`).
- `experiment_events`: Append-only event stream for outcomes (`exposure`, `send`, `response`, `conversion`, `cost_recorded`).

### 2. Deterministic Assignment Engine (`AssignmentEngine.ts`)
- Uses cryptographic SHA-256 hash seeds:
  - `traffic:${experimentId}:${entityId}` mod 100 $\implies$ determines enrollment vs exclusion based on `trafficAllocationPct`.
  - `variant:${experimentId}:${entityId}` mod 100 $\implies$ determines variant bucket proportional to variant weights.
- Validates eligibility criteria before enrollment (`minIntentScore`, `permittedChannels`, `storeIds`).
- Persists assignment for $O(1)$ future resolution.

### 3. Statistical Analysis Engine (`statistics.ts`)
- Implements the Wilson Score interval for binomial proportions:
  $$p' = \frac{p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}} \pm \frac{z}{1 + \frac{z^2}{n}} \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}$$
- Implements two-proportion z-testing with error function approximation for exact two-tailed $p$-values.
- Enforces strict winner declaration logic: if $N < \text{minSampleSize}$ or $p \ge 0.05$, `winnerDeclared: false` and `winningVariantKey: null`.

### 4. Contextual Bandit Formal Design (Designed-Not-Implemented)
Per §12 and §15, the platform specifies the production bandit architecture without premature deployment:
- **Context Vector $\mathbf{x} \in \mathbb{R}^d$:**
  - $x_1$: Normalized intent score $[0, 1]$
  - $x_2$: Shopper visit count (1 = first walk-in, 2+ = returning visitor)
  - $x_3$: Price sensitivity flag $\in \{0, 1\}$
  - $x_4$: Primary vehicle interest category (one-hot: commuter, premium, ev)
- **Action Space $\mathcal{A}$:** Discrete set of approved prompt templates (e.g. Action 1: Festive Financing Hook; Action 2: Technical Durability Recap; Action 3: Test Ride Incentive).
- **Reward Function $R(a, \mathbf{x}) \in [0, 1]$:**
  $$R = 0.3 \cdot \mathbb{I}(\text{response}) + 0.7 \cdot \mathbb{I}(\text{booking}) - \lambda \cdot \text{tokenCost}$$
- **Policy & Exploration:** Linear Upper Confidence Bound (LinUCB) or Thompson Sampling with bounded exploration ($\epsilon$-greedy capped at 10% maximum exploration).
- **Safety Guardrails:** All generated drafts still require human approval before outreach; human rejection yields negative reward penalty ($R = -0.2$).
- **Offline Evaluation:** Prior to online execution, candidate policies must be validated via Doubly Robust (DR) estimation on logged experiment events:
  $$\hat{V}_{\text{DR}}(\pi) = \frac{1}{N} \sum_{i=1}^N \left( \frac{\pi(a_i | \mathbf{x}_i)}{p(a_i | \mathbf{x}_i)} (r_i - \hat{Q}(\mathbf{x}_i, a_i)) + \sum_{a} \pi(a | \mathbf{x}_i) \hat{Q}(\mathbf{x}_i, a) \right)$$
- **Intellectual Honesty Constraint:** The platform does not claim reinforcement learning until online continuous policy updates and exploration are actively deployed with logged offline evaluation evidence.

### 5. Frontend Experimentation Workspace (`ExperimentationDashboard.tsx`)
- Integrated as a top-level tab in StoreSignal AI.
- Displays active experiments, variant cards with 95% Wilson confidence intervals, sample size verification badges, and statistical comparison tables.
- Interactive Deterministic Assignment Simulator for verifying customer allocation.
- Outcome event ingestion via manual entry and CSV upload.

---

## Verification Evidence
```bash
$ npx vitest run src/tests/experiments.test.ts

 ✓ Phase 13: Campaign Experimentation & Optimization Engine
   ✓ Deterministic Assignment Engine > guarantees 100% determinism: same entity always receives the exact same variant
   ✓ Deterministic Assignment Engine > distributes 1,000 distinct entities evenly across 50/50 variants (uniform hash balance)
   ✓ Deterministic Assignment Engine > enforces traffic allocation gating strictly
   ✓ Deterministic Assignment Engine > enforces eligibility rules (minIntentScore, permittedChannels, storeIds)
   ✓ Statistical Analysis Engine & Guardrails > calculates robust Wilson score intervals bounded in [0, 1]
   ✓ Statistical Analysis Engine & Guardrails > calculates accurate two-proportion z-test statistics
   ✓ Statistical Analysis Engine & Guardrails > STRICT GUARD: refuses to declare a winner when sample size < minSampleSize
   ✓ Statistical Analysis Engine & Guardrails > declares a winner when sample size >= minSampleSize AND p < 0.05 with positive uplift
   ✓ CSV Outcome Ingestion & Zero External Send Path > successfully imports outcome events from CSV format
   ✓ CSV Outcome Ingestion & Zero External Send Path > confirms ZERO outbound messaging send paths exist in experiment pipeline (§12, §15)
   ✓ Fastify REST Endpoints Integration > serves experiments and analysis via API routes

Test Files  1 passed (1)
Tests  11 passed (11)
```

---

## Consequences
- Dealership operations and marketing teams can execute scientifically valid A/B tests on prompts and messaging strategies.
- Eliminates confirmation bias and premature conclusions on underpowered physical showroom cohorts.
- Retains complete privacy, security, and human governance.
