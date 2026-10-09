import crypto from 'node:crypto';
import type { StoreEventRecord } from './types.js';

export interface EmitStoreEventParams {
  orgId: string;
  storeId?: string;
  sessionId?: string;
  shopperId?: string;
  conversationId?: string;
  type: string;
  source: 'agent' | 'manual' | 'csv_import' | 'system';
  metadata?: Record<string, unknown>;
}

export interface IStoreEventRepository {
  emitEvent(params: EmitStoreEventParams): Promise<StoreEventRecord>;
  listEvents(orgId: string, filter?: { type?: string; shopperId?: string; conversationId?: string }): Promise<StoreEventRecord[]>;
}

export class MemoryStoreEventRepository implements IStoreEventRepository {
  private events: StoreEventRecord[] = [];

  async emitEvent(params: EmitStoreEventParams): Promise<StoreEventRecord> {
    const id = `evt-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const event: StoreEventRecord = {
      id,
      orgId: params.orgId,
      storeId: params.storeId,
      sessionId: params.sessionId,
      shopperId: params.shopperId,
      conversationId: params.conversationId,
      type: params.type,
      source: params.source,
      metadata: params.metadata || {},
      createdAt: now,
    };
    this.events.push(event);
    return event;
  }

  async listEvents(
    orgId: string,
    filter?: { type?: string; shopperId?: string; conversationId?: string }
  ): Promise<StoreEventRecord[]> {
    return this.events
      .filter((e) => {
        if (e.orgId !== orgId) return false;
        if (filter?.type && e.type !== filter.type) return false;
        if (filter?.shopperId && e.shopperId !== filter.shopperId) return false;
        if (filter?.conversationId && e.conversationId !== filter.conversationId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
