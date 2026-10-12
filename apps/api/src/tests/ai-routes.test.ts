import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import {
  AIAuthFailedError,
  AINotConfiguredError,
  AIRateLimitedError,
  AITimeoutError,
} from '../errors/AppError.js';
import type { AIProvider, AIRequest, AIResponse } from '../providers/ai/types.js';

describe('POST /api/ai/chat and GET /api/ai/health Endpoints', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  it('successfully returns 200 with response and model for valid input', async () => {
    const mockAiProvider: AIProvider = {
      async generate(req: AIRequest): Promise<AIResponse> {
        return {
          content: `Answer to: ${req.messages[0]?.content}`,
          model: 'google/gemini-2.0-flash-001',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
          latencyMs: 150,
        };
      },
      stream: () => {
        throw new Error('Not implemented');
      },
      generateWithTools: async () => {
        throw new Error('Not implemented');
      },
    };

    const app = await buildApp({ env: dummyEnv, logger: false, aiProvider: mockAiProvider });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: {
        message: 'What is the commuter bike fuel efficiency?',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.response).toBe('Answer to: What is the commuter bike fuel efficiency?');
    expect(body.model).toBe('google/gemini-2.0-flash-001');
    expect(body.latencyMs).toBe(150);

    await app.close();
  });

  it('rejects missing, empty, non-string, or oversized message payloads with 400 VALIDATION_ERROR', async () => {
    const mockAiProvider: AIProvider = {
      generate: async () => ({
        content: 'test',
        model: 'test',
        finishReason: 'stop',
        usage: null,
        latencyMs: 1,
      }),
      stream: () => {
        throw new Error('Not implemented');
      },
      generateWithTools: async () => {
        throw new Error('Not implemented');
      },
    };

    const app = await buildApp({ env: dummyEnv, logger: false, aiProvider: mockAiProvider });

    // Missing message
    const resMissing = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: {},
    });
    expect(resMissing.statusCode).toBe(400);
    expect(JSON.parse(resMissing.payload).error.code).toBe('VALIDATION_ERROR');

    // Blank / whitespace only
    const resBlank = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: '    ' },
    });
    expect(resBlank.statusCode).toBe(400);
    expect(JSON.parse(resBlank.payload).error.code).toBe('VALIDATION_ERROR');

    // Non-string
    const resNonString = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 12345 },
    });
    expect(resNonString.statusCode).toBe(400);
    expect(JSON.parse(resNonString.payload).error.code).toBe('VALIDATION_ERROR');

    // Oversized (> 4000 characters)
    const resOversized = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 'x'.repeat(4001) },
    });
    expect(resOversized.statusCode).toBe(400);
    expect(JSON.parse(resOversized.payload).error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('translates AI errors to appropriate HTTP status codes and safe error envelopes', async () => {
    // 503 for AINotConfiguredError
    const unconfiguredProvider: AIProvider = {
      generate: async () => {
        throw new AINotConfiguredError();
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };

    const app503 = await buildApp({ env: dummyEnv, logger: false, aiProvider: unconfiguredProvider });
    const res503 = await app503.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 'Hello' },
    });
    expect(res503.statusCode).toBe(503);
    expect(JSON.parse(res503.payload).error.code).toBe('AI_NOT_CONFIGURED');
    await app503.close();

    // 429 for AIRateLimitedError
    const rateLimitedProvider: AIProvider = {
      generate: async () => {
        throw new AIRateLimitedError('Upstream rate limit exceeded', 30);
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };
    const app429 = await buildApp({ env: dummyEnv, logger: false, aiProvider: rateLimitedProvider });
    const res429 = await app429.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 'Hello' },
    });
    expect(res429.statusCode).toBe(429);
    expect(JSON.parse(res429.payload).error.code).toBe('AI_RATE_LIMITED');
    await app429.close();

    // 504 for AITimeoutError
    const timeoutProvider: AIProvider = {
      generate: async () => {
        throw new AITimeoutError('OpenRouter request timed out');
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };
    const app504 = await buildApp({ env: dummyEnv, logger: false, aiProvider: timeoutProvider });
    const res504 = await app504.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 'Hello' },
    });
    expect(res504.statusCode).toBe(504);
    expect(JSON.parse(res504.payload).error.code).toBe('AI_TIMEOUT');
    await app504.close();

    // 502 for AIAuthFailedError
    const authFailedProvider: AIProvider = {
      generate: async () => {
        throw new AIAuthFailedError('Invalid upstream key');
      },
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };
    const app502 = await buildApp({ env: dummyEnv, logger: false, aiProvider: authFailedProvider });
    const res502 = await app502.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: { message: 'Hello' },
    });
    expect(res502.statusCode).toBe(502);
    expect(JSON.parse(res502.payload).error.code).toBe('AI_AUTH_FAILED');
    await app502.close();
  });

  it('GET /api/ai/health returns 200 without exposing keys while /health remains AI-free', async () => {
    const mockAiProvider: AIProvider = {
      generate: async () => ({
        content: 'ok',
        model: 'test',
        finishReason: 'stop',
        usage: null,
        latencyMs: 1,
      }),
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };

    const app = await buildApp({ env: dummyEnv, logger: false, aiProvider: mockAiProvider });

    const aiHealthRes = await app.inject({
      method: 'GET',
      url: '/api/ai/health',
    });
    expect(aiHealthRes.statusCode).toBe(200);
    expect(JSON.parse(aiHealthRes.payload).provider).toBe('openrouter');

    const baseHealthRes = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(baseHealthRes.statusCode).toBe(200);
    // Base health endpoint has no AI references or dependencies
    expect(baseHealthRes.payload).not.toContain('openrouter');

    await app.close();
  });

  it('GET /api/ai/health reports provider as nvidia when NVIDIA_API_KEY is configured', async () => {
    const nvidiaEnv = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      NVIDIA_API_KEY: 'nvapi-mock-key',
    });

    const mockAiProvider: AIProvider = {
      generate: async () => ({
        content: 'ok',
        model: 'meta/llama-3.2-11b-vision-instruct',
        finishReason: 'stop',
        usage: null,
        latencyMs: 1,
      }),
      stream: () => {
        throw new Error();
      },
      generateWithTools: async () => {
        throw new Error();
      },
    };

    const app = await buildApp({ env: nvidiaEnv, logger: false, aiProvider: mockAiProvider });

    const aiHealthRes = await app.inject({
      method: 'GET',
      url: '/api/ai/health',
    });
    expect(aiHealthRes.statusCode).toBe(200);
    expect(JSON.parse(aiHealthRes.payload).provider).toBe('nvidia');

    await app.close();
  });
});
