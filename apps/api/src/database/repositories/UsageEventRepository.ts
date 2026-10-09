import { randomUUID } from 'node:crypto';
import type { UsageEventRecord } from './types.js';

export interface IUsageEventRepository {
  recordUsage(event: Omit<UsageEventRecord, 'id' | 'createdAt'>): Promise<UsageEventRecord>;
  listUsage(
    orgId: string,
    filter?: { agent?: string; conversationId?: string; from?: string; to?: string }
  ): Promise<UsageEventRecord[]>;
  getSummary(
    orgId: string,
    filter?: { from?: string; to?: string }
  ): Promise<{
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    count: number;
  }>;
}

export class MemoryUsageEventRepository implements IUsageEventRepository {
  private events: UsageEventRecord[] = [];

  async recordUsage(event: Omit<UsageEventRecord, 'id' | 'createdAt'>): Promise<UsageEventRecord> {
    const record: UsageEventRecord = {
      ...event,
      id: `usage-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.events.push(record);
    return record;
  }

  async listUsage(
    orgId: string,
    filter?: { agent?: string; conversationId?: string; from?: string; to?: string }
  ): Promise<UsageEventRecord[]> {
    return this.events.filter((e) => {
      if (e.orgId !== orgId) return false;
      if (filter?.agent && e.agent !== filter.agent) return false;
      if (filter?.conversationId && e.conversationId !== filter.conversationId) return false;
      if (filter?.from && new Date(e.createdAt) < new Date(filter.from)) return false;
      if (filter?.to && new Date(e.createdAt) > new Date(filter.to)) return false;
      return true;
    });
  }

  async getSummary(
    orgId: string,
    filter?: { from?: string; to?: string }
  ): Promise<{
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    count: number;
  }> {
    const matched = await this.listUsage(orgId, filter);
    if (matched.length === 0) {
      return { totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0, count: 0 };
    }

    const totalTokens = matched.reduce((acc, e) => acc + (e.totalTokens || 0), 0);
    const totalCostCents = matched.reduce((acc, e) => acc + (e.costCents || 0), 0);
    const totalLatency = matched.reduce((acc, e) => acc + (e.latencyMs || 0), 0);

    return {
      totalTokens,
      totalCostUsd: Number((totalCostCents / 100).toFixed(4)),
      avgLatencyMs: Math.round(totalLatency / matched.length),
      count: matched.length,
    };
  }
}
