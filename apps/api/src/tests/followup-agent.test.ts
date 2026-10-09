import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FollowUpOptimizerAgent } from '../agents/followup/FollowUpOptimizerAgent.js';
import type { FollowUpOutput } from '../agents/followup/schema.js';
import type { SignalAnalystOutput } from '../agents/signalanalyst/schema.js';
import { segmentTranscript } from '../conversations/segmenter.js';
import { createRepositories } from '../database/repositories/index.js';
import { buildApp } from '../app.js';
import type { AIProvider, AIRequest, AIResponse } from '../providers/ai/types.js';

describe('FollowUpOptimizer Agent & Governed Drafts (Phase 8)', () => {
  const sampleAnalystOutput: SignalAnalystOutput = {
    summary: 'Customer inquired about Prithvi 110 commuter motorcycle and financing.',
    productInterests: [
      {
        productRef: 'v-prithvi-110',
        text: 'Prithvi 110',
        basis: 'explicit',
        evidence: [{ segmentId: 'seg-1-0-cust', quote: 'I am interested in buying the Prithvi 110' }],
      },
    ],
    preferences: [
      {
        text: 'High mileage commuter',
        basis: 'explicit',
        evidence: [{ segmentId: 'seg-1-0-cust', quote: 'need good mileage for daily commute' }],
      },
    ],
    budget: {
      value: '₹75,000',
      basis: 'explicit',
      evidence: [{ segmentId: 'seg-1-0-cust', quote: 'budget is around 75,000' }],
    },
    timeline: {
      value: 'this week',
      basis: 'explicit',
      evidence: [{ segmentId: 'seg-1-0-cust', quote: 'this week' }],
    },
    competitorMentions: [],
    objections: [],
    unresolvedQuestions: [],
    intentSignals: [
      {
        signalId: 'asked_financing',
        present: true,
        evidence: [{ segmentId: 'seg-1-0-cust', quote: 'EMI options' }],
      },
    ],
    missedConversionHypotheses: [],
    recommendedNextAction: 'Share Prithvi 110 brochure and monthly EMI estimate under ₹2,500',
  };

  const sampleSegments = segmentTranscript(
    '[00:00:02] Customer: I am interested in buying the Prithvi 110 this week. My budget is around 75,000 and I need good mileage for daily commute. What are the EMI options?'
  );

  const sampleKnowledgeChunks = [
    {
      chunkId: 'chunk-p110-spec',
      documentId: 'doc-p110',
      content: 'Prithvi 110 delivers 68 kmpl mileage with on-road price starting at ₹72,000. EMI starts from ₹2,100 per month.',
      locationMetadata: {},
    },
  ];

  it('mandates channel: none and blockedReason: no_consent when customer consent is missing', async () => {
    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        throw new Error('AI Provider should not be called when consent is absent');
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const agent = new FollowUpOptimizerAgent({ aiProvider: mockAiProvider });
    const result = await agent.run({
      analystOutput: sampleAnalystOutput,
      hasConsent: false,
      permittedChannels: [],
      retrievedChunks: sampleKnowledgeChunks,
      customerSegments: sampleSegments,
    });

    expect(result.output.channel).toBe('none');
    expect(result.output.message).toBeNull();
    expect(result.output.blockedReason).toBe('no_consent');
    expect(result.output.status).toBe('draft');
    expect(result.output.requiresHumanApproval).toBe(true);
  });

  it('mandates channel: none and blockedReason: no_contact_channel when permitted channels list is empty', async () => {
    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        throw new Error('AI Provider should not be called when permitted channels are empty');
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const agent = new FollowUpOptimizerAgent({ aiProvider: mockAiProvider });
    const result = await agent.run({
      analystOutput: sampleAnalystOutput,
      hasConsent: true,
      permittedChannels: [], // Consent granted, but no contact details/channels permitted
      retrievedChunks: sampleKnowledgeChunks,
      customerSegments: sampleSegments,
    });

    expect(result.output.channel).toBe('none');
    expect(result.output.message).toBeNull();
    expect(result.output.blockedReason).toBe('no_contact_channel');
  });

  it('rejects follow-up drafts containing internal score terminology (Score Leakage Guard)', async () => {
    const leakyOutput: FollowUpOutput = {
      recommendedAction: 'Send follow-up WhatsApp message',
      reason: 'Customer has high intent and inquired about EMI',
      channel: 'whatsapp',
      subject: null,
      message: 'Hello! Based on our meeting, your intent score was 75 according to our scoring rubric. Would you like to buy?',
      factsUsed: [],
      status: 'draft',
      requiresHumanApproval: true,
      blockedReason: null,
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(leakyOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 50,
        };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const agent = new FollowUpOptimizerAgent({ aiProvider: mockAiProvider, maxRetries: 0 });

    await expect(
      agent.run({
        analystOutput: sampleAnalystOutput,
        hasConsent: true,
        permittedChannels: ['whatsapp'],
        retrievedChunks: sampleKnowledgeChunks,
        customerSegments: sampleSegments,
      })
    ).rejects.toThrowError('internal_score_leakage');
  });

  it('rejects follow-up drafts containing ungrounded specs/numbers not present in factsUsed or dialogue', async () => {
    const ungroundedOutput: FollowUpOutput = {
      recommendedAction: 'Send follow-up email',
      reason: 'Share vehicle details',
      channel: 'email',
      subject: 'Prithvi 110 Details',
      message: 'Hello! The Prithvi 110 has an exclusive discount for ₹99,999 and gives 120 kmpl.',
      factsUsed: [
        { fact: 'Prithvi 110 mileage is 68 kmpl', sourceChunkId: 'chunk-p110-spec' },
      ],
      status: 'draft',
      requiresHumanApproval: true,
      blockedReason: null,
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(ungroundedOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 50,
        };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const agent = new FollowUpOptimizerAgent({ aiProvider: mockAiProvider, maxRetries: 0 });

    await expect(
      agent.run({
        analystOutput: sampleAnalystOutput,
        hasConsent: true,
        permittedChannels: ['email'],
        retrievedChunks: sampleKnowledgeChunks,
        customerSegments: sampleSegments,
      })
    ).rejects.toThrowError('facts_used_grounding');
  });

  it('generates a valid, grounded draft when all governance criteria are satisfied', async () => {
    const validOutput: FollowUpOutput = {
      recommendedAction: 'Send WhatsApp message with brochure and EMI details',
      reason: 'Customer inquired about Prithvi 110 within ₹75,000 budget and requested EMI options',
      channel: 'whatsapp',
      subject: null,
      message: 'Hi! Thank you for visiting Vayu Motors. The Prithvi 110 offers 68 kmpl mileage with EMI starting at ₹2,100 per month. Let us know if you would like to schedule a test ride this week!',
      factsUsed: [
        { fact: 'Prithvi 110 delivers 68 kmpl mileage and EMI from ₹2,100 per month', sourceChunkId: 'chunk-p110-spec' },
      ],
      status: 'draft',
      requiresHumanApproval: true,
      blockedReason: null,
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(validOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 50,
        };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const agent = new FollowUpOptimizerAgent({ aiProvider: mockAiProvider });
    const result = await agent.run({
      analystOutput: sampleAnalystOutput,
      hasConsent: true,
      permittedChannels: ['whatsapp'],
      retrievedChunks: sampleKnowledgeChunks,
      customerSegments: sampleSegments,
    });

    expect(result.output.channel).toBe('whatsapp');
    expect(result.output.status).toBe('draft');
    expect(result.output.requiresHumanApproval).toBe(true);
    expect(result.guardResults.every((g) => g.passed)).toBe(true);
  });

  it('governance assertion: verifies no outbound email, SMS, or WhatsApp sending client exists in codebase', () => {
    // Assert zero outbound communication provider files exist
    const forbiddenPaths = [
      resolve(__dirname, '../providers/email'),
      resolve(__dirname, '../providers/sms'),
      resolve(__dirname, '../providers/whatsapp'),
      resolve(__dirname, '../providers/twilio'),
      resolve(__dirname, '../providers/sendgrid'),
    ];

    for (const p of forbiddenPaths) {
      expect(existsSync(p)).toBe(false);
    }
  });

  it('draft approval and edit state machine enforces valid transitions and emits lifecycle events', async () => {
    const repos = createRepositories();

    // 1. Create initial draft
    const draft = await repos.drafts.createDraft({
      orgId: 'org-vayu-motors-dev',
      conversationId: 'conv-test-1',
      channel: 'email',
      subject: 'Vayu Motors - Prithvi 110 Quote',
      message: 'Here is the brochure and EMI estimate for Prithvi 110.',
      factsUsed: [{ fact: 'EMI starts at ₹2,100' }],
      recommendedAction: 'Send email quote',
      reason: 'Inquired about motorcycle',
    });

    expect(draft.status).toBe('draft');
    expect(draft.version).toBe(1);

    // 2. Edit draft (allowed in 'draft' status)
    const updated = await repos.drafts.updateDraft('org-vayu-motors-dev', draft.id, {
      message: 'Updated: Here is the revised quote with 68 kmpl mileage figures.',
    });
    expect(updated.message).toContain('Updated: Here is the revised quote');

    // 3. Approve draft (Governance Gate: records decision, NO send)
    const approval = await repos.drafts.recordApproval({
      orgId: 'org-vayu-motors-dev',
      draftId: draft.id,
      decision: 'approved',
      reviewerId: 'manager-1',
      reviewerNotes: 'Verified numbers against official price list.',
    });

    expect(approval.draft.status).toBe('approved');
    expect(approval.approvalRecord.decision).toBe('approved');
    expect(approval.approvalRecord.reviewerId).toBe('manager-1');

    // 4. State Machine Invariant: Cannot edit an approved draft
    await expect(
      repos.drafts.updateDraft('org-vayu-motors-dev', draft.id, { message: 'Attempt to tamper approved draft' })
    ).rejects.toThrowError('INVALID_STATE_TRANSITION');

    // 5. State Machine Invariant: Cannot re-approve an already finalized draft
    await expect(
      repos.drafts.recordApproval({
        orgId: 'org-vayu-motors-dev',
        draftId: draft.id,
        decision: 'rejected',
        reviewerId: 'manager-2',
      })
    ).rejects.toThrowError('INVALID_STATE_TRANSITION');
  });

  it('Fastify endpoints: POST /api/conversations/:id/follow-up, PATCH /api/drafts/:id, and POST /api/drafts/:id/approve', async () => {
    const repos = createRepositories();

    // Seed conversation and consent
    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'transcript_import',
      language: 'en',
      sessionId: 'session-cust-1',
    });

    await repos.conversations.createTranscriptWithSegments({
      orgId: 'org-vayu-motors-dev',
      conversationId: conv.id,
      version: 1,
      rawText: sampleSegments.map((s) => `[${s.startTime}] ${s.speaker}: ${s.text}`).join('\n'),
      segments: sampleSegments,
    });

    // Grant follow_up_contact consent
    await repos.consents.recordConsent({
      orgId: 'org-vayu-motors-dev',
      subject: 'session-cust-1',
      scope: 'follow_up_contact',
      method: 'written',
    });

    // Save previous SignalAnalyst run
    await repos.agentRuns.saveAgentRun({
      orgId: 'org-vayu-motors-dev',
      conversationId: conv.id,
      agentName: 'signal_analyst',
      state: 'succeeded',
      modelUsed: 'mock-model',
      promptVersion: '1.0.0',
      durationMs: 40,
      retries: 0,
      validationResults: [],
      outputJson: sampleAnalystOutput as unknown as Record<string, unknown>,
    });

    const validOutput: FollowUpOutput = {
      recommendedAction: 'Send email with vehicle brochure',
      reason: 'Customer inquired about Prithvi 110',
      channel: 'email',
      subject: 'Prithvi 110 Information',
      message: 'Hello, here are the details for Prithvi 110 with 68 kmpl mileage.',
      factsUsed: [{ fact: '68 kmpl mileage', sourceChunkId: 'chunk-p110-spec' }],
      status: 'draft',
      requiresHumanApproval: true,
      blockedReason: null,
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(validOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 30,
        };
      },
      stream: () => { throw new Error(); },
      generateWithTools: async () => { throw new Error(); },
    };

    const app = await buildApp({
      repositories: repos,
      aiProvider: mockAiProvider,
      skipAutoSeed: true,
    });

    // 1. Generate follow-up draft
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/follow-up`,
      payload: {
        retrievedChunks: sampleKnowledgeChunks,
        permittedChannels: ['email'],
      },
    });

    expect(genRes.statusCode).toBe(200);
    const genBody = JSON.parse(genRes.body);
    expect(genBody.draft.channel).toBe('email');
    expect(genBody.draft.status).toBe('draft');
    expect(genBody.draft.requiresHumanApproval).toBe(true);

    const draftId = genBody.draft.id;

    // 2. Fetch drafts list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/drafts`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.body).drafts).toHaveLength(1);

    // 3. Edit draft via PATCH
    const editRes = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draftId}`,
      payload: {
        subject: 'Vayu Motors: Customized Prithvi 110 Spec & EMI',
      },
    });
    expect(editRes.statusCode).toBe(200);
    expect(JSON.parse(editRes.body).draft.subject).toBe('Vayu Motors: Customized Prithvi 110 Spec & EMI');

    // 4. Approve draft via POST /api/drafts/:id/approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      payload: {
        reviewerId: 'advisor-neha-12',
        reviewerNotes: 'Approved after verifying customer budget.',
      },
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.draft.status).toBe('approved');
    expect(approveBody.approvalRecord.decision).toBe('approved');
    expect(approveBody.approvalRecord.reviewerId).toBe('advisor-neha-12');

    // 5. Check events emitted: FOLLOW_UP_DRAFTED and FOLLOW_UP_APPROVED
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = JSON.parse(eventsRes.body).events;
    expect(events.map((e: { eventType: string }) => e.eventType)).toEqual([
      'FOLLOW_UP_DRAFTED',
      'FOLLOW_UP_APPROVED',
    ]);
  });
});
