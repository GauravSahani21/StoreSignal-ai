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
