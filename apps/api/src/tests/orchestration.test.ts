import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createRepositories } from '../database/repositories/index.js';
import { segmentTranscript } from '../conversations/segmenter.js';
import { OrchestratorEngine } from '../orchestration/OrchestratorEngine.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import type { AIProvider, AIRequest, AIResponse } from '../providers/ai/types.js';
import type { FloorCoachOutput } from '../agents/floorcoach/schema.js';
import type { SignalAnalystOutput } from '../agents/signalanalyst/schema.js';
import type { FollowUpOutput } from '../agents/followup/schema.js';

describe('Multi-Agent Orchestration Engine (Phase 9)', () => {
  const sampleTranscriptText = `[00:00:03] Advisor: Namaste! Welcome to Vayu Motors. Looking for a commuter bike today?\n[00:00:09] Customer: Yes, I need a high mileage bike for daily commute to Whitefield. What is the mileage of Prithvi 110?\n[00:00:16] Advisor: The Prithvi 110 gives 68 kmpl mileage.\n[00:00:23] Customer: Great. My budget is around 75,000 and I want to buy this week. Can you share EMI options?`;
  const segments = segmentTranscript(sampleTranscriptText);

  const mockCoachOutput: FloorCoachOutput = {
    items: [
      {
        customerQuestion: 'What is the mileage of Prithvi 110?',
        evidence: [{ segmentId: segments[1]!.id, quote: 'mileage of Prithvi 110' }],
        objectionType: 'fuel_efficiency',
        suggestedResponse: 'The Prithvi 110 delivers 68 kmpl real-world mileage.',
        supportingSources: [{ chunkId: 'chk-1' }],
        answerStatus: 'answered_from_knowledge',
        nextStep: 'Offer test ride',
      },
    ],
    unresolved: [],
  };

  const mockAnalystOutput: SignalAnalystOutput = {
    summary: 'Customer looking for commuter bike with good mileage and EMI financing.',
    productInterests: [
      {
        productRef: 'v-prithvi-110',
        text: 'Prithvi 110',
        basis: 'explicit',
        evidence: [{ segmentId: segments[1]!.id, quote: 'Prithvi 110' }],
      },
    ],
    preferences: [
      {
        text: 'high mileage bike for daily commute',
        basis: 'explicit',
        evidence: [{ segmentId: segments[1]!.id, quote: 'high mileage bike for daily commute' }],
      },
    ],
    budget: {
      value: '₹75,000',
      basis: 'explicit',
      evidence: [{ segmentId: segments[3]!.id, quote: 'budget is around 75,000' }],
    },
    timeline: {
      value: 'this week',
      basis: 'explicit',
      evidence: [{ segmentId: segments[3]!.id, quote: 'buy this week' }],
    },
    competitorMentions: [],
    objections: [],
    unresolvedQuestions: [],
    intentSignals: [
      {
        signalId: 'asked_financing',
        present: true,
        evidence: [{ segmentId: segments[3]!.id, quote: 'EMI options' }],
      },
      {
        signalId: 'stated_timeline_near_term',
        present: true,
        evidence: [{ segmentId: segments[3]!.id, quote: 'buy this week' }],
      },
    ],
    missedConversionHypotheses: [],
    recommendedNextAction: 'Share Prithvi 110 EMI calculations and test ride booking',
  };

  const mockFollowUpOutput: FollowUpOutput = {
    recommendedAction: 'Send WhatsApp message with EMI calculations',
    reason: 'Customer inquired about Prithvi 110 within budget and timeline',
    channel: 'whatsapp',
    subject: null,
    message: 'Hello! Thank you for visiting Vayu Motors. The Prithvi 110 delivers 68 kmpl mileage. Let us know if you would like to book a test ride this week!',
    factsUsed: [{ fact: 'Prithvi 110 delivers 68 kmpl mileage', sourceChunkId: 'chk-1' }],
    status: 'draft',
    requiresHumanApproval: true,
    blockedReason: null,
  };

  function createMockAiProvider(overrides?: {
    failCoach?: boolean;
    failAnalyst?: boolean;
    failFollowUp?: boolean;
  }): AIProvider {
    return {
      async generate(req: AIRequest): Promise<AIResponse> {
        const sysMsg = req.messages.find((m) => m.role === 'system')?.content || '';
        const userMsg = req.messages.find((m) => m.role === 'user')?.content || '';

        // Dynamically find chunk ID from prompt
        const chunkMatch =
          userMsg.match(/CHUNK ID:\s*([^\s|]+)/i) ||
          userMsg.match(/\[Chunk \d+ \| ID:\s*([^\s\]]+)\]/i);
        const chunkId = chunkMatch?.[1] || 'chk-1';

        if (sysMsg.includes('You are FollowUpOptimizer')) {
          if (overrides?.failFollowUp) throw new Error('Injected FollowUpOptimizer failure');
          const followUpWithChunk: FollowUpOutput = {
            ...mockFollowUpOutput,
            factsUsed: [{ fact: 'Prithvi 110 delivers 68 kmpl mileage', sourceChunkId: chunkId }],
          };
          return {
            content: JSON.stringify(followUpWithChunk),
            model: 'mock-flash',
            finishReason: 'stop',
            usage: null,
            latencyMs: 40,
          };
        }

        if (sysMsg.includes('You are FloorCoach')) {
          if (overrides?.failCoach) throw new Error('Injected FloorCoach failure');
          const coachWithChunk: FloorCoachOutput = {
            ...mockCoachOutput,
            items: mockCoachOutput.items.map((it) => ({
              ...it,
              supportingSources: [{ chunkId, filename: 'prithvi-specs.md' }],
            })),
          };
          return {
            content: JSON.stringify(coachWithChunk),
            model: 'mock-flash',
            finishReason: 'stop',
            usage: null,
            latencyMs: 40,
          };
        }

        if (sysMsg.includes('You are SignalAnalyst')) {
          if (overrides?.failAnalyst) throw new Error('Injected SignalAnalyst failure');
          return {
            content: JSON.stringify(mockAnalystOutput),
            model: 'mock-flash',
            finishReason: 'stop',
            usage: null,
            latencyMs: 40,
          };
        }

        return { content: '{}', model: 'mock-flash', finishReason: 'stop', usage: null, latencyMs: 10 };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };
  }

  async function setupTestEnvironment(aiProvider: AIProvider) {
    const repos = createRepositories();
    const embedding = new MockEmbeddingProvider();
    const store = new KnowledgeStore(embedding);

    // Seed dummy chunk for grounding
    await store.addDocument({
      orgId: 'org-vayu-motors-dev',
      filename: 'prithvi-specs.md',
      fileType: 'md',
      content: 'Prithvi 110 delivers 68 kmpl mileage and on-road price starts at ₹72,000.',
    });

    const retrievalService = new RetrievalService(store, embedding);

    // Create conversation and segments
    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'transcript_import',
      sessionId: 'session-e2e-1',
    });

    await repos.conversations.createTranscriptWithSegments({
      orgId: 'org-vayu-motors-dev',
      conversationId: conv.id,
      version: 1,
      rawText: sampleTranscriptText,
      segments,
    });

    // Grant follow_up_contact consent
    await repos.consents.recordConsent({
      orgId: 'org-vayu-motors-dev',
      subject: 'session-e2e-1',
      scope: 'follow_up_contact',
      method: 'verbal',
    });

    const engine = new OrchestratorEngine({
      repositories: repos,
      aiProvider,
      retrievalService,
    });

    return { repos, engine, conv, store, retrievalService };
  }

  it('Happy Path: processes full conversation, transitions states, and ends in AWAITING_APPROVAL', async () => {
    const aiProvider = createMockAiProvider();
    const { engine, conv, repos } = await setupTestEnvironment(aiProvider);

    const run = await engine.processConversation({
      conversationId: conv.id,
      permittedChannels: ['whatsapp'],
    });

    expect(run.state).toBe('AWAITING_APPROVAL');
    expect(run.stepResults['retrieval']?.state).toBe('SUCCEEDED');
    expect(run.stepResults['floor_coach']?.state).toBe('SUCCEEDED');
    expect(run.stepResults['signal_analyst']?.state).toBe('SUCCEEDED');
    expect(run.stepResults['followup_optimizer']?.state).toBe('SUCCEEDED');

    // Verify trace events
    const events = await repos.workflowEvents.getEventsByConversation('org-vayu-motors-dev', conv.id);
    const eventTypes = events.map((e) => e.eventType);

    expect(eventTypes).toContain('WORKFLOW_STARTED');
    expect(eventTypes).toContain('RETRIEVAL_STARTED');
    expect(eventTypes).toContain('RETRIEVAL_COMPLETED');
    expect(eventTypes).toContain('ANALYSIS_STARTED');
    expect(eventTypes).toContain('FLOORCOACH_COMPLETED');
    expect(eventTypes).toContain('SIGNALANALYST_COMPLETED');
    expect(eventTypes).toContain('FOLLOWUP_STARTED');
    expect(eventTypes).toContain('FOLLOW_UP_DRAFTED');
    expect(eventTypes).toContain('WORKFLOW_AWAITING_APPROVAL');
  });

  it('Dependency Order: skips FollowUpOptimizer when SignalAnalyst fails, ending in PARTIAL', async () => {
    const aiProvider = createMockAiProvider({ failAnalyst: true });
    const { engine, conv, repos } = await setupTestEnvironment(aiProvider);

    const run = await engine.processConversation({
      conversationId: conv.id,
      permittedChannels: ['whatsapp'],
    });

    expect(run.state).toBe('PARTIAL');
    expect(run.stepResults['floor_coach']?.state).toBe('SUCCEEDED');
    expect(run.stepResults['signal_analyst']?.state).toBe('FAILED');
    expect(run.stepResults['followup_optimizer']?.state).toBe('SKIPPED');
    expect(run.stepResults['followup_optimizer']?.skipReason).toContain('missing_dependency');

    const events = await repos.workflowEvents.getEventsByConversation('org-vayu-motors-dev', conv.id);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain('FOLLOWUP_SKIPPED');
    expect(eventTypes).toContain('WORKFLOW_PARTIAL');
  });

  it('Fault Tolerance: continues when FloorCoach fails, ending in PARTIAL', async () => {
    const aiProvider = createMockAiProvider({ failCoach: true });
    const { engine, conv } = await setupTestEnvironment(aiProvider);

    const run = await engine.processConversation({
      conversationId: conv.id,
      permittedChannels: ['whatsapp'],
    });

    expect(run.state).toBe('PARTIAL');
    expect(run.stepResults['floor_coach']?.state).toBe('FAILED');
    expect(run.stepResults['signal_analyst']?.state).toBe('SUCCEEDED');
    expect(run.stepResults['followup_optimizer']?.state).toBe('SUCCEEDED');
  });

  it('Idempotency: duplicate submissions with same idempotency key return cached run without re-executing', async () => {
    let callCount = 0;
    const baseProvider = createMockAiProvider();
    const countingProvider: AIProvider = {
      async generate(req) {
        callCount++;
        return baseProvider.generate(req);
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const { engine, conv } = await setupTestEnvironment(countingProvider);

    // First run
    const run1 = await engine.processConversation({ conversationId: conv.id });
    const callsAfterFirst = callCount;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Second run with same idempotency key
    const run2 = await engine.processConversation({ conversationId: conv.id });

    // Must return the exact same run and NOT make any additional AI calls
    expect(run2.id).toBe(run1.id);
    expect(callCount).toBe(callsAfterFirst);
  });

  it('Re-run action: explicit forceReRun creates a new versioned run (version 2)', async () => {
    const aiProvider = createMockAiProvider();
    const { engine, conv } = await setupTestEnvironment(aiProvider);

    const run1 = await engine.processConversation({ conversationId: conv.id });
    expect(run1.version).toBe(1);

    const run2 = await engine.processConversation({ conversationId: conv.id, forceReRun: true });
    expect(run2.version).toBe(2);
    expect(run2.id).not.toBe(run1.id);
  });

  it('Concurrency Lock: rejects concurrent execution attempts with ConflictError', async () => {
    let unblockSignal: () => void = () => {};
    const delayPromise = new Promise<void>((resolve) => {
      unblockSignal = resolve;
    });

    const slowAiProvider: AIProvider = {
      async generate(req: AIRequest): Promise<AIResponse> {
        await delayPromise;
        return { content: '{}', model: 'mock', finishReason: 'stop', usage: null, latencyMs: 10 };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const { engine, conv } = await setupTestEnvironment(slowAiProvider);

    // Start background process that hangs on delayPromise
    const firstProcessPromise = engine.processConversation({ conversationId: conv.id, forceReRun: true });

    // Immediately attempt a second concurrent process
    await expect(
      engine.processConversation({ conversationId: conv.id, forceReRun: true })
    ).rejects.toThrowError('Concurrent execution is locked');

    // Unblock the first process
    unblockSignal();
    await firstProcessPromise;
  });

  it('Fastify endpoint POST /api/conversations/:id/process runs full flow end-to-end', async () => {
    const aiProvider = createMockAiProvider();
    const { repos, conv, store, retrievalService } = await setupTestEnvironment(aiProvider);

    const app = await buildApp({
      repositories: repos,
      aiProvider,
      knowledgeStore: store,
      retrievalService,
      skipAutoSeed: true,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/process`,
      payload: { permittedChannels: ['whatsapp'] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflowRun).toBeDefined();
    expect(body.workflowRun.state).toBe('AWAITING_APPROVAL');

    // Fetch workflow trace via GET /api/conversations/:id/trace
    const traceRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/trace`,
    });
    expect(traceRes.statusCode).toBe(200);
    const traceBody = JSON.parse(traceRes.body);
    expect(traceBody.latestRun.id).toBe(body.workflowRun.id);
    expect(traceBody.events.length).toBeGreaterThan(5);
  });
});
