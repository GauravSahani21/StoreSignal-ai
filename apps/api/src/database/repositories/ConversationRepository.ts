import crypto from 'node:crypto';
import type { ParsedSegment } from '../../conversations/segmenter.js';
import type {
  Conversation,
  ConversationWithTranscript,
  TranscriptWithSegments,
} from './types.js';

export interface CreateConversationParams {
  orgId: string;
  sessionId?: string;
  source: 'transcript_import' | 'audio_upload' | 'mic_recording';
  language?: string;
  status?: 'ingested' | 'processing' | 'completed' | 'failed';
  retentionUntil?: string;
  isDemo?: boolean;
}

export interface CreateTranscriptParams {
  orgId: string;
  conversationId: string;
  version: number;
  rawText: string;
  segments: ParsedSegment[];
}

export interface IConversationRepository {
  createConversation(params: CreateConversationParams): Promise<Conversation>;
  createTranscriptWithSegments(params: CreateTranscriptParams): Promise<TranscriptWithSegments>;
  getConversationById(orgId: string, id: string): Promise<ConversationWithTranscript | null>;
  listConversations(
    orgId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<{ items: Conversation[]; total: number }>;
  updateConversationStatus(orgId: string, id: string, status: Conversation['status']): Promise<void>;
}

export class MemoryConversationRepository implements IConversationRepository {
  private conversations: Map<string, Conversation> = new Map();
  private transcripts: Map<string, TranscriptWithSegments> = new Map();

  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const id = `conv-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      orgId: params.orgId,
      sessionId: params.sessionId,
      source: params.source,
      language: params.language || 'en',
      status: params.status || 'ingested',
      retentionUntil: params.retentionUntil,
      isDemo: Boolean(params.isDemo),
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async createTranscriptWithSegments(params: CreateTranscriptParams): Promise<TranscriptWithSegments> {
    const conv = this.conversations.get(params.conversationId);
    if (!conv || conv.orgId !== params.orgId) {
      throw new Error(`Conversation not found in organization ${params.orgId}`);
    }

    const id = `trn-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const transcript: TranscriptWithSegments = {
      id,
      orgId: params.orgId,
      conversationId: params.conversationId,
      version: params.version,
      rawText: params.rawText,
      segments: params.segments,
      createdAt: now,
    };
    this.transcripts.set(id, transcript);
    return transcript;
  }

  async getConversationById(orgId: string, id: string): Promise<ConversationWithTranscript | null> {
    const conv = this.conversations.get(id);
    if (!conv || conv.orgId !== orgId) {
      return null;
    }

    // Find latest transcript for this conversation
    let latestTranscript: TranscriptWithSegments | null = null;
    for (const trn of this.transcripts.values()) {
      if (trn.conversationId === id && trn.orgId === orgId) {
        if (!latestTranscript || trn.version > latestTranscript.version) {
          latestTranscript = trn;
        }
      }
    }

    return {
      ...conv,
      latestTranscript,
    };
  }

  async listConversations(
    orgId: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<{ items: Conversation[]; total: number }> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const filtered = Array.from(this.conversations.values())
      .filter((c) => c.orgId === orgId)
      .filter((c) => (options.status ? c.status === options.status : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const items = filtered.slice(offset, offset + limit);
    return { items, total: filtered.length };
  }

  async updateConversationStatus(
    orgId: string,
    id: string,
    status: Conversation['status']
  ): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv || conv.orgId !== orgId) {
      throw new Error(`Conversation not found in organization ${orgId}`);
    }
    conv.status = status;
    conv.updatedAt = new Date().toISOString();
  }
}
