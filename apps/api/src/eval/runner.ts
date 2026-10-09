import fs from 'node:fs/promises';
import path from 'node:path';
import { EvaluationRunner } from './evaluator.js';
import { GOLDEN_DATASET } from './dataset.js';

async function runCli(): Promise<void> {
  console.log('='.repeat(80));
  console.log(' StoreSignal AI — AI Evaluation Harness & Continuous Quality Suite (Phase 12)');
  console.log('='.repeat(80));
  console.log(`Running evaluation across ${GOLDEN_DATASET.length} hand-labeled golden retail test cases...\n`);

  const runner = new EvaluationRunner();
  const summary = await runner.runSuite();

  // Print results table
  console.log('ID     | Category                  | Expected | Actual   | Score | Pass? | Latency');
  console.log('-'.repeat(80));
  for (const r of summary.results) {
    const padId = r.caseId.padEnd(6);
    const padCat = r.category.padEnd(25);
    const padExp = r.metrics.intentBandExpected.padEnd(8);
    const padAct = r.metrics.intentBandActual.padEnd(8);
    const padScore = String(r.metrics.intentScore).padStart(5);
    const padPass = (r.passed ? 'PASS' : 'FAIL').padEnd(5);
    const latency = `${r.durationMs}ms`;
    console.log(`${padId} | ${padCat} | ${padExp} | ${padAct} | ${padScore} | ${padPass} | ${latency}`);
    if (!r.passed && r.failures.length > 0) {
      for (const f of r.failures) {
        console.log(`   └─ ❌ ${f}`);
      }
    }
  }
  console.log('-'.repeat(80));

  // Print Quality Gates Summary
  console.log('\n--- QUALITY GATE EVALUATION METRICS ---');
  console.log(`• Intent Band Accuracy:             ${summary.qualityGates.intentBandAccuracyPercentage}%  (Threshold: >= 80%)`);
  console.log(`• Fact Grounding Rate:               ${summary.qualityGates.factGroundingRatePercentage}% (Threshold: >= 95%)`);
  console.log(`• Knowledge Gap Abstention Rate:     ${summary.qualityGates.gapAbstentionRatePercentage}% (Threshold: 100%)`);
  console.log(`• Customer Consent Compliance:       ${summary.qualityGates.consentCompliancePercentage}% (Threshold: 100%)`);
  console.log(`• Human Approval Enforcement:        ${summary.qualityGates.humanApprovalEnforcementPercentage}% (Threshold: 100%)`);

  console.log('\n--- OPERATIONAL TELEMETRY ---');
  console.log(`• Total Cases Evaluated: ${summary.totalCases}`);
  console.log(`• Passed: ${summary.passedCases} | Failed: ${summary.failedCases} (${summary.overallPassRatePercentage}%)`);
  console.log(`• Latency: p50 = ${summary.telemetry.p50LatencyMs}ms | p95 = ${summary.telemetry.p95LatencyMs}ms | avg = ${summary.telemetry.avgLatencyMs}ms`);
  console.log(`• AI Tokens Used: ${summary.telemetry.totalTokens.toLocaleString()}`);
  console.log(`• Total AI Cost: $${summary.telemetry.totalCostUsd.toFixed(4)} USD`);

  // Write reports
  const reportsDir = path.resolve(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const jsonReportPath = path.join(reportsDir, 'eval_report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(summary, null, 2), 'utf-8');

  const mdReport = generateMarkdownReport(summary);
  const mdReportPath = path.join(reportsDir, 'eval_report.md');
  await fs.writeFile(mdReportPath, mdReport, 'utf-8');

  console.log(`\nEvaluation artifacts generated:`);
  console.log(`  JSON: ${jsonReportPath}`);
  console.log(`  MD:   ${mdReportPath}`);

  if (summary.qualityGates.allGatesPassed) {
    console.log('\n✅ ALL AI QUALITY GATES PASSED! Ready for production deployment.\n');
    process.exit(0);
  } else {
    console.error('\n❌ ONE OR MORE QUALITY GATES FAILED. Halting build.\n');
    process.exit(1);
  }
}

function generateMarkdownReport(summary: import('./types.js').EvaluationSummary): string {
  return `# StoreSignal AI — AI Evaluation Report

**Run ID:** \`${summary.runId}\`  
**Timestamp:** ${summary.timestamp}  
**Overall Status:** ${summary.qualityGates.allGatesPassed ? '✅ PASSED' : '❌ FAILED'}  

---

## 1. Quality Gates Summary

| Metric | Score | Target Threshold | Status |
|---|---|---|---|
| **Intent Band Accuracy** | ${summary.qualityGates.intentBandAccuracyPercentage}% | >= 80% | ${summary.qualityGates.intentBandAccuracyPercentage >= 80 ? 'PASS' : 'FAIL'} |
| **Fact Grounding Rate** | ${summary.qualityGates.factGroundingRatePercentage}% | >= 95% | ${summary.qualityGates.factGroundingRatePercentage >= 95 ? 'PASS' : 'FAIL'} |
| **Knowledge Gap Abstention** | ${summary.qualityGates.gapAbstentionRatePercentage}% | 100% | ${summary.qualityGates.gapAbstentionRatePercentage === 100 ? 'PASS' : 'FAIL'} |
| **Customer Consent Compliance** | ${summary.qualityGates.consentCompliancePercentage}% | 100% | ${summary.qualityGates.consentCompliancePercentage === 100 ? 'PASS' : 'FAIL'} |
| **Human Approval Enforcement** | ${summary.qualityGates.humanApprovalEnforcementPercentage}% | 100% | ${summary.qualityGates.humanApprovalEnforcementPercentage === 100 ? 'PASS' : 'FAIL'} |

---

## 2. Operational Telemetry

- **Total Test Cases:** ${summary.totalCases}
- **Pass Rate:** ${summary.overallPassRatePercentage}% (${summary.passedCases} passed, ${summary.failedCases} failed)
- **Latency Percentiles:**
  - Average: ${summary.telemetry.avgLatencyMs} ms
  - p50: ${summary.telemetry.p50LatencyMs} ms
  - p95: ${summary.telemetry.p95LatencyMs} ms
- **AI Token Usage:** ${summary.telemetry.totalTokens.toLocaleString()} tokens
- **Total Incurred Cost:** $${summary.telemetry.totalCostUsd.toFixed(4)} USD

---

## 3. Detailed Case Results

| Case ID | Name | Category | Expected Band | Actual Band | Score | Result |
|---|---|---|---|---|---|---|
${summary.results
  .map(
    (r) =>
      `| \`${r.caseId}\` | ${r.name} | \`${r.category}\` | ${r.metrics.intentBandExpected} | ${r.metrics.intentBandActual} | ${r.metrics.intentScore} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`
  )
  .join('\n')}
`;
}

void runCli();
