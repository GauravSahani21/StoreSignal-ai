import {
  AIModelUnavailableError,
  AINotConfiguredError,
  AIRateLimitedError,
  NotImplementedError,
} from '../../../errors/AppError.js';
import type { AIChunk, AIProvider, AIRequest, AIResponse } from '../types.js';
import { OpenRouterClient } from './OpenRouterClient.js';

export interface OpenRouterProviderConfig {
  apiKey?: string;
  appUrl: string;
  baseUrl?: string;
  model: string;
  fallbackModel?: string;
  timeoutMs: number;
  client?: OpenRouterClient;
  fallbackClient?: OpenRouterClient;
}

export class OpenRouterProvider implements AIProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fallbackModel?: string;
  private readonly client?: OpenRouterClient;
  private readonly fallbackClient?: OpenRouterClient;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.fallbackModel = config.fallbackModel;

    if (config.client) {
      this.client = config.client;
    } else if (this.apiKey) {
      this.client = new OpenRouterClient({
        apiKey: this.apiKey,
        appUrl: config.appUrl,
        baseUrl: config.baseUrl,
        defaultModel: this.model,
        defaultTimeoutMs: config.timeoutMs,
      });
    }

    if (config.fallbackClient) {
      this.fallbackClient = config.fallbackClient;
    } else if (this.apiKey && this.fallbackModel) {
      this.fallbackClient = new OpenRouterClient({
        apiKey: this.apiKey,
        appUrl: config.appUrl,
        baseUrl: config.baseUrl,
        defaultModel: this.fallbackModel,
        defaultTimeoutMs: config.timeoutMs,
      });
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.apiKey && !this.client) {
      throw new AINotConfiguredError(
        'The OpenRouter AI gateway is not configured with OPENROUTER_API_KEY. Please provide a valid key.'
      );
    }

    const primaryClient = this.client!;
    const requestedModel = request.model ?? this.model;

    try {
      return await primaryClient.createChatCompletion({
        ...request,
        model: requestedModel,
      });
    } catch (primaryError: unknown) {
      // Documented fallback trigger conditions:
      // Fallback is only attempted if fallbackModel is configured AND the error is AIModelUnavailableError or AIRateLimitedError
      const isEligibleForFallback =
        this.fallbackModel &&
        this.fallbackClient &&
        requestedModel !== this.fallbackModel &&
        (primaryError instanceof AIModelUnavailableError || primaryError instanceof AIRateLimitedError);

      if (!isEligibleForFallback) {
        throw primaryError;
      }

      // Execute single attempt with fallback model
      try {
        const fallbackResponse = await this.fallbackClient!.createChatCompletion({
          ...request,
          model: this.fallbackModel,
        });

        return {
          ...fallbackResponse,
          model: fallbackResponse.model || this.fallbackModel,
        };
      } catch {
        // If fallback also fails, rethrow original primary error to maintain accurate root cause
        throw primaryError;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *stream(_request: AIRequest): AsyncIterable<AIChunk> {
    throw new NotImplementedError('Streaming completions are not implemented for the current phase.');
  }

  async generateWithTools(_request: AIRequest): Promise<AIResponse> {
    throw new NotImplementedError('Direct tool calling is not implemented for the current phase.');
  }
}
