export type ScenarioCategory =
  | 'high_intent'
  | 'medium_intent'
  | 'low_intent'
  | 'thin_dialogue'
  | 'deliberate_knowledge_gap'
  | 'price_objection'
  | 'range_anxiety_objection'
  | 'model_comparison'
  | 'consent_declined'
  | 'returning_visitor'
  | 'financing_inquiry'
  | 'window_shopper';

export interface GoldenTestCase {
  id: string;
  name: string;
  category: ScenarioCategory;
  description: string;
  transcript: string;
  consentGranted: boolean;
  shopper?: {
    id: string;
    externalCustomerId?: string;
    isReturningVisitor: boolean;
    visitCount: number;
  };
  expected: {
    intentBand: 'high' | 'medium' | 'low' | 'abstained';
    minIntentScore?: number;
    maxIntentScore?: number;
    expectedSignals?: string[];
    expectedObjections?: string[];
    isDeliberateGap?: boolean;
    expectedUnresolvedTopics?: string[];
    shouldGenerateDraft: boolean;
    expectedDraftChannel?: 'whatsapp' | 'email' | 'sms' | 'call_task' | 'none';
  };
}

export interface CaseEvaluationResult {
  caseId: string;
  name: string;
  category: ScenarioCategory;
  passed: boolean;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
  metrics: {
    intentBandMatched: boolean;
    intentBandActual: string;
    intentBandExpected: string;
    intentScore: number;
    groundingPassed: boolean;
    gapAbstainedCorrectly: boolean;
    consentComplied: boolean;
    humanApprovalEnforced: boolean;
    signalsPrecision: number;
    signalsRecall: number;
  };
  failures: string[];
}

export interface EvaluationSummary {
  runId: string;
  timestamp: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  overallPassRatePercentage: number;
  qualityGates: {
    intentBandAccuracyPercentage: number;
    factGroundingRatePercentage: number;
    gapAbstentionRatePercentage: number;
    consentCompliancePercentage: number;
    humanApprovalEnforcementPercentage: number;
    allGatesPassed: boolean;
  };
  telemetry: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  results: CaseEvaluationResult[];
}
