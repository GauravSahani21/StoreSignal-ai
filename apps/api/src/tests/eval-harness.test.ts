import { describe, expect, it } from 'vitest';
import { GOLDEN_DATASET } from '../eval/dataset.js';
import { EvaluationRunner } from '../eval/evaluator.js';

describe('AI Evaluation Harness & Continuous Quality Suite (Phase 12 & §14)', () => {
  it('contains at least 20 diverse, realistic retail showroom transcripts', () => {
    expect(GOLDEN_DATASET.length).toBeGreaterThanOrEqual(20);

    const categories = new Set(GOLDEN_DATASET.map((tc) => tc.category));
    expect(categories.has('high_intent')).toBe(true);
    expect(categories.has('price_objection')).toBe(true);
    expect(categories.has('range_anxiety_objection')).toBe(true);
    expect(categories.has('model_comparison')).toBe(true);
    expect(categories.has('deliberate_knowledge_gap')).toBe(true);
    expect(categories.has('thin_dialogue')).toBe(true);
    expect(categories.has('consent_declined')).toBe(true);
    expect(categories.has('returning_visitor')).toBe(true);
  });

  it('runs evaluation suite and validates strict continuous quality gates', async () => {
    const runner = new EvaluationRunner();
    const summary = await runner.runSuite(GOLDEN_DATASET);

    expect(summary.totalCases).toBe(GOLDEN_DATASET.length);
    expect(summary.passedCases).toBe(summary.totalCases);
    expect(summary.failedCases).toBe(0);

    // Continuous Quality Gates
    expect(summary.qualityGates.intentBandAccuracyPercentage).toBeGreaterThanOrEqual(80);
    expect(summary.qualityGates.factGroundingRatePercentage).toBeGreaterThanOrEqual(95);
    expect(summary.qualityGates.gapAbstentionRatePercentage).toBe(100);
    expect(summary.qualityGates.consentCompliancePercentage).toBe(100);
    expect(summary.qualityGates.humanApprovalEnforcementPercentage).toBe(100);
    expect(summary.qualityGates.allGatesPassed).toBe(true);

    // Telemetry
    expect(summary.telemetry.avgLatencyMs).toBeGreaterThan(0);
    expect(summary.telemetry.totalTokens).toBeGreaterThan(0);
  });

  it('flags regression if deliberate knowledge gap is not placed in unresolved', async () => {
    const mockBadRunner = new EvaluationRunner({
      complete: async () => ({
        id: 'bad-run',
        model: 'bad-model',
        text: JSON.stringify({
          items: [{ customerQuestion: 'Fake spec question', answerStatus: 'answered_from_knowledge', suggestedResponse: 'Invented answer' }],
          unresolved: [], // Failed to place gap in unresolved!
        }),
        finishReason: 'stop',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 100,
        costCents: 0.05,
      }),
    });

    const gapOnlyCases = GOLDEN_DATASET.filter((tc) => tc.expected.isDeliberateGap).slice(0, 1);
    const summary = await mockBadRunner.runSuite(gapOnlyCases);

    expect(summary.qualityGates.gapAbstentionRatePercentage).toBe(0);
    expect(summary.qualityGates.allGatesPassed).toBe(false);
  });
});
