import crypto from 'node:crypto';
import type { ConsentRecord } from './types.js';

export interface RecordConsentParams {
  orgId: string;
  subject: string;
  scope: ConsentRecord['scope'];
  method: ConsentRecord['method'];
  evidenceNotes?: string;
}

export interface IConsentRepository {
  recordConsent(params: RecordConsentParams): Promise<ConsentRecord>;
  hasActiveConsent(orgId: string, subject: string, scope: ConsentRecord['scope']): Promise<boolean>;
  getConsentRecord(orgId: string, subject: string, scope: ConsentRecord['scope']): Promise<ConsentRecord | null>;
  revokeConsent(orgId: string, subject: string, scope: ConsentRecord['scope']): Promise<void>;
}

export class MemoryConsentRepository implements IConsentRepository {
  private records: Map<string, ConsentRecord> = new Map();

  async recordConsent(params: RecordConsentParams): Promise<ConsentRecord> {
    const id = `cns-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const record: ConsentRecord = {
      id,
      orgId: params.orgId,
      subject: params.subject,
      scope: params.scope,
      method: params.method,
      grantedAt: now,
      evidenceNotes: params.evidenceNotes,
    };
    this.records.set(id, record);
    return record;
  }

  async hasActiveConsent(orgId: string, subject: string, scope: ConsentRecord['scope']): Promise<boolean> {
    const record = await this.getConsentRecord(orgId, subject, scope);
    return Boolean(record && !record.revokedAt);
  }

  async getConsentRecord(
    orgId: string,
    subject: string,
    scope: ConsentRecord['scope']
  ): Promise<ConsentRecord | null> {
    for (const record of this.records.values()) {
      if (record.orgId === orgId && record.subject === subject && record.scope === scope && !record.revokedAt) {
        return record;
      }
    }
    return null;
  }

  async revokeConsent(orgId: string, subject: string, scope: ConsentRecord['scope']): Promise<void> {
    for (const record of this.records.values()) {
      if (record.orgId === orgId && record.subject === subject && record.scope === scope) {
        record.revokedAt = new Date().toISOString();
      }
    }
  }
}
