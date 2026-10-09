import { randomUUID } from 'node:crypto';
import type { FollowUpDraft, ApprovalRecord } from './types.js';
import { InvalidStateTransitionError, NotFoundError } from '../../errors/AppError.js';

export interface CreateDraftInput {
  orgId: string;
  conversationId: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call_task' | 'none';
  subject?: string | null;
  message?: string | null;
  factsUsed: Array<{ fact: string; sourceChunkId?: string; sourceSegmentId?: string }>;
  recommendedAction: string;
  reason: string;
  blockedReason?: string | null;
}

export interface IDraftRepository {
  createDraft(input: CreateDraftInput): Promise<FollowUpDraft>;
  getDraftById(orgId: string, id: string): Promise<FollowUpDraft | null>;
  getDraftsByConversation(orgId: string, conversationId: string): Promise<FollowUpDraft[]>;
  updateDraft(
    orgId: string,
    id: string,
    updates: { subject?: string | null; message?: string | null }
  ): Promise<FollowUpDraft>;
  recordApproval(input: {
    orgId: string;
    draftId: string;
    decision: 'approved' | 'rejected';
    reviewerId: string;
    reviewerNotes?: string | null;
  }): Promise<{ draft: FollowUpDraft; approvalRecord: ApprovalRecord }>;
  getApprovalsForDraft(orgId: string, draftId: string): Promise<ApprovalRecord[]>;
}

export class MemoryDraftRepository implements IDraftRepository {
  private readonly drafts = new Map<string, FollowUpDraft>();
  private readonly approvals: ApprovalRecord[] = [];

  async createDraft(input: CreateDraftInput): Promise<FollowUpDraft> {
    const existing = Array.from(this.drafts.values()).filter(
      (d) => d.orgId === input.orgId && d.conversationId === input.conversationId
    );
    const version = existing.length + 1;

    const draft: FollowUpDraft = {
      id: randomUUID(),
      orgId: input.orgId,
      conversationId: input.conversationId,
      version,
      channel: input.channel,
      subject: input.subject ?? null,
      message: input.message ?? null,
      factsUsed: input.factsUsed,
      recommendedAction: input.recommendedAction,
      reason: input.reason,
      status: 'draft',
      requiresHumanApproval: true,
      blockedReason: input.blockedReason ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.drafts.set(draft.id, draft);
    return { ...draft };
  }

  async getDraftById(orgId: string, id: string): Promise<FollowUpDraft | null> {
    const draft = this.drafts.get(id);
    if (!draft || draft.orgId !== orgId) return null;
    return { ...draft };
  }

  async getDraftsByConversation(
    orgId: string,
    conversationId: string
  ): Promise<FollowUpDraft[]> {
    return Array.from(this.drafts.values())
      .filter((d) => d.orgId === orgId && d.conversationId === conversationId)
      .sort((a, b) => b.version - a.version)
      .map((d) => ({ ...d }));
  }

  async updateDraft(
    orgId: string,
    id: string,
    updates: { subject?: string | null; message?: string | null }
  ): Promise<FollowUpDraft> {
    const draft = this.drafts.get(id);
    if (!draft || draft.orgId !== orgId) {
      throw new NotFoundError(`Draft not found with ID ${id}`);
    }

    if (draft.status !== 'draft') {
      throw new InvalidStateTransitionError(
        `Cannot edit draft with status "${draft.status}". Only drafts in "draft" status can be modified.`
      );
    }

    const updated: FollowUpDraft = {
      ...draft,
      subject: updates.subject !== undefined ? updates.subject : draft.subject,
      message: updates.message !== undefined ? updates.message : draft.message,
      updatedAt: new Date().toISOString(),
    };

    this.drafts.set(id, updated);
    return { ...updated };
  }

  async recordApproval(input: {
    orgId: string;
    draftId: string;
    decision: 'approved' | 'rejected';
    reviewerId: string;
    reviewerNotes?: string | null;
  }): Promise<{ draft: FollowUpDraft; approvalRecord: ApprovalRecord }> {
    const draft = this.drafts.get(input.draftId);
    if (!draft || draft.orgId !== input.orgId) {
      throw new NotFoundError(`Draft not found with ID ${input.draftId}`);
    }

    if (draft.status !== 'draft') {
      throw new InvalidStateTransitionError(
        `Cannot transition draft with status "${draft.status}" to "${input.decision}". Draft has already been finalized.`
      );
    }

    // State transition: draft -> approved | rejected
    const updatedDraft: FollowUpDraft = {
      ...draft,
      status: input.decision,
      updatedAt: new Date().toISOString(),
    };
    this.drafts.set(draft.id, updatedDraft);

    const approvalRecord: ApprovalRecord = {
      id: randomUUID(),
      orgId: input.orgId,
      draftId: input.draftId,
      decision: input.decision,
      reviewerId: input.reviewerId,
      reviewerNotes: input.reviewerNotes ?? null,
      createdAt: new Date().toISOString(),
    };
    this.approvals.push(approvalRecord);

    // CRITICAL GOVERNANCE ASSIGNMENT (§Phase 8):
    // Zero automated send path. This method purely updates records in DB and DOES NOT invoke any external messaging API.

    return {
      draft: { ...updatedDraft },
      approvalRecord: { ...approvalRecord },
    };
  }

  async getApprovalsForDraft(orgId: string, draftId: string): Promise<ApprovalRecord[]> {
    return this.approvals
      .filter((a) => a.orgId === orgId && a.draftId === draftId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => ({ ...a }));
  }
}
