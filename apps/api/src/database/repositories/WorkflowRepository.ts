import { randomUUID } from 'node:crypto';
import type { WorkflowRun, WorkflowState, StepState } from './types.js';

export interface CreateWorkflowRunInput {
  orgId: string;
  conversationId: string;
  idempotencyKey: string;
  version?: number;
  state?: WorkflowState;
  stepResults?: Record<string, {
    state: StepState;
    durationMs?: number;
    error?: string;
    skipReason?: string;
    output?: unknown;
  }>;
  resultSummary?: Record<string, unknown>;
  durationMs?: number;
}

export interface UpdateWorkflowRunInput {
  state?: WorkflowState;
  stepResults?: Record<string, {
    state: StepState;
    durationMs?: number;
    error?: string;
    skipReason?: string;
    output?: unknown;
  }>;
  resultSummary?: Record<string, unknown>;
  errorDetail?: string | null;
  durationMs?: number;
}

export interface IWorkflowRepository {
  createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, input: UpdateWorkflowRunInput): Promise<WorkflowRun>;
  getWorkflowRunById(orgId: string, id: string): Promise<WorkflowRun | null>;
  getWorkflowRunByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<WorkflowRun | null>;
  getLatestWorkflowRun(orgId: string, conversationId: string): Promise<WorkflowRun | null>;
  getLatestRunForConversation(orgId: string, conversationId: string): Promise<WorkflowRun | null>;
  listWorkflowRuns(orgId: string, conversationId: string): Promise<WorkflowRun[]>;
}

export class MemoryWorkflowRepository implements IWorkflowRepository {
  private readonly runs = new Map<string, WorkflowRun>();

  async createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRun> {
    const existingForConv = Array.from(this.runs.values()).filter(
      (r) => r.orgId === input.orgId && r.conversationId === input.conversationId
    );
    const version = input.version ?? (existingForConv.length + 1);

    const run: WorkflowRun = {
      id: `wfr-${randomUUID()}`,
      orgId: input.orgId,
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      version,
      state: input.state ?? 'PENDING',
      stepResults: input.stepResults ? { ...input.stepResults } : {},
      resultSummary: input.resultSummary ? { ...input.resultSummary } : {},
      errorDetail: null,
      durationMs: input.durationMs ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.runs.set(run.id, run);
    return { ...run };
  }

  async updateWorkflowRun(id: string, input: UpdateWorkflowRunInput): Promise<WorkflowRun> {
    const run = this.runs.get(id);
    if (!run) {
      throw new Error(`Workflow run not found: ${id}`);
    }

    const updated: WorkflowRun = {
      ...run,
      state: input.state ?? run.state,
      stepResults: input.stepResults ? { ...run.stepResults, ...input.stepResults } : run.stepResults,
      resultSummary: input.resultSummary ? { ...run.resultSummary, ...input.resultSummary } : run.resultSummary,
      errorDetail: input.errorDetail !== undefined ? input.errorDetail : run.errorDetail,
      durationMs: input.durationMs ?? run.durationMs,
      updatedAt: new Date().toISOString(),
    };

    this.runs.set(id, updated);
    return { ...updated };
  }

  async getWorkflowRunById(orgId: string, id: string): Promise<WorkflowRun | null> {
    const run = this.runs.get(id);
    if (!run || run.orgId !== orgId) return null;
    return { ...run };
  }

  async getWorkflowRunByIdempotencyKey(
    orgId: string,
    idempotencyKey: string
  ): Promise<WorkflowRun | null> {
    for (const run of this.runs.values()) {
      if (run.orgId === orgId && run.idempotencyKey === idempotencyKey) {
        return { ...run };
      }
    }
    return null;
  }

  async getLatestWorkflowRun(
    orgId: string,
    conversationId: string
  ): Promise<WorkflowRun | null> {
    const matching = Array.from(this.runs.values())
      .filter((r) => r.orgId === orgId && r.conversationId === conversationId)
      .sort((a, b) => b.version - a.version);

    return matching[0] ? { ...matching[0] } : null;
  }

  async getLatestRunForConversation(
    orgId: string,
    conversationId: string
  ): Promise<WorkflowRun | null> {
    return this.getLatestWorkflowRun(orgId, conversationId);
  }

  async listWorkflowRuns(orgId: string, conversationId: string): Promise<WorkflowRun[]> {
    return Array.from(this.runs.values())
      .filter((r) => r.orgId === orgId && r.conversationId === conversationId)
      .sort((a, b) => b.version - a.version)
      .map((r) => ({ ...r }));
  }
}
