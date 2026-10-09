# StoreSignal AI — 3–5 Minute Click-by-Click Demonstration Script (§19)

> **Purpose:** This script provides an evaluative, reproducible step-by-step walkthrough of the StoreSignal AI platform using real seeded physical showroom records.

---

## Preparation (30 Seconds)
```bash
# 1. Start application stack
docker compose up -d postgres
npm run demo:seed
npm run dev

# 2. Open browser
# Navigate to: http://localhost:5173
```

---

## Step 1: Retail Operations Dashboard (Phase 11 Overview)
1. **Observe Area A (Executive KPIs):**
   - Note the real persisted metrics: 6 Conversations, 3 Identified Shoppers, ₹2,08,500 Revenue recorded.
   - Note the **DEMO DATA ACTIVE** indicator badge in the header.
2. **Observe Area F (Store & Conversion Insights):**
   - Review frequent objections: `range_anxiety` (50%), `price` (50%).
   - Click any objection quote $\implies$ displays verbatim segment quote from customer dialogue.
3. **Filter by Store:**
   - Change store dropdown from "All Dealership Locations" to "Indiranagar Showroom (store-indiranagar-01)".
   - Observe live dynamic recalculation of metrics.

---

## Step 2: Multi-Agent Studio & Live Showroom Ingestion
1. Click the **"Live Dialogue & Multi-Agent Studio"** tab in the top navigation bar.
2. **Review Showroom Audio & Ingestion Card (Left Pane):**
   - Click "Audio Recording Consent Granted by Customer" checkbox.
   - Click **"Ingest & Segment Dialogue"**.
   - Notice the speaker normalization into `ADVISOR` and `CUSTOMER` with stable segment IDs (`[seg-0]`, `[seg-1]`, etc.).
3. **Run Multi-Agent Pipeline:**
   - Click **"Run Multi-Agent Pipeline"**.
   - Watch the pipeline transition through states:
     - `PENDING` $\rightarrow$ `RETRIEVING` $\rightarrow$ `ANALYZING` $\rightarrow$ `FOLLOWUP` $\rightarrow$ `COMPLETED`.
   - Inspect the **Pipeline Step Trace**:
     - `retrieval`: 2 chunks fetched with cosine similarity $\ge 0.40$.
     - `floor_coach`: Grounding guards verified; zero ungrounded technical specs.
     - `signal_analyst`: Intent Score 72/100 (`high` band) computed from explicit signals.
     - `followup_optimizer`: Generated WhatsApp follow-up draft citing only verified facts.

---

## Step 3: Deliberate Knowledge Gap Handling (Safety Guardrail Verification)
1. Replace the transcript in the Ingestion box with the following deliberate gap inquiry:
   ```text
   [00:00:02] Advisor: Welcome to Vayu Motors! How can I assist you?
   [00:00:06] Customer: Does Vayu Motors offer a 250cc Himalayan adventure tourer with 220mm ground clearance?
   [00:00:13] Advisor: Let me check our catalog.
   [00:00:18] Customer: Also let me know if you install aftermarket CNG kits.
   ```
2. Click **"Ingest & Segment Dialogue"**, then click **"Run Multi-Agent Pipeline"**.
3. **Observe FloorCoach Behavior:**
   - FloorCoach **abstains from inventing figures**.
   - Surfaces in `unresolved`: *"Customer inquiry regarding 250cc adventure"* with reason `no_source_found`.
   - Quality gate verified: 100% gap abstention rate without model hallucination.

---

## Step 4: Governed Follow-Up Queue (Human-in-the-Loop Review)
1. In the Right Pane, locate the **Governed Follow-Up Queue**.
2. Click **"Edit Message"** on the generated draft.
3. Modify the subject or message body to add a personalized greeting.
4. Click **"Save Changes"**.
5. Click **"Approve Draft"** (requires Manager role).
6. **Notice the Governance Enforcement:**
   - Status transitions to `APPROVED`.
   - An immutable audit trail is saved with timestamp and reviewer ID.
   - **Crucial verification:** No external message is dispatched automatically. The platform strictly enforces human air-gapping.

---

## Step 5: Shopper Profile & Cross-Visit Continuity (Phase 10)
1. Click the **"Shopper Profile & Continuity"** tab.
2. Select **"Rahul Sharma (CUST-IND-101)"** (Returning Buyer).
3. **Inspect Cross-Visit Memory:**
   - Note his 2 logged visits across 14 days.
   - Returning visitor bonus applied (+8 points in IntentScorer rubric).
   - Past purchase: *Prithvi 110* in Midnight Black.
   - Current open interest: *Pro Commuter Extended Warranty*.
4. **Test DPDP Act 2023 Consent Revocation:**
   - Click **"Revoke Consent"** $\implies$ status immediately displays *"Revoked: Future processing blocked"*.
5. **Test Right to Erasure:**
   - Click **"Execute Right to Erasure Cascade"** $\implies$ permanently erases customer record, unlinks conversation sessions, and writes a zero-PII audit record.

---

## Step 6: Campaign Experimentation & Statistical Guardrails (Phase 13)
1. Click the **"Campaign Experiments"** tab.
2. Select **"Festive Financing Hook vs Technical Spec Focus"** ($N=93$).
   - Observe the 95% Wilson Confidence Intervals:
     - Control: $[10.9\% - 33.4\%]$
     - Variant A: $[25.2\% - 51.7\%]$
   - Two-proportion z-test shows $p = 0.048 < 0.05$ with $+87.5\%$ relative uplift.
   - Green badge: **"Significant Winner: variant_a"**.
3. Select **"Weekend Priority Test-Ride Call Task Scheduling"** ($N=15$).
   - Note the **Statistical Guardrails Warning**:
     - *N < 40 minimum sample size required. Winner declaration blocked to prevent false discoveries.*
   - Visual orange banner demonstrates honest statistical gating.
4. **Test Deterministic Simulator:**
   - Type Shopper ID `shp-customer-test-99`, select Intent Score 75, click **"Test Deterministic Allocation"**.
   - Displays exact allocated variant and cryptographic bucket mod 100.

---

## Step 7: Automated Continuous AI Quality Suite Verification
In the terminal, run the automated evaluation harness:
```bash
npm run eval
```
**Expected Output:**
- 22/22 Golden Test Cases `PASS`.
- Intent Band Accuracy: 100% (Threshold: $\ge 80\%$).
- Fact Grounding Rate: 100% (Threshold: $\ge 95\%$).
- Knowledge Gap Abstention Rate: 100% (Threshold: $100\%$).
- Consent Compliance: 100% (Threshold: $100\%$).
- Human Approval Enforcement: 100% (Threshold: $100\%$).
