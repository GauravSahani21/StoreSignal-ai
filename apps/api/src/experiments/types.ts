export type ExperimentTargetType = 'followup_prompt' | 'rubric_config' | 'channel_strategy';
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type ExperimentEntityType = 'shopper' | 'conversation';
export type ExperimentEventType = 'exposure' | 'send' | 'response' | 'conversion' | 'cost_recorded';

export interface ExperimentEligibilityRules {
  minIntentScore?: number;
  permittedChannels?: string[];
  customerCategories?: string[];
  storeIds?: string[];
}

export interface Experiment {
  id: string;
  orgId: string;
  name: string;
  hypothesis: string;
  targetType: ExperimentTargetType;
  status: ExperimentStatus;
  eligibilityRules: ExperimentEligibilityRules;
  trafficAllocationPct: number; // 0 to 100
  minSampleSize: number; // e.g. 30
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentVariant {
  id: string;
  orgId: string;
  experimentId: string;
  key: string; // 'control', 'variant_a', etc.
  name: string;
  description?: string;
  weight: number; // relative weight e.g. 50
  config: Record<string, unknown>;
  isControl: boolean;
  createdAt: string;
}

export interface ExperimentAssignment {
  id: string;
  orgId: string;
  experimentId: string;
  variantId: string;
  variantKey: string;
  entityType: ExperimentEntityType;
  entityId: string;
  assignedAt: string;
}

export interface ExperimentEvent {
  id: string;
  orgId: string;
  experimentId: string;
  variantId: string;
  assignmentId?: string;
  entityType: ExperimentEntityType;
  entityId: string;
  eventType: ExperimentEventType;
  value?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number; // 0.95
}

export interface VariantMetrics {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  weight: number;
  exposures: number;
  sends: number;
  responses: number;
  conversions: number;
  conversionRate: number; // 0.0 to 1.0
  conversionConfidenceInterval: ConfidenceInterval;
  revenue: number;
  cost: number;
  sampleSizeMet: boolean;
}

export interface VariantComparison {
  variantKey: string;
  controlKey: string;
  conversionRateDiff: number; // variantRate - controlRate
  relativeUpliftPct: number; // ((variant - control) / control) * 100
  zScore: number;
  pValue: number;
  isSignificant: boolean; // pValue < 0.05 && sampleSizeMet
  verdict: 'significant_winner' | 'significant_underperformer' | 'no_significant_difference' | 'insufficient_sample';
}

export interface ExperimentAnalysis {
  experiment: Experiment;
  variants: VariantMetrics[];
  totalExposures: number;
  totalConversions: number;
  overallConversionRate: number;
  minSampleSize: number;
  allVariantsMeetSampleSize: boolean;
  statisticalComparison: {
    controlVariantKey: string;
    comparisons: VariantComparison[];
  } | null;
  winnerDeclared: boolean;
  winningVariantKey: string | null;
  limitationsAndWarnings: string[];
}
