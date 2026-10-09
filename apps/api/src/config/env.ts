import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export class EnvValidationError extends Error {
  public readonly missingOrInvalidFields: string[];

  constructor(issues: z.ZodIssue[]) {
    // Only output field names, never raw values or credential fragments
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

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetCachedEnv(): void {
  cachedEnv = null;
}
