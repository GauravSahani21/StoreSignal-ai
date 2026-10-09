# ADR 002: Centralized OpenRouter LLM Gateway and Error Taxonomy

## Status
Accepted

## Context
StoreSignal AI relies on multi-agent retail reasoning and transcription analysis. All AI interactions must flow through a single, resilient backend gateway with zero client-side secret exposure, strict timeouts, structured error handling, usage/latency tracking, and transparent model fallback mechanics.

## Decision
1. **Single LLM Gateway:** OpenRouter (`https://openrouter.ai/api/v1`) is the sole LLM provider gateway. Direct integrations to OpenAI, Anthropic, or Groq are prohibited per the Operating Contract (§0.1, §0.4).
2. **Provider Abstraction:** Define `AIProvider` (`generate`, `stream`, `generateWithTools`) implemented by `OpenRouterProvider`, backed by `OpenRouterClient`.
3. **Structured Error Taxonomy (§7.5):** All upstream OpenRouter errors, network timeouts, invalid JSON, and rate limits are translated into typed subclasses of `AppError` (`AIAuthFailedError`, `AIRateLimitedError`, `AIQuotaExceededError`, `AIModelUnavailableError`, `AITimeoutError`, `AINetworkError`, `AIUpstreamError`, `AIBadResponseError`, `AIEmptyResponseError`, `AINotConfiguredError`).
4. **Secret-Safe Error Envelopes:** Client responses receive `{ error: { code, message, requestId } }`. Stack traces, raw upstream JSON containing credential fragments, and environment tokens are strictly redacted and never exposed.
5. **Fallback Model Mechanics:** Fallback model is triggered solely when the primary model encounters `AI_MODEL_UNAVAILABLE` or `AI_RATE_LIMITED`. Auth failures, missing keys, or timeouts do not trigger fallback, preserving true root causes. The actual model servicing the request is always recorded in responses and traces.
6. **Separation of Health:** The `/health` endpoint remains completely AI-free and lightweight. A dedicated `/api/ai/health` endpoint exists for AI configuration status.

## Consequences
- Single point of monitoring, logging, and token usage calculation.
- Front-end applications have zero exposure to `OPENROUTER_API_KEY`.
- Test suite validates complete error taxonomy via deterministic mocked transport and opt-in live tests (`RUN_LIVE_TESTS=1`).
