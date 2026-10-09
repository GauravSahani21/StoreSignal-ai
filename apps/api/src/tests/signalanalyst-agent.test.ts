import { describe, expect, it } from 'vitest';
import { SignalAnalystAgent } from '../agents/signalanalyst/SignalAnalystAgent.js';
import type { SignalAnalystOutput } from '../agents/signalanalyst/schema.js';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { segmentTranscript } from '../conversations/segmenter.js';
import { createRepositories } from '../database/repositories/index.js';
import type { AIProvider, AIRequest, AIResponse } from '../providers/ai/types.js';

describe('SignalAnalyst Agent & Shopper Intelligence (Phase 7)', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  const testSegments = [
    {
      id: 'seg-1-0-adv',
      index: 0,
      speaker: 'advisor' as const,
      startMs: 2000,
      endMs: 6000,
      text: 'Namaste! Are you looking for commuter bikes or scooters today?',
      confidence: 1.0,
    },
    {
      id: 'seg-1-1-cust',
      index: 1,
      speaker: 'customer' as const,
      startMs: 7000,
      endMs: 14000,
      text: 'My budget is strictly under ₹85,000. I need high mileage for daily office travel.',
      confidence: 1.0,
    },
    {
      id: 'seg-1-2-cust',
      index: 2,
      speaker: 'customer' as const,
      startMs: 15000,
      endMs: 20000,
      text: 'How does the Prithvi 110 compare with Hero Splendor in fuel efficiency?',
      confidence: 1.0,
    },
  ];

  it('extracts structured intelligence with explicit budget and computes intent score in code', async () => {
    const mockOutput: SignalAnalystOutput = {
      summary: 'Customer visited looking for a daily office commuter motorcycle with strict ₹85,000 budget.',
      productInterests: [
        {
          productRef: 'vayu-commuter-110',
          text: 'Vayu Prithvi 110 commuter motorcycle',
          basis: 'explicit',
          evidence: [
            {
              segmentId: 'seg-1-2-cust',
              quote: 'How does the Prithvi 110 compare',
            },
          ],
        },
      ],
      preferences: [
        {
          text: 'High fuel efficiency / mileage for daily office travel',
          basis: 'explicit',
          evidence: [
            {
              segmentId: 'seg-1-1-cust',
              quote: 'I need high mileage for daily office travel',
            },
          ],
        },
      ],
      budget: {
        value: '₹85,000',
        basis: 'explicit',
        evidence: [
          {
            segmentId: 'seg-1-1-cust',
            quote: 'My budget is strictly under ₹85,000',
          },
        ],
      },
      timeline: null,
      competitorMentions: [
        {
          name: 'Hero Splendor',
          evidence: [
            {
              segmentId: 'seg-1-2-cust',
              quote: 'Hero Splendor in fuel efficiency',
            },
          ],
        },
      ],
      objections: [],
      unresolvedQuestions: [],
      intentSignals: [
        {
          signalId: 'stated_budget_overlap',
          present: true,
          evidence: [
            {
              segmentId: 'seg-1-1-cust',
              quote: 'My budget is strictly under ₹85,000',
            },
          ],
        },
        {
          signalId: 'compared_specific_competitor',
          present: true,
          evidence: [
            {
              segmentId: 'seg-1-2-cust',
              quote: 'Hero Splendor in fuel efficiency',
            },
          ],
        },
      ],
      missedConversionHypotheses: [],
      recommendedNextAction: 'Show the Prithvi 110 and demonstrate 68 kmpl mileage advantages over Splendor.',
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(mockOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 110,
        };
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };

    const agent = new SignalAnalystAgent({ aiProvider: mockAiProvider });
    const result = await agent.run(testSegments);

    expect(result.output.budget?.value).toBe('₹85,000');
    expect(result.output.competitorMentions[0]?.name).toBe('Hero Splendor');
    expect(result.intentAssessment.score).toBeDefined();
    // Base 20 + stated_budget_overlap (10) + compared_specific_competitor (5) = 35 (band: low/medium)
    expect(result.intentAssessment.score).toBe(35);
    expect(result.intentAssessment.contributingSignals).toHaveLength(2);
  });

  it('rejects explicit budget citations referencing advisor-speaker segments', async () => {
    // Fabricated output claiming explicit budget from advisor's segment!
    const invalidOutput: SignalAnalystOutput = {
      summary: 'Summary test',
      productInterests: [],
      preferences: [],
      budget: {
        value: '₹85,000',
        basis: 'explicit',
        evidence: [
          {
            segmentId: 'seg-1-0-adv', // Advisor segment!
            quote: 'commuter bikes or scooters today',
          },
        ],
      },
      timeline: null,
      competitorMentions: [],
      objections: [],
      unresolvedQuestions: [],
      intentSignals: [],
      missedConversionHypotheses: [],
      recommendedNextAction: 'Next action',
    };

    const mockAiProvider: AIProvider = {
      async generate(): Promise<AIResponse> {
        return {
          content: JSON.stringify(invalidOutput),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 50,
        };
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };

    const agent = new SignalAnalystAgent({ aiProvider: mockAiProvider, maxRetries: 0 });
    await expect(agent.run(testSegments)).rejects.toThrowError('explicit_basis_check');
  });

  it('POST /api/conversations/:id/analyze endpoint returns structured analysis and persists run', async () => {
    const repos = createRepositories();

    const mockAiProvider: AIProvider = {
      async generate(_req: AIRequest): Promise<AIResponse> {
        const output: SignalAnalystOutput = {
          summary: 'Customer inquired about Agni 125 commuter motorcycle.',
          productInterests: [],
          preferences: [],
          budget: null,
          timeline: null,
          competitorMentions: [],
          objections: [],
          unresolvedQuestions: [],
          intentSignals: [
            {
              signalId: 'asked_price_or_offers',
              present: true,
              evidence: [
                {
                  segmentId: 'seg-sample-1',
                  quote: 'What is the price of Agni 125?',
                },
              ],
            },
          ],
          missedConversionHypotheses: [],
          recommendedNextAction: 'Present official Agni 125 quotation.',
        };

        return {
          content: JSON.stringify(output),
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: null,
          latencyMs: 95,
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

    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'transcript_import',
    });
    await repos.conversations.createTranscriptWithSegments({
      orgId: 'org-vayu-motors-dev',
      conversationId: conv.id,
      version: 1,
      rawText: 'Customer: What is the price of Agni 125?\nCustomer: Is it available in blue color?',
      segments: [
        {
          id: 'seg-sample-1',
          index: 0,
          speaker: 'customer',
          startMs: 5000,
          endMs: 8000,
          text: 'What is the price of Agni 125?',
          confidence: 1.0,
        },
        {
          id: 'seg-sample-2',
          index: 1,
          speaker: 'customer',
          startMs: 9000,
          endMs: 14000,
          text: 'Is it available in blue color?',
          confidence: 1.0,
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/analyze`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.agent).toBe('signal_analyst');
    expect(data.intentAssessment).toBeDefined();
    expect(data.intentAssessment.score).toBe(32); // 20 + 12

    // Check GET endpoint
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/analyze`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.payload).agent).toBe('signal_analyst');

    await app.close();
  });
});
