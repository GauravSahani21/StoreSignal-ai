import crypto from 'node:crypto';
import type { AuditLogRecord } from './types.js';

export interface CreateAuditLogParams {
  orgId: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface IAuditLogRepository {
  recordAudit(params: CreateAuditLogParams): Promise<AuditLogRecord>;
  listAudits(orgId: string, filter?: { action?: string; resource?: string }): Promise<AuditLogRecord[]>;
}

export class MemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLogRecord[] = [];

  async recordAudit(params: CreateAuditLogParams): Promise<AuditLogRecord> {
    const id = `aud-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const entry: AuditLogRecord = {
      id,
      orgId: params.orgId,
      actor: params.actor,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata || {},
      createdAt: now,
    };
    this.logs.push(entry);
    return entry;
  }

  async listAudits(
    orgId: string,
    filter?: { action?: string; resource?: string }
  ): Promise<AuditLogRecord[]> {
    return this.logs
      .filter((l) => {
        if (l.orgId !== orgId) return false;
        if (filter?.action && l.action !== filter.action) return false;
        if (filter?.resource && l.resource !== filter.resource) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
