import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev'),

  // Phase 2: OpenRouter Gateway Configuration
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.0-flash-001'),
  OPENROUTER_FALLBACK_MODEL: z.string().optional(),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),

  // Phase 4: Speech-to-Text Configuration
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

export function loadEnv(customSource?: Record<string, unknown>): EnvConfig {
  if (customSource) {
    const result = EnvSchema.safeParse(customSource);
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

  const rawEnv: Record<string, unknown> = { ...process.env };
  // If API key starts with nvapi- and no base URL was explicitly configured, use NVIDIA API endpoint
  if (typeof rawEnv.OPENROUTER_API_KEY === 'string' && rawEnv.OPENROUTER_API_KEY.startsWith('nvapi-')) {
    if (!rawEnv.OPENROUTER_BASE_URL) {
      rawEnv.OPENROUTER_BASE_URL = 'https://integrate.api.nvidia.com/v1';
    }
    if (!rawEnv.OPENROUTER_MODEL || rawEnv.OPENROUTER_MODEL === 'google/gemini-2.0-flash-001') {
      rawEnv.OPENROUTER_MODEL = 'meta/llama-3.2-11b-vision-instruct';
    }
  }

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
