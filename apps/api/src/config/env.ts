import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev'),

  // NVIDIA NIM Gateway Configuration (Primary)
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL: z.string().default('meta/llama-3.2-11b-vision-instruct'),

  // OpenRouter Gateway Configuration (Alternative / Fallback)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.0-flash-001'),
  OPENROUTER_FALLBACK_MODEL: z.string().optional(),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),

  // Speech-to-Text Configuration
  STT_PROVIDER: z.enum(['whisper', 'mock']).default('mock'),
  STT_API_KEY: z.string().optional(),
  STT_DEFAULT_LANGUAGE: z.string().default('en'),
  AUDIO_MAX_BYTES: z.coerce.number().int().default(26214400), // 25MB
  AUDIO_MAX_SECONDS: z.coerce.number().int().default(600), // 10 minutes
  UPLOAD_DIR: z.string().default('uploads'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export class EnvValidationError extends Error {
  public readonly missingOrInvalidFields: string[];

  constructor(issues: z.ZodIssue[]) {
    const fields = issues.map((issue) => issue.path.join('.')).filter(Boolean);
    const uniqueFields = Array.from(new Set(fields));
    super(
      `Configuration validation failed for environment variables: ${uniqueFields.join(', ')}`
    );
    this.name = 'EnvValidationError';
    this.missingOrInvalidFields = uniqueFields;
  }
}

let cachedEnv: EnvConfig | null = null;

function normalizeEnvSource(source: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...source };

  // First-class NVIDIA API Key
  if (typeof normalized.NVIDIA_API_KEY === 'string' && normalized.NVIDIA_API_KEY.trim()) {
    if (!normalized.OPENROUTER_API_KEY) {
      normalized.OPENROUTER_API_KEY = normalized.NVIDIA_API_KEY;
    }
    if (!normalized.OPENROUTER_BASE_URL || normalized.OPENROUTER_BASE_URL === 'https://openrouter.ai/api/v1') {
      normalized.OPENROUTER_BASE_URL = normalized.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    }
    if (!normalized.OPENROUTER_MODEL || normalized.OPENROUTER_MODEL === 'google/gemini-2.0-flash-001') {
      normalized.OPENROUTER_MODEL = normalized.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct';
    }
  }

  // OpenRouter key starting with nvapi- (NVIDIA key provided via OPENROUTER_API_KEY)
  if (typeof normalized.OPENROUTER_API_KEY === 'string' && normalized.OPENROUTER_API_KEY.startsWith('nvapi-')) {
    if (!normalized.NVIDIA_API_KEY) {
      normalized.NVIDIA_API_KEY = normalized.OPENROUTER_API_KEY;
    }
    if (!normalized.OPENROUTER_BASE_URL || normalized.OPENROUTER_BASE_URL === 'https://openrouter.ai/api/v1') {
      normalized.OPENROUTER_BASE_URL = 'https://integrate.api.nvidia.com/v1';
    }
    if (!normalized.OPENROUTER_MODEL || normalized.OPENROUTER_MODEL === 'google/gemini-2.0-flash-001') {
      normalized.OPENROUTER_MODEL = 'meta/llama-3.2-11b-vision-instruct';
    }
  }

  return normalized;
}

export function loadEnv(customSource?: Record<string, unknown>): EnvConfig {
  if (customSource) {
    const normalized = normalizeEnvSource(customSource);
    const result = EnvSchema.safeParse(normalized);
    if (!result.success) {
      throw new EnvValidationError(result.error.issues);
    }
    return result.data;
  }

  if (cachedEnv) {
    return cachedEnv;
  }

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {
      try {
        process.loadEnvFile('../../.env');
      } catch {
        // Ignore if no .env file exists
      }
    }
  }

  const rawEnv = normalizeEnvSource(process.env as Record<string, unknown>);

  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetCachedEnv(): void {
  cachedEnv = null;
}
