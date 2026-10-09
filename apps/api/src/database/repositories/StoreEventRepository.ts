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
  recordEvent(params: EmitStoreEventParams): Promise<StoreEventRecord>;
  listEvents(
    orgId: string,
    filter?: {
      type?: string;
      shopperId?: string;
      conversationId?: string;
      storeId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<StoreEventRecord[]>;
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

  async recordEvent(params: EmitStoreEventParams): Promise<StoreEventRecord> {
    return this.emitEvent(params);
  }

  async listEvents(
    orgId: string,
    filter?: {
      type?: string;
      shopperId?: string;
      conversationId?: string;
      storeId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<StoreEventRecord[]> {
    return this.events
      .filter((e) => {
        if (e.orgId !== orgId) return false;
        if (filter?.type && e.type !== filter.type) return false;
        if (filter?.shopperId && e.shopperId !== filter.shopperId) return false;
        if (filter?.conversationId && e.conversationId !== filter.conversationId) return false;
        if (filter?.storeId && e.storeId !== filter.storeId) return false;
        if (filter?.from && new Date(e.createdAt) < new Date(filter.from)) return false;
        if (filter?.to && new Date(e.createdAt) > new Date(filter.to)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
