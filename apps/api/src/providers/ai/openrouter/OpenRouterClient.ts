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
} from '../../../errors/AppError.js';
import type { AIRequest, AIResponse, AIUsage } from '../types.js';

export interface OpenRouterClientConfig {
  apiKey: string;
  appUrl: string;
  defaultModel: string;
  defaultTimeoutMs: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export interface OpenRouterCompletionChoice {
  message: {
    role: string;
    content: string | null;
  };
  finish_reason: string;
}

export interface OpenRouterCompletionResponse {
  id?: string;
  model: string;
  choices?: OpenRouterCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    code?: string | number;
    metadata?: Record<string, unknown>;
  };
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly appUrl: string;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly maxRetries: number;

  constructor(config: OpenRouterClientConfig) {
    this.apiKey = config.apiKey;
    this.appUrl = config.appUrl;
    this.defaultModel = config.defaultModel;
    this.defaultTimeoutMs = config.defaultTimeoutMs;
    this.baseUrl = config.baseUrl ?? 'https://openrouter.ai/api/v1';
    this.fetchFn = config.fetchFn ?? fetch;
    this.maxRetries = config.maxRetries ?? (process.env.NODE_ENV === 'test' ? 0 : 2);
  }

  async createChatCompletion(request: AIRequest): Promise<AIResponse> {
    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();

    const payload: Record<string, unknown> = {
      model,
      messages: request.messages,
    };

    if (typeof request.temperature === 'number') {
      payload.temperature = request.temperature;
    }
    if (typeof request.maxTokens === 'number') {
      payload.max_tokens = request.maxTokens;
    }
    if (request.responseFormat) {
      if (request.responseFormat.type === 'json_object') {
        payload.response_format = { type: 'json_object' };
      } else if (request.responseFormat.type === 'json_schema' && request.responseFormat.jsonSchema) {
        payload.response_format = {
          type: 'json_schema',
          json_schema: request.responseFormat.jsonSchema,
        };
      }
    }

    let response!: Response;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const attemptController = new AbortController();
      const attemptTimeout = setTimeout(() => {
        attemptController.abort();
      }, this.defaultTimeoutMs);

      if (request.signal) {
        request.signal.addEventListener('abort', () => {
          attemptController.abort();
        });
      }

      try {
        response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.appUrl,
            'X-Title': 'StoreSignal AI',
          },
          body: JSON.stringify(payload),
          signal: attemptController.signal,
        });
      } catch (err: unknown) {
        clearTimeout(attemptTimeout);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new AITimeoutError(`OpenRouter request timed out after ${this.defaultTimeoutMs}ms`);
        }
        throw new AINetworkError(
          `Failed to connect to OpenRouter upstream gateway: ${err instanceof Error ? err.message : 'Network error'}`
        );
      } finally {
        clearTimeout(attemptTimeout);
      }

      // Check for rate limiting (429) retry
      if (response.status === 429 && attempt < this.maxRetries) {
        attempt++;
        let waitMs = 2500 * attempt;
        try {
          const clone = response.clone();
          const errJson = (await clone.json()) as { error?: { message?: string } };
          const errMsg = errJson.error?.message || '';
          const match = errMsg.match(/try again in ([\d.]+)s/i);
          if (match && match[1]) {
            const secs = parseFloat(match[1]);
            if (!isNaN(secs) && secs > 0 && secs < 35) {
              waitMs = Math.ceil(secs * 1000) + 600;
            }
          }
        } catch {
          // ignore parsing error
        }
        await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }

      break;
    }

    const latencyMs = Date.now() - startTime;
    const providerRequestId = response.headers.get('x-request-id') ?? undefined;

    // Handle HTTP status code failures per §7.5 taxonomy
    if (!response.ok) {
      await this.handleHttpError(response);
    }

    let data: OpenRouterCompletionResponse;
    try {
      const rawText = await response.text();
      if (!rawText.trim()) {
        throw new AIEmptyResponseError('OpenRouter returned an empty response body');
      }
      data = JSON.parse(rawText) as OpenRouterCompletionResponse;
    } catch (err) {
      if (err instanceof AIEmptyResponseError) {
        throw err;
      }
      throw new AIBadResponseError(
        `Failed to parse OpenRouter completion response JSON: ${err instanceof Error ? err.message : 'Invalid JSON'}`
      );
    }

    if (data.error) {
      this.handleOpenRouterJsonError(data.error);
    }

    const firstChoice = data.choices?.[0];
    if (!firstChoice || !firstChoice.message) {
      throw new AIEmptyResponseError('OpenRouter response contains no valid completion choices');
    }

    const content = firstChoice.message.content ?? '';
    if (!content.trim()) {
      throw new AIEmptyResponseError('OpenRouter returned empty message content');
    }

    const usage: AIUsage | null = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : null;

    return {
      content,
      model: data.model || model,
      finishReason: firstChoice.finish_reason || 'stop',
      usage,
      latencyMs,
      providerRequestId: data.id ?? providerRequestId,
    };
  }

  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;
    let errorDetail = '';
    try {
      const errorJson = (await response.json()) as { error?: { message?: string } };
      errorDetail = errorJson.error?.message ?? '';
    } catch {
      // Body may not be JSON
    }

    if (status === 401) {
      throw new AIAuthFailedError('OpenRouter rejected API key authorization (401 Unauthorized)');
    }

    if (status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retrySeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
      throw new AIRateLimitedError(
        `OpenRouter rate limit reached (429): ${errorDetail || 'Too Many Requests'}`,
        Number.isFinite(retrySeconds) ? retrySeconds : undefined
      );
    }

    if (status === 402 || errorDetail.toLowerCase().includes('quota') || errorDetail.toLowerCase().includes('credit')) {
      throw new AIQuotaExceededError(
        `OpenRouter credit balance or quota exhausted: ${errorDetail || 'Payment Required'}`
      );
    }

    if (status === 404 || errorDetail.toLowerCase().includes('model not found')) {
      throw new AIModelUnavailableError(`Requested model unavailable on OpenRouter: ${errorDetail || 'Not Found'}`);
    }

    if (status >= 500) {
      throw new AIUpstreamError(`OpenRouter upstream service error (${status}): ${errorDetail || 'Server Error'}`);
    }

    throw new AIBadResponseError(`OpenRouter returned unexpected error status ${status}: ${errorDetail}`);
  }

  private handleOpenRouterJsonError(error: { message: string; code?: string | number }): never {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit')) {
      throw new AIRateLimitedError(`OpenRouter rate limit: ${error.message}`);
    }
    if (msg.includes('credit') || msg.includes('quota') || msg.includes('balance')) {
      throw new AIQuotaExceededError(`OpenRouter quota exceeded: ${error.message}`);
    }
    if (msg.includes('model') && (msg.includes('not found') || msg.includes('unavailable'))) {
      throw new AIModelUnavailableError(`OpenRouter model unavailable: ${error.message}`);
    }
    throw new AIBadResponseError(`OpenRouter returned error: ${error.message}`);
  }
}
