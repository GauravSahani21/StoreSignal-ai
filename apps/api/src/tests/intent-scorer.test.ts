import { describe, expect, it } from 'vitest';
import { segmentTranscript } from '../conversations/segmenter.js';
import { IntentScorer } from '../scoring/IntentScorer.js';

describe('Deterministic Intent Scorer Engine (Rubric §6)', () => {
  const scorer = new IntentScorer();

  const customerSegments = segmentTranscript(
    '[00:00:04] Customer: I am interested in buying the Prithvi 110 this week. Can I get a test ride and details on EMI financing options?'
  );

  it('computes intent score deterministically from validated signals with correct band', () => {
    // Base score is 20
    // asked_financing: +15
    // requested_trial_or_test_ride: +20
    // stated_timeline_near_term: +20
    // Total = 20 + 15 + 20 + 20 = 75 (Band: high)
    const evaluatedSignals = [
      {
        signalId: 'asked_financing',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'EMI financing options' }],
      },
      {
        signalId: 'requested_trial_or_test_ride',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'Can I get a test ride' }],
      },
      {
        signalId: 'stated_timeline_near_term',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'buying the Prithvi 110 this week' }],
      },
    ];

    const result = scorer.evaluate(evaluatedSignals, customerSegments);

    expect(result.score).toBe(75);
    expect(result.band).toBe('high');
    expect(result.confidence).toBe('high');
    expect(result.contributingSignals).toHaveLength(3);
    expect(result.contributingSignals[0]?.weight).toBe(15);
  });

  it('correctly applies negative weights and clamps score at 0', () => {
    // Base score 20 - stated_disinterest (-30) - stated_browsing_only (-20) = -30 -> clamped to 0
    const evaluatedSignals = [
      {
        signalId: 'stated_disinterest',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'not interested' }],
      },
      {
        signalId: 'stated_browsing_only',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'just browsing' }],
      },
    ];

    const result = scorer.evaluate(evaluatedSignals, customerSegments);

    expect(result.score).toBe(0);
    expect(result.band).toBe('low');
  });

  it('abstains with insufficient_evidence when customer dialogue volume is below threshold', () => {
    // Single thin customer segment with 3 words
    const thinSegments = segmentTranscript('[00:00:01] Customer: Hi there.');

    const evaluatedSignals = [
      {
        signalId: 'asked_price_or_offers',
        present: true,
        isValid: true,
        evidence: [{ segmentId: thinSegments[0]!.id, quote: 'Hi' }],
      },
    ];

    const result = scorer.evaluate(evaluatedSignals, thinSegments);

    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.confidence).toBe('insufficient_evidence');
    expect(result.reason).toContain('Insufficient customer dialogue');
  });

  it('ignores signals whose evidence failed grounding validation', () => {
    // One valid signal (+12) and one invalid signal (+20, marked isValid: false)
    // Base 20 + 12 = 32 (invalid signal must NOT be counted)
    const evaluatedSignals = [
      {
        signalId: 'asked_price_or_offers',
        present: true,
        isValid: true,
        evidence: [{ segmentId: customerSegments[0]!.id, quote: 'price' }],
      },
      {
        signalId: 'requested_trial_or_test_ride',
        present: true,
        isValid: false, // Invalid evidence!
        evidence: [{ segmentId: 'seg-fake', quote: 'fake' }],
      },
    ];

    const result = scorer.evaluate(evaluatedSignals, customerSegments);

    expect(result.score).toBe(32);
    expect(result.contributingSignals).toHaveLength(1);
    expect(result.contributingSignals[0]?.signalId).toBe('asked_price_or_offers');
  });
});
