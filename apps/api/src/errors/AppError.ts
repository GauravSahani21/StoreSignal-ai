export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTH_REQUIRED';
  readonly statusCode = 401;
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;
}

export class NotImplementedError extends AppError {
  readonly code = 'NOT_IMPLEMENTED';
  readonly statusCode = 501;
}

// --- §7.5 AI Provider Error Taxonomy ---

export class AINotConfiguredError extends AppError {
  readonly code = 'AI_NOT_CONFIGURED';
  readonly statusCode = 503;

  constructor(message = 'The AI gateway is not configured with an API key.') {
    super(message);
  }
}

export class AIAuthFailedError extends AppError {
  readonly code = 'AI_AUTH_FAILED';
  readonly statusCode = 502;

  constructor(message = 'Upstream AI provider authentication failed.') {
    super(message);
  }
}

export class AIRateLimitedError extends AppError {
  readonly code = 'AI_RATE_LIMITED';
  readonly statusCode = 429;
  public readonly retryAfterSeconds?: number;

  constructor(message = 'Upstream AI provider rate limit reached.', retryAfterSeconds?: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AIQuotaExceededError extends AppError {
  readonly code = 'AI_QUOTA_EXCEEDED';
  readonly statusCode = 503;

  constructor(message = 'Upstream AI provider quota or credit balance exceeded.') {
    super(message);
  }
}

export class AIModelUnavailableError extends AppError {
  readonly code = 'AI_MODEL_UNAVAILABLE';
  readonly statusCode = 502;

  constructor(message = 'The requested AI model is unavailable or invalid.') {
    super(message);
  }
}

export class AITimeoutError extends AppError {
  readonly code = 'AI_TIMEOUT';
  readonly statusCode = 504;

  constructor(message = 'The upstream AI request timed out.') {
    super(message);
  }
}

export class AINetworkError extends AppError {
  readonly code = 'AI_NETWORK_ERROR';
  readonly statusCode = 502;

  constructor(message = 'Network connection to the upstream AI provider failed.') {
    super(message);
  }
}

export class AIUpstreamError extends AppError {
  readonly code = 'AI_UPSTREAM_ERROR';
  readonly statusCode = 502;

  constructor(message = 'Upstream AI provider encountered an internal error.') {
    super(message);
  }
}

export class AIBadResponseError extends AppError {
  readonly code = 'AI_BAD_RESPONSE';
  readonly statusCode = 502;

  constructor(message = 'Upstream AI provider returned a malformed response.') {
    super(message);
  }
}

export class AIEmptyResponseError extends AppError {
  readonly code = 'AI_EMPTY_RESPONSE';
  readonly statusCode = 502;

  constructor(message = 'Upstream AI provider returned an empty completion.') {
    super(message);
  }
}

export class AIUnsupportedToolCallError extends AppError {
  readonly code = 'AI_UNSUPPORTED_TOOL_CALL';
  readonly statusCode = 502;

  constructor(message = 'The AI model attempted an unsupported or malformed tool call.') {
    super(message);
  }
}

export class AgentOutputInvalidError extends AppError {
  readonly code = 'AGENT_OUTPUT_INVALID';
  readonly statusCode = 422;

  constructor(message = 'Agent structured output failed validation schema after retries.') {
    super(message);
  }
}

// --- Phase 4 STT Error Taxonomy ---

export class STTUnsupportedFormatError extends AppError {
  readonly code = 'STT_UNSUPPORTED_FORMAT';
  readonly statusCode = 400;

  constructor(message = 'Uploaded audio format is not supported.') {
    super(message);
  }
}

export class STTTooLargeError extends AppError {
  readonly code = 'STT_TOO_LARGE';
  readonly statusCode = 413;

  constructor(message = 'Audio file exceeds the maximum allowed size or duration limit.') {
    super(message);
  }
}

export class STTEmptyError extends AppError {
  readonly code = 'STT_EMPTY';
  readonly statusCode = 422;

  constructor(message = 'The audio recording was empty or contained no audible speech.') {
    super(message);
  }
}

export class STTTimeoutError extends AppError {
  readonly code = 'STT_TIMEOUT';
  readonly statusCode = 504;

  constructor(message = 'Speech-to-text transcription service timed out.') {
    super(message);
  }
}

export class STTProviderError extends AppError {
  readonly code = 'STT_PROVIDER_ERROR';
  readonly statusCode = 502;

  constructor(message = 'Upstream speech-to-text service error.') {
    super(message);
  }
}
