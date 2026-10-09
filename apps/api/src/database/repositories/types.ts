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
