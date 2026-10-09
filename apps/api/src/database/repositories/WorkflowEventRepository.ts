import { randomUUID } from 'node:crypto';
import type { WorkflowEvent } from './types.js';

export interface RecordEventInput {
  orgId: string;
  conversationId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export interface IWorkflowEventRepository {
  recordEvent(input: RecordEventInput): Promise<WorkflowEvent>;
  getEventsByConversation(orgId: string, conversationId: string): Promise<WorkflowEvent[]>;
}

export class MemoryWorkflowEventRepository implements IWorkflowEventRepository {
  private readonly events: WorkflowEvent[] = [];

  async recordEvent(input: RecordEventInput): Promise<WorkflowEvent> {
    const event: WorkflowEvent = {
      id: randomUUID(),
      orgId: input.orgId,
      conversationId: input.conversationId,
      eventType: input.eventType,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return { ...event };
  }

  async getEventsByConversation(
    orgId: string,
    conversationId: string
  ): Promise<WorkflowEvent[]> {
    return this.events
      .filter((e) => e.orgId === orgId && e.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((e) => ({ ...e }));
  }
}
