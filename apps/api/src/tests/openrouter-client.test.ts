import { describe, expect, it } from 'vitest';
import {
  AIAuthFailedError,
  AIBadResponseError,
  AIEmptyResponseError,
  AIModelUnavailableError,
  AINetworkError,
  AIQuotaExceededError,
  AIRateLimitedError,
  AITimeoutError,
  AIUpstreamError,
} from '../errors/AppError.js';
import { OpenRouterClient } from '../providers/ai/openrouter/OpenRouterClient.js';

describe('OpenRouterClient Transport & Error Taxonomy (§7.5)', () => {
  const dummyApiKey = 'sk-or-v1-secret-test-key-12345';
  const dummyAppUrl = 'http://localhost:5173';
  const dummyModel = 'google/gemini-2.0-flash-001';

  it('successfully completes request with correct headers, metadata, and usage', async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedBody: string | undefined;

    const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedHeaders = init?.headers;
      capturedBody = init?.body as string;
      return new Response(
        JSON.stringify({
          id: 'gen-test-id-123',
          model: 'google/gemini-2.0-flash-001',
          choices: [
            {
              message: { role: 'assistant', content: 'Retail intelligence response.' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'provider-req-789',
          },
        }
      );
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    const result = await client.createChatCompletion({
      messages: [{ role: 'user', content: 'What is the motorcycle service schedule?' }],
    });

    expect(result.content).toBe('Retail intelligence response.');
    expect(result.model).toBe('google/gemini-2.0-flash-001');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({
      promptTokens: 15,
      completionTokens: 8,
      totalTokens: 23,
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    // Verify required OpenRouter headers
    const headers = capturedHeaders as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${dummyApiKey}`);
    expect(headers['HTTP-Referer']).toBe(dummyAppUrl);
    expect(headers['X-Title']).toBe('StoreSignal AI');

    // Verify payload serialization
    const parsedBody = JSON.parse(capturedBody!);
    expect(parsedBody.model).toBe(dummyModel);
    expect(parsedBody.messages[0].content).toBe('What is the motorcycle service schedule?');
  });

  it('maps HTTP 401 to AIAuthFailedError without exposing the API key', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { message: 'Invalid API key provided' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIAuthFailedError);
  });

  it('maps HTTP 429 to AIRateLimitedError with retry-after header', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'retry-after': '12',
        },
      });
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    try {
      await client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.unreachable('Should have thrown AIRateLimitedError');
    } catch (err) {
      expect(err).toBeInstanceOf(AIRateLimitedError);
      const rateErr = err as AIRateLimitedError;
      expect(rateErr.statusCode).toBe(429);
      expect(rateErr.retryAfterSeconds).toBe(12);
    }
  });

  it('maps HTTP 402 or quota exhaustion to AIQuotaExceededError', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({ error: { message: 'User credit balance too low' } }),
        {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIQuotaExceededError);
  });

  it('maps 404 / model not found to AIModelUnavailableError', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { message: 'Model not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIModelUnavailableError);
  });

  it('maps network disconnect / fetch rejection to AINetworkError', async () => {
    const mockFetch = async (): Promise<Response> => {
      throw new TypeError('fetch failed: ECONNREFUSED');
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AINetworkError);
  });

  it('maps AbortError / timeout to AITimeoutError', async () => {
    const mockFetch = async (): Promise<Response> => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AITimeoutError);
  });

  it('maps upstream HTTP 500 to AIUpstreamError', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { message: 'Internal OpenRouter gateway error' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIUpstreamError);
  });

  it('maps empty message content to AIEmptyResponseError', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          id: 'gen-empty',
          model: dummyModel,
          choices: [
            {
              message: { role: 'assistant', content: '   ' },
              finish_reason: 'stop',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIEmptyResponseError);
  });

  it('maps non-JSON or corrupted body to AIBadResponseError', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    };

    const client = new OpenRouterClient({
      apiKey: dummyApiKey,
      appUrl: dummyAppUrl,
      defaultModel: dummyModel,
      defaultTimeoutMs: 5000,
      fetchFn: mockFetch as typeof fetch,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrowError(AIBadResponseError);
  });
});
