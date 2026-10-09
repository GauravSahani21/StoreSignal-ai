import crypto from 'node:crypto';
import type { OutcomeRecord, OutcomeType } from './types.js';

export interface CreateOutcomeParams {
  orgId: string;
  shopperId?: string;
  conversationId?: string;
  sessionId?: string;
  type: OutcomeType;
  reason?: string;
  value?: number;
  recordedBy: string;
  recordedAt?: string;
}

export interface IOutcomeRepository {
  createOutcome(params: CreateOutcomeParams): Promise<OutcomeRecord>;
  getOutcomesForShopper(orgId: string, shopperId: string): Promise<OutcomeRecord[]>;
  getOutcomesForConversation(orgId: string, conversationId: string): Promise<OutcomeRecord[]>;
  listOutcomes(orgId: string): Promise<OutcomeRecord[]>;
  deleteOutcomesForShopper(orgId: string, shopperId: string): Promise<number>;
}

export class MemoryOutcomeRepository implements IOutcomeRepository {
  private outcomes: Map<string, OutcomeRecord> = new Map();

  async createOutcome(params: CreateOutcomeParams): Promise<OutcomeRecord> {
    const id = `out-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const outcome: OutcomeRecord = {
      id,
      orgId: params.orgId,
      shopperId: params.shopperId,
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      type: params.type,
      reason: params.reason,
      value: params.value,
      recordedBy: params.recordedBy,
      recordedAt: params.recordedAt || now,
      createdAt: now,
    };
    this.outcomes.set(id, outcome);
    return outcome;
  }

  async getOutcomesForShopper(orgId: string, shopperId: string): Promise<OutcomeRecord[]> {
    return Array.from(this.outcomes.values())
      .filter((o) => o.orgId === orgId && o.shopperId === shopperId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getOutcomesForConversation(orgId: string, conversationId: string): Promise<OutcomeRecord[]> {
    return Array.from(this.outcomes.values())
      .filter((o) => o.orgId === orgId && o.conversationId === conversationId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async listOutcomes(orgId: string): Promise<OutcomeRecord[]> {
    return Array.from(this.outcomes.values())
      .filter((o) => o.orgId === orgId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async deleteOutcomesForShopper(orgId: string, shopperId: string): Promise<number> {
    let count = 0;
    for (const [key, outcome] of this.outcomes.entries()) {
      if (outcome.orgId === orgId && outcome.shopperId === shopperId) {
        this.outcomes.delete(key);
        count++;
      }
    }
    return count;
  }
}
