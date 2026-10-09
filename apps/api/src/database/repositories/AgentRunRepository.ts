import crypto from 'node:crypto';

export interface AgentRunRecord {
  id: string;
  orgId: string;
  conversationId: string;
  agentName: 'floor_coach' | 'signal_analyst' | 'followup_optimizer';
  state: 'succeeded' | 'failed' | 'partial';
  modelUsed: string;
  promptVersion: string;
  durationMs: number;
  retries: number;
  validationResults: Record<string, unknown>[];
  outputJson: Record<string, unknown>;
  createdAt: string;
}

export interface IAgentRunRepository {
  saveAgentRun(run: Omit<AgentRunRecord, 'id' | 'createdAt'>): Promise<AgentRunRecord>;
  getLatestAgentRun(
    orgId: string,
    conversationId: string,
    agentName: AgentRunRecord['agentName']
  ): Promise<AgentRunRecord | null>;
  listAgentRuns(orgId: string, conversationId: string): Promise<AgentRunRecord[]>;
}

export class MemoryAgentRunRepository implements IAgentRunRepository {
  private runs: Map<string, AgentRunRecord> = new Map();

  async saveAgentRun(run: Omit<AgentRunRecord, 'id' | 'createdAt'>): Promise<AgentRunRecord> {
    const id = `run-${crypto.randomUUID()}`;
    const record: AgentRunRecord = {
      id,
      ...run,
      createdAt: new Date().toISOString(),
    };
    this.runs.set(id, record);
    return record;
  }

  async getLatestAgentRun(
    orgId: string,
    conversationId: string,
    agentName: AgentRunRecord['agentName']
  ): Promise<AgentRunRecord | null> {
    const matching = Array.from(this.runs.values())
      .filter((r) => r.orgId === orgId && r.conversationId === conversationId && r.agentName === agentName)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return matching[0] || null;
  }

  async listAgentRuns(orgId: string, conversationId: string): Promise<AgentRunRecord[]> {
    return Array.from(this.runs.values())
      .filter((r) => r.orgId === orgId && r.conversationId === conversationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
