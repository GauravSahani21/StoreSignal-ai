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
