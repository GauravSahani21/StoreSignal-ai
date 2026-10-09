import { describe, expect, it } from 'vitest';
import {
  AIAuthFailedError,
  AIModelUnavailableError,
  AINotConfiguredError,
  NotImplementedError,
} from '../errors/AppError.js';
import { OpenRouterClient } from '../providers/ai/openrouter/OpenRouterClient.js';
import { OpenRouterProvider } from '../providers/ai/openrouter/OpenRouterProvider.js';
import type { AIRequest, AIResponse } from '../providers/ai/types.js';

describe('OpenRouterProvider Logic & Fallback Behavior', () => {
  const dummyApiKey = 'sk-or-v1-secret-test-key-54321';

  it('throws AINotConfiguredError when OPENROUTER_API_KEY is not configured', async () => {
    const provider = new OpenRouterProvider({
      appUrl: 'http://localhost:5173',
      model: 'google/gemini-2.0-flash-001',
      timeoutMs: 5000,
    });

    await expect(
      provider.generate({
        messages: [{ role: 'user', content: 'Test question' }],
      })
    ).rejects.toThrowError(AINotConfiguredError);
  });

  it('switches to fallback model when primary encounters AIModelUnavailableError and records actual model', async () => {
    // Mock client for primary model
    const mockPrimaryClient = {
      async createChatCompletion(_req: AIRequest): Promise<AIResponse> {
        throw new AIModelUnavailableError('Model primary-model is decommissioned');
      },
    } as unknown as OpenRouterClient;

    // Mock client for fallback model
    const mockFallbackClient = {
      async createChatCompletion(req: AIRequest): Promise<AIResponse> {
        return {
          content: 'Response served from fallback model',
          model: req.model ?? 'fallback-model',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          latencyMs: 120,
        };
      },
    } as unknown as OpenRouterClient;

    const provider = new OpenRouterProvider({
      apiKey: dummyApiKey,
      appUrl: 'http://localhost:5173',
      model: 'primary-model',
      fallbackModel: 'fallback-model',
      timeoutMs: 5000,
      client: mockPrimaryClient,
      fallbackClient: mockFallbackClient,
    });

    const result = await provider.generate({
      messages: [{ role: 'user', content: 'What is the motorcycle warranty?' }],
    });

    expect(result.content).toBe('Response served from fallback model');
    expect(result.model).toBe('fallback-model');
  });

  it('does NOT invoke fallback on auth failure (AIAuthFailedError) and preserves root cause', async () => {
    let fallbackCalled = false;

    const mockPrimaryClient = {
      async createChatCompletion(_req: AIRequest): Promise<AIResponse> {
        throw new AIAuthFailedError('Invalid authorization key');
      },
    } as unknown as OpenRouterClient;

    const mockFallbackClient = {
      async createChatCompletion(_req: AIRequest): Promise<AIResponse> {
        fallbackCalled = true;
        return {
          content: 'Fallback',
          model: 'fallback-model',
          finishReason: 'stop',
          usage: null,
          latencyMs: 50,
        };
      },
    } as unknown as OpenRouterClient;

    const provider = new OpenRouterProvider({
      apiKey: dummyApiKey,
      appUrl: 'http://localhost:5173',
      model: 'primary-model',
      fallbackModel: 'fallback-model',
      timeoutMs: 5000,
      client: mockPrimaryClient,
      fallbackClient: mockFallbackClient,
    });

    await expect(
      provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIAuthFailedError);

    expect(fallbackCalled).toBe(false);
  });

  it('throws typed NotImplementedError on stream() and generateWithTools()', async () => {
    const provider = new OpenRouterProvider({
      apiKey: dummyApiKey,
      appUrl: 'http://localhost:5173',
      model: 'primary-model',
      timeoutMs: 5000,
    });

    // Test stream iterator throws on first iteration
    const streamIter = provider.stream({ messages: [{ role: 'user', content: 'test' }] });
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of streamIter) {
        // should throw
      }
    }).rejects.toThrowError(NotImplementedError);

    // Test generateWithTools rejects
    await expect(
      provider.generateWithTools({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrowError(NotImplementedError);
  });
});
