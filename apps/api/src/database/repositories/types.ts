import type { ParsedSegment } from '../../conversations/segmenter.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  orgId: string;
  name: string;
  city: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  category: string;
  priceMin: number;
  priceMax: number;
  attributes: Record<string, unknown>;
  isDemo: boolean;
  createdAt: string;
}

export interface Shopper {
  id: string;
  orgId: string;
  externalCustomerId?: string;
  contactHash?: string;
  anonymousId: string;
  consentFlags: Record<string, boolean>;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  orgId: string;
  subject: string;
  scope: 'audio_recording' | 'transcript_processing' | 'follow_up_contact';
  method: 'verbal' | 'written' | 'digital';
  grantedAt: string;
  revokedAt?: string;
  evidenceNotes?: string;
}

export interface Conversation {
  id: string;
  orgId: string;
  storeId?: string;
  sessionId?: string;
  source: 'transcript_import' | 'audio_upload' | 'mic_recording';
  language: string;
  status: 'ingested' | 'processing' | 'completed' | 'failed';
  retentionUntil?: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transcript {
  id: string;
  orgId: string;
  conversationId: string;
  version: number;
  rawText: string;
  createdAt: string;
}

export interface TranscriptWithSegments extends Transcript {
  segments: ParsedSegment[];
}

export interface ConversationWithTranscript extends Conversation {
  latestTranscript: TranscriptWithSegments | null;
}

export interface FollowUpDraft {
  id: string;
  orgId: string;
  conversationId: string;
  version: number;
  channel: 'email' | 'sms' | 'whatsapp' | 'call_task' | 'none';
  subject: string | null;
  message: string | null;
  factsUsed: Array<{ fact: string; sourceChunkId?: string; sourceSegmentId?: string }>;
  recommendedAction: string;
  reason: string;
  status: 'draft' | 'approved' | 'rejected';
  requiresHumanApproval: boolean;
  blockedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  orgId: string;
  draftId: string;
  decision: 'approved' | 'rejected';
  reviewerId: string;
  reviewerNotes?: string | null;
  createdAt: string;
}

export interface WorkflowEvent {
  id: string;
  orgId: string;
  conversationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type WorkflowState =
  | 'PENDING'
  | 'RETRIEVING'
  | 'ANALYZING'
  | 'FOLLOWUP_PLANNING'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type StepState =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'TIMED_OUT';

export interface WorkflowRun {
  id: string;
  orgId: string;
  conversationId: string;
  idempotencyKey: string;
  version: number;
  state: WorkflowState;
  stepResults: Record<string, {
    state: StepState;
    durationMs?: number;
    error?: string;
    skipReason?: string;
    output?: unknown;
  }>;
  resultSummary: Record<string, unknown>;
  errorDetail?: string | null;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
}

export type ShopperLinkingBasis =
  | 'explicit_customer_id'
  | 'explicit_phone_hash'
  | 'explicit_email_hash'
  | 'anonymous_session';

export interface ConversationShopperLink {
  id: string;
  orgId: string;
  shopperId: string;
  conversationId: string;
  basis: ShopperLinkingBasis;
  authorizer: string;
  createdAt: string;
}

export type OutcomeType = 'purchase' | 'missed_conversion' | 'no_response';

export interface OutcomeRecord {
  id: string;
  orgId: string;
  shopperId?: string;
  conversationId?: string;
  sessionId?: string;
  type: OutcomeType;
  reason?: string;
  value?: number;
  recordedBy: string;
  recordedAt: string;
  createdAt: string;
}

export interface StoreEventRecord {
  id: string;
  orgId: string;
  storeId?: string;
  sessionId?: string;
  shopperId?: string;
  conversationId?: string;
  type: string;
  source: 'agent' | 'manual' | 'csv_import' | 'system';
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  orgId: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ShopperHistoryContext {
  hasAuthorizedHistory: boolean;
  isReturningVisitor: boolean;
  visitCount: number;
  priorInterests: string[];
  unresolvedObjections: string[];
  priorRecommendations: string[];
  lastVisitDate?: string;
}

export interface ShopperProfileView {
  shopper: Shopper;
  isAnonymous: boolean;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  interests: string[];
  pastQuestions: Array<{
    conversationId: string;
    question: string;
    date: string;
  }>;
  unresolvedObjections: Array<{
    conversationId: string;
    objectionType: string;
    customerText: string;
    date: string;
  }>;
  priorRecommendations: Array<{
    conversationId: string;
    recommendation: string;
    date: string;
  }>;
  followUpHistory: Array<{
    draftId: string;
    channel: string;
    status: string;
    recommendedAction: string;
    date: string;
  }>;
  outcomes: OutcomeRecord[];
  hasActiveConsent: boolean;
  notes?: string;
}

export interface UsageEventRecord {
  id: string;
  orgId: string;
  conversationId?: string;
  workflowRunId?: string;
  agent: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costCents: number;
  createdAt: string;
}

export type DemoFilter = 'all' | 'real_only' | 'demo_only';

export interface AnalyticsFilter {
  storeId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  demoFilter?: DemoFilter;
}

export interface OverviewMetrics {
  conversationsProcessed: number;
  uniqueAuthorizedShoppers: number;
  questionsDetected: number;
  objectionsIdentified: number;
  unresolvedQuestions: number;
  followUpDraftsTotal: number;
  pendingApprovals: number;
  recordedConversions: number;
  totalRevenueInr: number;
  conversionRatePercentage: number;
  avgProcessingLatencyMs: number;
  workflowSuccessRatePercentage: number;
  totalAiTokensUsed: number;
  totalAiCostUsd: number;
  sampleSize: number;
  isLowDataState: boolean;
}

export interface ConversationListItem {
  id: string;
  orgId: string;
  storeId: string;
  isDemo: boolean;
  status: string;
  source: string;
  segmentCount: number;
  shopperId?: string;
  externalCustomerId?: string;
  isReturningVisitor: boolean;
  workflowState?: string;
  workflowDurationMs?: number;
  intentScore?: number;
  intentBand?: string;
  createdAt: string;
}

export interface ConversationIntelligenceView {
  conversation: {
    id: string;
    orgId: string;
    storeId: string;
    isDemo: boolean;
    status: string;
    source: string;
    createdAt: string;
  };
  transcript: {
    id: string;
    segments: Array<{
      id: string;
      speaker: string;
      text: string;
      startMs?: number | null;
      endMs?: number | null;
    }>;
  };
  shopper?: {
    id: string;
    externalCustomerId?: string | null;
    isIdentified: boolean;
    visitCount: number;
  } | null;
  intelligence: {
    summary?: string;
    intentScore?: number;
    intentBand?: string;
    intentConfidence?: string;
    questionsDetected: Array<{ question: string; segmentId?: string }>;
    objectionsIdentified: Array<{ objectionType: string; customerQuote: string; segmentId?: string }>;
    unresolvedQuestions: string[];
    suggestedResponses: Array<{ topic: string; response: string; citedChunks?: string[] }>;
    productInterests: Array<{ productRef: string; text: string; basis: string; segmentId?: string }>;
    contributingSignals: Array<{ signalId: string; weight: number; label: string; evidenceQuote?: string; segmentId?: string }>;
  };
  workflow?: {
    id: string;
    state: string;
    durationMs: number;
    stepResults: Record<string, unknown>;
  } | null;
  drafts: Array<{
    id: string;
    channel: string;
    status: string;
    subject?: string | null;
    message?: string | null;
    recommendedAction: string;
  }>;
  outcomes: OutcomeRecord[];
}

export interface ShopperInsightsMetrics {
  totalShoppers: number;
  identifiedShoppers: number;
  anonymousShoppers: number;
  returningVisitors: number;
  intentBandDistribution: Record<'high' | 'medium' | 'low' | 'abstained', number>;
  topProductInterests: Array<{ productRef: string; name: string; count: number }>;
  conversionByVisitorType: {
    firstTimeConversions: number;
    firstTimeTotal: number;
    repeatConversions: number;
    repeatTotal: number;
  };
  sampleSize: number;
}

export interface AgentActivityMetrics {
  totalInvocations: number;
  invocationsByAgent: Record<string, { count: number; successCount: number; failureCount: number; avgLatencyMs: number }>;
  overallSuccessRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  overallCostUsd?: number;
  agents?: Record<
    string,
    {
      invocations: number;
      successful: number;
      failed: number;
      successRatePercentage: number;
      p50LatencyMs: number;
      p95LatencyMs: number;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      totalCostUsd: number;
    }
  >;
  sampleSize: number;
}

export interface FollowUpQueueMetrics {
  totalDrafts: number;
  byStatus: Record<'draft' | 'approved' | 'rejected', number>;
  byChannel: Record<string, number>;
  approvalRatePercentage: number;
  sampleSize: number;
}

export interface StoreConversionInsights {
  frequentObjections: Array<{ type: string; count: number; percentage: number }>;
  frequentUnansweredQuestions: Array<{ question: string; count: number }>;
  missedConversionReasons: Array<{ reason: string; count: number }>;
  totalConversionValueInr: number;
  averageDealValueInr: number;
  sampleSize: number;
  isLowDataWarning: boolean;
}
