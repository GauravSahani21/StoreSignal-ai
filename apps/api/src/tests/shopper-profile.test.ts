import { describe, it, expect, beforeEach } from 'vitest';
import { createRepositories, type Repositories } from '../database/repositories/index.js';
import { ShopperProfileService } from '../shoppers/ShopperProfileService.js';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { AIProvider } from '../providers/ai/types.js';
import { OrchestratorEngine } from '../orchestration/OrchestratorEngine.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { segmentTranscript } from '../conversations/segmenter.js';

describe('Phase 10: Unified Shopper Profile & Cross-Visit Continuity', () => {
  let repositories: Repositories;
  let service: ShopperProfileService;
  let app: FastifyInstance;
  const orgA = 'org-vayu-motors-delhi';
  const orgB = 'org-vayu-motors-mumbai';

  const mockAiProvider: AIProvider = {
    generate: async () => ({
      content: '{}',
      model: 'mock-model',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      latencyMs: 50,
    }),
    stream: () => {
      throw new Error('Not implemented');
    },
    generateWithTools: async () => {
      throw new Error('Not implemented');
    },
    countTokens: async () => 10,
    isAvailable: async () => true,
  };

  beforeEach(async () => {
    repositories = createRepositories();
    service = new ShopperProfileService(repositories);

    // Seed test orgs
    await repositories.conversations.createConversation({
      orgId: orgA,
      source: 'transcript_import',
      language: 'en',
    });

    app = await buildApp({
      repositories,
      skipAutoSeed: true,
      aiProvider: mockAiProvider,
    });
  });

  describe('1. Profile Resolution & Permitted Identifiers (§10)', () => {
    it('resolves existing profile by explicit externalCustomerId', async () => {
      const shopper1 = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-DELHI-001',
        hasConsent: true,
      });

      expect(shopper1.id).toBeDefined();
      expect(shopper1.externalCustomerId).toBe('CUST-DELHI-001');

      // Subsequent resolution with same ID resolves to identical profile
      const shopper2 = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-DELHI-001',
      });

      expect(shopper2.id).toBe(shopper1.id);
    });

    it('resolves existing profile by contactHash only when consent is granted', async () => {
      const phoneHash = 'sha256-phone-9876543210';
      const shopper1 = await service.resolveShopper({
        orgId: orgA,
        contactHash: phoneHash,
        hasConsent: true,
      });

      expect(shopper1.id).toBeDefined();
      expect(shopper1.contactHash).toBe(phoneHash);

      const shopper2 = await service.resolveShopper({
        orgId: orgA,
        contactHash: phoneHash,
        hasConsent: true,
      });

      expect(shopper2.id).toBe(shopper1.id);
    });

    it('falls back to anonymous session profile and NEVER performs fuzzy identity guessing', async () => {
      // Customer without explicit ID or phone hash
      const anon1 = await service.resolveShopper({
        orgId: orgA,
      });

      expect(anon1.externalCustomerId).toBeUndefined();
      expect(anon1.contactHash).toBeUndefined();
      expect(anon1.anonymousId).toMatch(/^anon-/);

      // Another visitor without ID gets a distinct anonymous session (no guessing)
      const anon2 = await service.resolveShopper({
        orgId: orgA,
      });

      expect(anon2.id).not.toBe(anon1.id);
      expect(anon2.anonymousId).not.toBe(anon1.anonymousId);
    });
  });

  describe('2. Multi-Tenant Isolation & Cross-Org Leakage Protection', () => {
    it('strictly isolates shoppers between different organizations', async () => {
      // Shopper created in Org A
      const shopperA = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'SHARED-ID-123',
        hasConsent: true,
      });

      // Same externalCustomerId in Org B creates a completely isolated profile
      const shopperB = await service.resolveShopper({
        orgId: orgB,
        externalCustomerId: 'SHARED-ID-123',
        hasConsent: true,
      });

      expect(shopperA.id).not.toBe(shopperB.id);

      // Querying Org A for Shopper B must fail (NotFoundError)
      await expect(service.getProfileView(orgA, shopperB.id)).rejects.toThrow();

      // Querying Org B for Shopper A must fail
      await expect(service.getProfileView(orgB, shopperA.id)).rejects.toThrow();
    });
  });

  describe('3. Linking Conversations with Recorded Basis and Authorizer', () => {
    it('links conversation to shopper and creates tamper-evident audit record', async () => {
      const conv = await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
      });

      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-002',
        hasConsent: true,
      });

      const link = await service.linkConversation({
        orgId: orgA,
        conversationId: conv.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-raghav',
      });

      expect(link.shopperId).toBe(shopper.id);
      expect(link.conversationId).toBe(conv.id);
      expect(link.basis).toBe('explicit_customer_id');
      expect(link.authorizer).toBe('advisor-raghav');

      // Verify audit record exists
      const audits = await repositories.auditLogs.listAudits(orgA, { action: 'CONVERSATION_SHOPPER_LINKED' });
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0]?.actor).toBe('advisor-raghav');
      expect(audits[0]?.metadata).toMatchObject({
        shopperId: shopper.id,
        conversationId: conv.id,
        basis: 'explicit_customer_id',
      });
    });
  });

  describe('4. Cross-Visit Continuity & Context Injection for Agents', () => {
    it('identifies returning visitors with authorized history and sets isReturningVisitor true', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-VIP-777',
        hasConsent: true,
      });

      // First Visit
      const conv1 = await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv1.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-1',
      });

      // Save agent run for Visit 1 (Nexon EV explored, delivery objection)
      await repositories.agentRuns.saveAgentRun({
        orgId: orgA,
        conversationId: conv1.id,
        agentName: 'signal_analyst',
        state: 'succeeded',
        modelUsed: 'mock-model',
        promptVersion: '1.0.0',
        durationMs: 120,
        retries: 0,
        validationResults: [],
        outputJson: {
          productInterest: ['Nexon EV Empowered Plus'],
          recommendedAction: 'Send brochure and battery warranty details',
        },
      });

      await repositories.agentRuns.saveAgentRun({
        orgId: orgA,
        conversationId: conv1.id,
        agentName: 'floor_coach',
        state: 'succeeded',
        modelUsed: 'mock-model',
        promptVersion: '1.0.0',
        durationMs: 140,
        retries: 0,
        validationResults: [],
        outputJson: {
          items: [{ customerQuestion: 'What is the real world range on highway?' }],
          unresolved: [{ questionOrObjection: 'Wait time is 6 weeks', reason: 'delivery_delay' }],
        },
      });

      // Second Visit (Cross-visit continuity)
      const conv2 = await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv2.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-2',
      });

      // Retrieve pipeline context for Visit 2
      const context = await service.getAuthorizedContextForPipeline(orgA, conv2.id);

      expect(context.hasAuthorizedHistory).toBe(true);
      expect(context.isReturningVisitor).toBe(true);
      expect(context.visitCount).toBe(2);
      expect(context.priorInterests).toContain('Nexon EV Empowered Plus');
      expect(context.priorRecommendations).toContain('Send brochure and battery warranty details');
      expect(context.unresolvedObjections.some((o) => o.includes('delivery_delay'))).toBe(true);

      // Verify Profile View
      const profile = await service.getProfileView(orgA, shopper.id);
      expect(profile.visitCount).toBe(2);
      expect(profile.interests).toContain('Nexon EV Empowered Plus');
      expect(profile.pastQuestions.length).toBeGreaterThan(0);
      expect(profile.unresolvedObjections.length).toBeGreaterThan(0);
    });

    it('immediately stops history usage when consent is revoked', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-REVOKE-TEST',
        hasConsent: true,
      });

      const conv1 = await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv1.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-1',
      });

      const conv2 = await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv2.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-2',
      });

      // Prior to revocation: history available
      const beforeRevoke = await service.getAuthorizedContextForPipeline(orgA, conv2.id);
      expect(beforeRevoke.hasAuthorizedHistory).toBe(true);

      // Customer revokes consent
      await service.revokeConsent(orgA, shopper.id, 'customer-self-request');

      // Immediately after revocation: history usage withheld!
      const afterRevoke = await service.getAuthorizedContextForPipeline(orgA, conv2.id);
      expect(afterRevoke.hasAuthorizedHistory).toBe(false);
      expect(afterRevoke.isReturningVisitor).toBe(false);
      expect(afterRevoke.priorInterests).toEqual([]);

      // Profile view notes consent revocation and withholds past dialogue items
      const profile = await service.getProfileView(orgA, shopper.id);
      expect(profile.hasActiveConsent).toBe(false);
      expect(profile.interests).toEqual([]);
      expect(profile.pastQuestions).toEqual([]);
      expect(profile.notes).toContain('withheld');
    });
  });

  describe('5. Manual Outcome Recording & Unified Events (§10, §11)', () => {
    it('records purchase outcome and emits PURCHASE_RECORDED store event', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-PURCHASE-01',
        hasConsent: true,
      });

      const outcome = await service.recordOutcome({
        orgId: orgA,
        shopperId: shopper.id,
        type: 'purchase',
        value: 1850000,
        reason: 'Booked Nexon EV Empowered 45kWh in Teal colour',
        recordedBy: 'manager-rajesh',
      });

      expect(outcome.id).toBeDefined();
      expect(outcome.type).toBe('purchase');
      expect(outcome.value).toBe(1850000);
      expect(outcome.recordedBy).toBe('manager-rajesh');

      // Verify store event was emitted to unified event stream
      const events = await repositories.storeEvents.listEvents(orgA, { type: 'PURCHASE_RECORDED' });
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('PURCHASE_RECORDED');
      expect(events[0]?.metadata).toMatchObject({
        outcomeId: outcome.id,
        value: 1850000,
      });

      // Verify tamper-evident audit record
      const audits = await repositories.auditLogs.listAudits(orgA, { action: 'OUTCOME_RECORDED' });
      expect(audits.length).toBe(1);
      expect(audits[0]?.actor).toBe('manager-rajesh');
    });

    it('records missed_conversion outcome with reason and emits MISSED_CONVERSION_RECORDED event', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-MISSED-01',
        hasConsent: true,
      });

      const outcome = await service.recordOutcome({
        orgId: orgA,
        shopperId: shopper.id,
        type: 'missed_conversion',
        reason: 'Customer chose competitor MG ZS EV due to sunroof availability',
        recordedBy: 'advisor-priya',
      });

      expect(outcome.type).toBe('missed_conversion');
      expect(outcome.reason).toContain('competitor MG ZS EV');

      const events = await repositories.storeEvents.listEvents(orgA, { type: 'MISSED_CONVERSION_RECORDED' });
      expect(events.length).toBe(1);
      expect(events[0]?.metadata).toMatchObject({
        reason: outcome.reason,
      });
    });
  });

  describe('6. Deletion Cascade (Right to Erasure) & Retention Purge', () => {
    it('permanently cascades deletion of profile and derived data while recording zero-PII audit record', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'CUST-ERASURE-01',
        hasConsent: true,
      });

      await service.recordOutcome({
        orgId: orgA,
        shopperId: shopper.id,
        type: 'missed_conversion',
        reason: 'Too expensive',
        recordedBy: 'advisor-1',
      });

      // Perform deletion cascade
      await service.deleteShopperAndDerivedData(orgA, shopper.id, 'dpo-compliance-officer');

      // Shopper must no longer exist
      const deletedShopper = await repositories.shoppers.getShopperById(orgA, shopper.id);
      expect(deletedShopper).toBeNull();

      // Outcomes for this shopper must be deleted
      const outcomes = await repositories.outcomes.getOutcomesForShopper(orgA, shopper.id);
      expect(outcomes.length).toBe(0);

      // Audit log must record deletion with actor and count of items, with ZERO sensitive PII
      const audits = await repositories.auditLogs.listAudits(orgA, { action: 'SHOPPER_PROFILE_DELETED' });
      expect(audits.length).toBe(1);
      expect(audits[0]?.actor).toBe('dpo-compliance-officer');
      expect(audits[0]?.resourceId).toBe(shopper.id);
      expect(JSON.stringify(audits[0]?.metadata)).not.toContain('CUST-ERASURE-01');
    });

    it('runs retention purge job for conversations past retention_until', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      await repositories.conversations.createConversation({
        orgId: orgA,
        source: 'transcript_import',
        language: 'en',
        retentionUntil: pastDate,
      });

      const purgedCount = await service.purgeExpiredRetention(orgA, 'cron-retention-worker');
      expect(purgedCount).toBe(1);

      const audits = await repositories.auditLogs.listAudits(orgA, { action: 'RETENTION_PURGE_EXECUTED' });
      expect(audits.length).toBe(1);
      expect(audits[0]?.actor).toBe('cron-retention-worker');
    });
  });

  describe('7. HTTP API Route Integration', () => {
    it('POST /api/shoppers/resolve provisions and links a shopper via HTTP', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/shoppers/resolve',
        payload: {
          orgId: orgA,
          externalCustomerId: 'HTTP-CUST-999',
          hasConsent: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.externalCustomerId).toBe('HTTP-CUST-999');

      // Fetch profile via GET /api/shoppers/:id
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/shoppers/${body.data.id}?orgId=${orgA}`,
      });

      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.data.shopper.id).toBe(body.data.id);
      expect(getBody.data.hasActiveConsent).toBe(true);
    });

    it('POST /api/shoppers/:id/outcomes records an outcome and returns 201', async () => {
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'HTTP-OUTCOME-CUST',
        hasConsent: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/shoppers/${shopper.id}/outcomes`,
        payload: {
          orgId: orgA,
          type: 'purchase',
          value: 1500000,
          reason: 'Showroom booking completed',
          recordedBy: 'advisor-test',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.type).toBe('purchase');
      expect(body.data.value).toBe(1500000);
    });
  });

  describe('8. Orchestrator Integration: Returning Visit Rubric Weight (+8)', () => {
    it('automatically scores returning_visit (+8) in SignalAnalyst when shopper has authorized prior history', async () => {
      const embeddingProvider = new MockEmbeddingProvider();
      const knowledgeStore = new KnowledgeStore(embeddingProvider);
      const retrievalService = new RetrievalService(knowledgeStore, embeddingProvider);

      await knowledgeStore.addDocument({
        orgId: orgA,
        filename: 'vidyut-specs.md',
        fileType: 'md',
        content: 'Vidyut electric scooter offers starting at price ₹1,15,000. Festive discount available on booking.',
      });
      const searchRes = await retrievalService.retrieve(orgA, 'Vidyut electric scooter price and discount');
      const seededChunkId = searchRes.chunks[0]?.chunkId || 'chk-1';

      // Mock AI that generates valid responses for all agents
      const orchestratorAi: AIProvider = {
        generate: async (req) => {
          const systemMsg = req.messages.find((m) => m.role === 'system')?.content || '';
          if (systemMsg.includes('You are FloorCoach')) {
            return {
              content: JSON.stringify({
                items: [
                  {
                    customerQuestion: 'Do you have any new festive discount offers?',
                    evidence: [{ segmentId: 'seg-2', quote: 'Do you have any new festive discount offers?' }],
                    objectionType: 'price',
                    suggestedResponse: 'We have special festive discount on Vidyut electric scooter.',
                    supportingSources: [{ chunkId: seededChunkId, filename: 'vidyut-specs.md' }],
                    answerStatus: 'answered_from_knowledge',
                    nextStep: 'Provide quotation',
                  },
                ],
                unresolved: [],
              }),
              model: 'mock-coach',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
              latencyMs: 30,
            };
          }
          if (systemMsg.includes('You are SignalAnalyst')) {
            return {
              content: JSON.stringify({
                summary: 'Customer returned to finalize decision on Vidyut.',
                productInterests: [
                  {
                    productRef: 'v-vidyut',
                    text: 'Vidyut',
                    basis: 'explicit',
                    evidence: [{ segmentId: 'seg-1', quote: 'I am back to look at Vidyut electric scooter again.' }],
                  },
                ],
                preferences: [],
                budget: null,
                timeline: null,
                competitorMentions: [],
                objections: [],
                unresolvedQuestions: [],
                intentSignals: [
                  { signalId: 'asked_price_or_offers', present: true, evidence: [{ segmentId: 'seg-2', quote: 'Do you have any new festive discount offers?' }] },
                ],
                missedConversionHypotheses: [],
                recommendedNextAction: 'Offer test ride and festive pricing breakdown.',
              }),
              model: 'mock-analyst',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
              latencyMs: 30,
            };
          }
          if (systemMsg.includes('You are FollowUpOptimizer')) {
            return {
              content: JSON.stringify({
                recommendedAction: 'Send updated quotation',
                reason: 'Returning customer asked for festive offers',
                channel: 'email',
                subject: 'Your Vidyut Festive Quotation',
                message: 'Thank you for visiting us again today! As discussed, we have updated your offer with the price ₹1,15,000.',
                factsUsed: [{ fact: 'price ₹1,15,000', sourceChunkId: seededChunkId }],
                status: 'draft',
                requiresHumanApproval: true,
                blockedReason: null,
              }),
              model: 'mock-followup',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
              latencyMs: 30,
            };
          }

          return { content: '{}', model: 'mock-default', finishReason: 'stop', usage: null, latencyMs: 10 };
        },
        stream: () => { throw new Error('Not implemented'); },
        generateWithTools: async () => { throw new Error('Not implemented'); },
        countTokens: async () => 10,
        isAvailable: async () => true,
      };

      const orchestrator = new OrchestratorEngine({
        repositories,
        aiProvider: orchestratorAi,
        retrievalService,
        shopperProfileService: service,
      });

      // 1. Create Shopper
      const shopper = await service.resolveShopper({
        orgId: orgA,
        externalCustomerId: 'RETURNING-HERO-101',
        hasConsent: true,
      });

      // Grant consent for follow-up and processing
      await repositories.consents.recordConsent({
        orgId: orgA,
        subject: shopper.id,
        scope: 'follow_up_contact',
        method: 'verbal',
      });

      // 2. Visit 1: Conversation 1
      const conv1 = await repositories.conversations.createConversation({ orgId: orgA, source: 'transcript_import' });
      await repositories.conversations.createTranscriptWithSegments({
        orgId: orgA,
        conversationId: conv1.id,
        version: 1,
        rawText: 'Customer: Hello. Advisor: Welcome to Vayu Motors.',
        segments: segmentTranscript('Customer: Hello. Advisor: Welcome to Vayu Motors.', { conversationId: 'conv1', transcriptVersion: 1 }),
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv1.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-1',
      });

      // 3. Visit 2: Conversation 2 (Returning visit!)
      const transcript2 = 'Customer: I am back to look at Vidyut electric scooter again. Do you have any new festive discount offers?';
      const conv2 = await repositories.conversations.createConversation({ orgId: orgA, source: 'transcript_import', sessionId: shopper.id });
      await repositories.conversations.createTranscriptWithSegments({
        orgId: orgA,
        conversationId: conv2.id,
        version: 1,
        rawText: transcript2,
        segments: [
          { id: 'seg-1', index: 0, speaker: 'customer', text: 'I am back to look at Vidyut electric scooter again.' },
          { id: 'seg-2', index: 1, speaker: 'customer', text: 'Do you have any new festive discount offers?' },
        ],
      });
      await service.linkConversation({
        orgId: orgA,
        conversationId: conv2.id,
        shopperId: shopper.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-2',
      });

      // 4. Run Orchestrator on Visit 2
      const run = await orchestrator.processConversation({
        orgId: orgA,
        conversationId: conv2.id,
      });

      expect(run.state).toBe('AWAITING_APPROVAL');
      expect(run.stepResults['signal_analyst']?.state).toBe('SUCCEEDED');

      const analystStepOut = run.stepResults['signal_analyst']?.output as {
        intentAssessment: {
          score: number;
          contributingSignals: Array<{ signalId: string; weight: number }>;
        };
      };

      // Verify that returning_visit signal was injected with weight 8!
      const contributingIds = analystStepOut.intentAssessment.contributingSignals.map((s) => s.signalId);
      expect(contributingIds).toContain('returning_visit');

      const returningSig = analystStepOut.intentAssessment.contributingSignals.find((s) => s.signalId === 'returning_visit');
      expect(returningSig?.weight).toBe(8);

      // Verify FollowUp Optimizer produced draft
      expect(run.stepResults['followup_optimizer']?.state).toBe('SUCCEEDED');
      const drafts = await repositories.drafts.getDraftsByConversation(orgA, conv2.id);
      expect(drafts.length).toBe(1);
      expect(drafts[0]?.status).toBe('draft');
    });
  });
});
