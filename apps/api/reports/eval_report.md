# StoreSignal AI — AI Evaluation Report

**Run ID:** `eval-f465876b-9d7f-401b-934d-bd1cd220d138`  
**Timestamp:** 2026-10-09T09:36:13.366Z  
**Overall Status:** ✅ PASSED  

---

## 1. Quality Gates Summary

| Metric | Score | Target Threshold | Status |
|---|---|---|---|
| **Intent Band Accuracy** | 100% | >= 80% | PASS |
| **Fact Grounding Rate** | 100% | >= 95% | PASS |
| **Knowledge Gap Abstention** | 100% | 100% | PASS |
| **Customer Consent Compliance** | 100% | 100% | PASS |
| **Human Approval Enforcement** | 100% | 100% | PASS |

---

## 2. Operational Telemetry

- **Total Test Cases:** 22
- **Pass Rate:** 100% (22 passed, 0 failed)
- **Latency Percentiles:**
  - Average: 1 ms
  - p50: 1 ms
  - p95: 2 ms
- **AI Token Usage:** 36,380 tokens
- **Total Incurred Cost:** $0.0697 USD

---

## 3. Detailed Case Results

| Case ID | Name | Category | Expected Band | Actual Band | Score | Result |
|---|---|---|---|---|---|---|
| `tc-001` | Prithvi 110 High-Mileage Daily Commuter | `high_intent` | high | high | 72 | ✅ PASS |
| `tc-002` | Vayu 160R Immediate Test Ride Booking | `high_intent` | high | high | 72 | ✅ PASS |
| `tc-003` | Returning Shopper Pro-Commuter Accessories | `returning_visitor` | high | high | 72 | ✅ PASS |
| `tc-004` | Returning Visitor Vehicle Upgrade | `returning_visitor` | high | high | 72 | ✅ PASS |
| `tc-005` | Price Sensitivity on Agni 125 vs Pre-Owned | `price_objection` | low | low | 0 | ✅ PASS |
| `tc-006` | Electric Vidyut Charging Duration Objection | `range_anxiety_objection` | medium | medium | 47 | ✅ PASS |
| `tc-007` | Electric Scooter Battery Degradation Hesitation | `range_anxiety_objection` | medium | medium | 47 | ✅ PASS |
| `tc-008` | Head-to-Head Comparison: Prithvi 110 vs Agni 125 | `model_comparison` | high | high | 72 | ✅ PASS |
| `tc-009` | Comparison: Agni 125 vs Vayu 160R Performance | `model_comparison` | high | high | 72 | ✅ PASS |
| `tc-010` | Deliberate Gap: Uncataloged Adventure Tourer Specs | `deliberate_knowledge_gap` | medium | medium | 47 | ✅ PASS |
| `tc-011` | Deliberate Gap: Retrofit CNG Dual-Fuel Kit | `deliberate_knowledge_gap` | medium | medium | 47 | ✅ PASS |
| `tc-012` | Deliberate Gap: Out-of-State EV Government Subsidy | `deliberate_knowledge_gap` | medium | medium | 47 | ✅ PASS |
| `tc-013` | Thin Dialogue: Casual Showroom Water Request | `thin_dialogue` | abstained | abstained | 0 | ✅ PASS |
| `tc-014` | Thin Dialogue: Showroom Hours Inquiry | `thin_dialogue` | abstained | abstained | 0 | ✅ PASS |
| `tc-015` | Window Shopper: Waiting for Friend | `window_shopper` | low | low | 0 | ✅ PASS |
| `tc-016` | Consent Declined: Follow-Up Blocked | `consent_declined` | medium | medium | 47 | ✅ PASS |
| `tc-017` | Festive Financing & EMI Calculation | `financing_inquiry` | high | high | 72 | ✅ PASS |
| `tc-018` | Pre-Owned Vehicle Exchange Valuation | `medium_intent` | high | high | 72 | ✅ PASS |
| `tc-019` | College Student Lightweight Maneuverability | `medium_intent` | high | high | 72 | ✅ PASS |
| `tc-020` | Corporate Fleet Commercial Inquiries | `high_intent` | high | high | 72 | ✅ PASS |
| `tc-021` | Service Center Inquiry & Warranty Repair Walk-In | `low_intent` | abstained | abstained | 0 | ✅ PASS |
| `tc-022` | Aggressive Cash Discount Negotiation | `price_objection` | medium | medium | 47 | ✅ PASS |
