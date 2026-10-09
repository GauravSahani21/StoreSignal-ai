import type { ParsedSegment } from '../conversations/segmenter.js';
import type { EvidenceRef } from '../agents/guards/groundingGuards.js';
import { DEFAULT_RUBRIC_CONFIG, type RubricConfig } from './rubricConfig.js';

export interface EvaluatedSignal {
  signalId: string;
  present: boolean;
  isValid: boolean; // Must pass grounding guards to be counted
  evidence: EvidenceRef[];
}

export interface ContributingSignal {
  signalId: string;
  meaning: string;
  weight: number;
  evidence: EvidenceRef[];
}

export type IntentBand = 'low' | 'medium' | 'high' | null;
export type IntentConfidence = 'high' | 'medium' | 'low' | 'insufficient_evidence';

export interface IntentAssessment {
  score: number | null;
  band: IntentBand;
  confidence: IntentConfidence;
  contributingSignals: ContributingSignal[];
  rubricVersion: string;
  reason?: string;
}

export class IntentScorer {
  private readonly config: RubricConfig;

  constructor(config: RubricConfig = DEFAULT_RUBRIC_CONFIG) {
    this.config = config;
  }

  evaluate(
    evaluatedSignals: EvaluatedSignal[],
    customerSegments: ParsedSegment[]
  ): IntentAssessment {
    // 1. Calculate customer verbal volume
    const customerWords = customerSegments
      .map((s) => s.text)
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    // 2. Strict Abstention Rule per §6.2
    const isThinDialogue =
      customerSegments.length < this.config.minCustomerSegmentsForEvaluation ||
      customerWords.length < this.config.minCustomerWordsForEvaluation;

    if (isThinDialogue) {
      return {
        score: null,
        band: null,
        confidence: 'insufficient_evidence',
        contributingSignals: [],
        rubricVersion: this.config.version,
        reason: `Insufficient customer dialogue (${customerSegments.length} segments, ${customerWords.length} words; minimum required: ${this.config.minCustomerSegmentsForEvaluation} segments, ${this.config.minCustomerWordsForEvaluation} words).`,
      };
    }

    // 3. Filter valid and present signals
    const activeContributing: ContributingSignal[] = [];
    let scoreAccumulator = this.config.baseScore;

    for (const item of evaluatedSignals) {
      if (!item.present || !item.isValid) {
        continue; // Guard failed or signal absent: ignored from calculation
      }

      const definition = this.config.signals[item.signalId];
      if (definition) {
        scoreAccumulator += definition.weight;
        activeContributing.push({
          signalId: definition.signalId,
          meaning: definition.meaning,
          weight: definition.weight,
          evidence: item.evidence,
        });
      }
    }

    // 4. Abstain if zero valid signals were extracted on non-trivial dialogue
    if (activeContributing.length === 0) {
      return {
        score: null,
        band: null,
        confidence: 'insufficient_evidence',
        contributingSignals: [],
        rubricVersion: this.config.version,
        reason: 'No evidence-validated intent signals could be confirmed from conversation dialogue.',
      };
    }

    // 5. Clamp score strictly between 0 and 100
    const clampedScore = Math.max(0, Math.min(100, scoreAccumulator));

    // 6. Compute Intent Band
    let band: IntentBand = 'medium';
    if (clampedScore < 40) {
      band = 'low';
    } else if (clampedScore >= 70) {
      band = 'high';
    }

    // 7. Compute Confidence
    let confidence: IntentConfidence = 'medium';
    if (activeContributing.length >= 3) {
      confidence = 'high';
    } else if (activeContributing.length === 1) {
      confidence = 'low';
    }

    return {
      score: clampedScore,
      band,
      confidence,
      contributingSignals: activeContributing,
      rubricVersion: this.config.version,
    };
  }
}
