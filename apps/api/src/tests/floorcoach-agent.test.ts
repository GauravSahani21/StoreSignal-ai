import { describe, expect, it } from 'vitest';
import { FloorCoachAgent } from '../agents/floorcoach/FloorCoachAgent.js';
import type { FloorCoachOutput } from '../agents/floorcoach/schema.js';
import {
  validateEvidenceExistence,
  validateNumericGrounding,
  validateQuoteContainment,
  validateSourceSubset,
} from '../agents/guards/groundingGuards.js';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { segmentTranscript } from '../conversations/segmenter.js';
import { createRepositories } from '../database/repositories/index.js';
import type { AIProvider, AIRequest, AIResponse } from '../providers/ai/types.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import { seedKnowledgeBase } from '../rag/seedKnowledge.js';

describe('FloorCoach Agent & Grounding Guards (Phase 6)', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  const sampleSegments = [
    {
      id: 'seg-1-0-abc1',
      index: 0,
      speaker: 'advisor' as const,
      startMs: 2000,
      endMs: 5000,
      text: 'Welcome to Vayu Motors Indiranagar!',
      confidence: 1.0,
    },
    {
      id: 'seg-1-1-def2',
      index: 1,
      speaker: 'customer' as const,
      startMs: 6000,
      endMs: 11000,
      text: 'I am looking for a high mileage bike. What is the certified mileage of Prithvi 110?',
      confidence: 1.0,
    },
  ];

  describe('Grounding Guard Fixture Tests', () => {
    it('validateEvidenceExistence rejects invalid or fabricated segment IDs', () => {
      const valid = validateEvidenceExistence(
        [{ segmentId: 'seg-1-1-def2', quote: 'high mileage bike' }],
        sampleSegments
      );
      expect(valid.passed).toBe(true);

      const invalid = validateEvidenceExistence(
        [{ segmentId: 'seg-fabricated-999', quote: 'high mileage bike' }],
        sampleSegments
      );
      expect(invalid.passed).toBe(false);
      expect(invalid.guard).toBe('evidence_existence');
    });

    it('validateQuoteContainment rejects quotes not present in cited segments', () => {
      const valid = validateQuoteContainment(
        [{ segmentId: 'seg-1-1-def2', quote: 'What is the certified mileage' }],
        sampleSegments
      );
      expect(valid.passed).toBe(true);

      const invalid = validateQuoteContainment(
        [{ segmentId: 'seg-1-1-def2', quote: 'This quote never appeared in dialogue' }],
        sampleSegments
      );
      expect(invalid.passed).toBe(false);
      expect(invalid.guard).toBe('quote_containment');
    });

    it('validateSourceSubset rejects citations not present in retrieval results', () => {
      const retrieved = [
        {
          chunkId: 'chk-valid-1',
          documentId: 'doc-1',
          filename: 'specs.md',
          score: 0.9,
          content: 'Mileage 68 kmpl',
          locationMetadata: {},
          isDemo: true,
        },
      ];

      const valid = validateSourceSubset([{ chunkId: 'chk-valid-1' }], retrieved);
      expect(valid.passed).toBe(true);

      const invalid = validateSourceSubset([{ chunkId: 'chk-hallucinated-2' }], retrieved);
      expect(invalid.passed).toBe(false);
      expect(invalid.guard).toBe('source_subset');
    });

    it('validateNumericGrounding rejects hallucinated figures not in cited chunks or customer dialogue', () => {
      const citedChunks = [
        {
          chunkId: 'chk-1',
          documentId: 'doc-1',
          filename: 'specs.md',
          score: 0.9,
          content: 'The Prithvi 110 certified mileage is 68 kmpl and has 5 years warranty.',
          locationMetadata: {},
          isDemo: true,
        },
      ];

      // Grounded: 68 kmpl and 5 years are both in cited chunk
      const valid = validateNumericGrounding(
        'The Prithvi 110 achieves 68 kmpl with 5 years warranty coverage.',
        citedChunks,
        sampleSegments
      );
      expect(valid.passed).toBe(true);

      // Ungrounded: 95 kmpl does not appear anywhere
      const invalid = validateNumericGrounding(
        'The bike gives 95 kmpl in city traffic.',
        citedChunks,
        sampleSegments
      );
      expect(invalid.passed).toBe(false);
      expect(invalid.guard).toBe('numeric_grounding');
    });
  });

  describe('FloorCoach Agent Full Flow & Abstention', () => {
    it('produces verified coaching suggestions citing real retrieved chunks for gold questions', async () => {
      const embedding = new MockEmbeddingProvider();
      const store = new KnowledgeStore(embedding);
      await seedKnowledgeBase(store, 'org-vayu-motors-dev');
      const retrieval = new RetrievalService(store, embedding);

      // Create a mock AIProvider returning grounded FloorCoach JSON
      const mockAiProvider: AIProvider = {
        async generate(req: AIRequest): Promise<AIResponse> {
          // Identify prompt context
          const output: FloorCoachOutput = {
            items: [
              {
                customerQuestion: 'What is the certified mileage of the Prithvi 110?',
                evidence: [
                  {
                    segmentId: 'seg-1-1-def2',
                    quote: 'What is the certified mileage of Prithvi 110?',
                  },
                ],
                objectionType: 'fuel_efficiency',
                suggestedResponse:
                  'The Vayu Prithvi 110 delivers a certified fuel efficiency of 68 kmpl.',
                supportingSources: [], // Will be filled dynamically below
                answerStatus: 'answered_from_knowledge',
                nextStep: 'Offer a test ride to experience the fuel efficiency.',
              },
            ],
            unresolved: [],
          };

          // Find matching chunk ID from retrieval prompt text
          const promptText = req.messages[1]?.content || '';
          const match = promptText.match(/CHUNK ID:\s*([^\s|]+)/);
          if (match && match[1]) {
            output.items[0]!.supportingSources = [{ chunkId: match[1], filename: 'vayu_motorcycle_specs.md' }];
          }

          return {
            content: JSON.stringify(output),
            model: 'google/gemini-2.0-flash-001',
            finishReason: 'stop',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            latencyMs: 120,
          };
        },
        stream: () => {
          throw new Error();
        },
        generateWithTools: async () => {
          throw new Error();
        },
      };

      const agent = new FloorCoachAgent({
        aiProvider: mockAiProvider,
        retrievalService: retrieval,
      });

      const result = await agent.run('org-vayu-motors-dev', sampleSegments);

      expect(result.output.items).toHaveLength(1);
      const item = result.output.items[0]!;
      expect(item.answerStatus).toBe('answered_from_knowledge');
      expect(item.objectionType).toBe('fuel_efficiency');
      expect(item.suggestedResponse).toContain('68 kmpl');
      expect(result.guardResults.every((g) => g.passed)).toBe(true);
    });

    it('correctly marks deliberate gap questions as needs_verification and unresolved without inventing numbers', async () => {
      const embedding = new MockEmbeddingProvider();
      const store = new KnowledgeStore(embedding);
      await seedKnowledgeBase(store, 'org-vayu-motors-dev');
      const retrieval = new RetrievalService(store, embedding);

      const gapSegments = segmentTranscript(
        '[00:00:05] Customer: What is the exact price of the touring saddlebag accessory kit for Garud 250?'
      );

      const mockAiProvider: AIProvider = {
        async generate(): Promise<AIResponse> {
          const output: FloorCoachOutput = {
            items: [
              {
                customerQuestion: 'What is the price of the touring saddlebag accessory kit?',
                evidence: [
                  {
                    segmentId: gapSegments[0]!.id,
                    quote: 'What is the exact price of the touring saddlebag accessory kit',
                  },
                ],
                objectionType: 'price',
                suggestedResponse:
                  'I will check the official showroom accessory price catalog and confirm with you.',
                supportingSources: [],
                answerStatus: 'needs_verification',
                nextStep: 'Check accessory price list with inventory team.',
              },
            ],
            unresolved: [
              {
                question: 'Touring saddlebag accessory price for Garud 250',
                evidence: [
                  {
                    segmentId: gapSegments[0]!.id,
                    quote: 'What is the exact price of the touring saddlebag accessory kit',
                  },
                ],
                reason: 'no_source_found',
              },
            ],
          };

          return {
            content: JSON.stringify(output),
            model: 'google/gemini-2.0-flash-001',
            finishReason: 'stop',
            usage: null,
            latencyMs: 90,
          };
        },
        stream: () => {
          throw new Error();
        },
        generateWithTools: async () => {
          throw new Error();
        },
      };

      const agent = new FloorCoachAgent({
        aiProvider: mockAiProvider,
        retrievalService: retrieval,
      });

      const result = await agent.run('org-vayu-motors-dev', gapSegments);
      expect(result.output.items[0]?.answerStatus).toBe('needs_verification');
      expect(result.output.unresolved).toHaveLength(1);
      expect(result.output.unresolved[0]?.reason).toBe('no_source_found');
    });

    it('POST /api/conversations/:id/coach endpoint persists agent run and returns coaching advice', async () => {
      const repos = createRepositories();
      const mockAiProvider: AIProvider = {
        async generate(req: AIRequest): Promise<AIResponse> {
          const output: FloorCoachOutput = {
            items: [
              {
                customerQuestion: 'What is the mileage of Prithvi 110?',
                evidence: [
                  {
                    segmentId: 'seg-test-mileage-1',
                    quote: 'What is the mileage of Prithvi 110?',
                  },
                ],
                objectionType: 'fuel_efficiency',
                suggestedResponse: 'The Prithvi 110 achieves 68 kmpl.',
                supportingSources: [],
                answerStatus: 'answered_from_knowledge',
                nextStep: 'Offer a test ride.',
              },
            ],
            unresolved: [],
          };

          const promptText = req.messages[1]?.content || '';
          const match = promptText.match(/CHUNK ID:\s*([^\s|]+)/);
          if (match && match[1]) {
            output.items[0]!.supportingSources = [{ chunkId: match[1], filename: 'vayu_motorcycle_specs.md' }];
          }

          return {
            content: JSON.stringify(output),
            model: 'google/gemini-2.0-flash-001',
            finishReason: 'stop',
            usage: null,
            latencyMs: 100,
          };
        },
        stream: () => {
          throw new Error();
        },
        generateWithTools: async () => {
          throw new Error();
        },
      };

      const app = await buildApp({
        env: dummyEnv,
        logger: false,
        repositories: repos,
        aiProvider: mockAiProvider,
      });

      // Ingest conversation with known segment ID
      const conv = await repos.conversations.createConversation({
        orgId: 'org-vayu-motors-dev',
        source: 'transcript_import',
      });
      await repos.conversations.createTranscriptWithSegments({
        orgId: 'org-vayu-motors-dev',
        conversationId: conv.id,
        version: 1,
        rawText:
          '[00:00:04] Advisor: Namaste! Looking at the Prithvi 110?\n[00:00:10] Customer: What is the mileage of Prithvi 110?',
        segments: [
          {
            id: 'seg-test-mileage-1',
            index: 0,
            speaker: 'customer',
            startMs: 10000,
            endMs: 15000,
            text: 'What is the mileage of Prithvi 110?',
            confidence: 1.0,
          },
        ],
      });

      const coachRes = await app.inject({
        method: 'POST',
        url: `/api/conversations/${conv.id}/coach`,
      });

      expect(coachRes.statusCode).toBe(200);
      const data = JSON.parse(coachRes.payload);
      expect(data.agent).toBe('floor_coach');
      expect(data.runId).toMatch(/^run-/);
      expect(data.output).toBeDefined();

      // Retrieve via GET endpoint
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/conversations/${conv.id}/coach`,
      });
      expect(getRes.statusCode).toBe(200);
      expect(JSON.parse(getRes.payload).runId).toBe(data.runId);

      await app.close();
    });
  });
});
