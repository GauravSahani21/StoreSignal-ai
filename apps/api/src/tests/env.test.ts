import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../config/env.js';

describe('Environment Configuration Loader', () => {
  it('parses valid environment variables with correct defaults', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      APP_URL: 'https://app.storesignal.ai',
      DATABASE_URL: 'postgresql://usr:secret123@localhost:5432/db',
    });

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.APP_URL).toBe('https://app.storesignal.ai');
    expect(config.DATABASE_URL).toBe('postgresql://usr:secret123@localhost:5432/db');
  });

  it('fails fast on invalid port numbers and identifies the field without leaking values', () => {
    expect(() =>
      loadEnv({
        PORT: '999999', // invalid port
        DATABASE_URL: 'postgresql://usr:secret_pass@localhost:5432/db',
      })
    ).toThrowError(EnvValidationError);

    try {
      loadEnv({
        PORT: 'not-a-number',
        DATABASE_URL: 'postgresql://usr:secret_pass@localhost:5432/db',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const envErr = err as EnvValidationError;
      expect(envErr.missingOrInvalidFields).toContain('PORT');
      // Must not leak any passwords or credential values in error message
      expect(envErr.message).not.toContain('secret_pass');
    }
  });

  it('fails fast on invalid APP_URL', () => {
    try {
      loadEnv({
        APP_URL: 'not-a-valid-url',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const envErr = err as EnvValidationError;
      expect(envErr.missingOrInvalidFields).toContain('APP_URL');
    }
  });

  it('normalizes first-class NVIDIA_API_KEY to configure NVIDIA endpoint and default model', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      NVIDIA_API_KEY: 'nvapi-test-key-123',
    });

    expect(config.NVIDIA_API_KEY).toBe('nvapi-test-key-123');
    expect(config.NVIDIA_BASE_URL).toBe('https://integrate.api.nvidia.com/v1');
    expect(config.NVIDIA_MODEL).toBe('meta/llama-3.2-11b-vision-instruct');
    expect(config.OPENROUTER_API_KEY).toBe('nvapi-test-key-123');
    expect(config.OPENROUTER_BASE_URL).toBe('https://integrate.api.nvidia.com/v1');
    expect(config.OPENROUTER_MODEL).toBe('meta/llama-3.2-11b-vision-instruct');
  });

  it('normalizes nvapi- prefixed OPENROUTER_API_KEY to NVIDIA gateway', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      OPENROUTER_API_KEY: 'nvapi-legacy-key-456',
    });

    expect(config.NVIDIA_API_KEY).toBe('nvapi-legacy-key-456');
    expect(config.OPENROUTER_BASE_URL).toBe('https://integrate.api.nvidia.com/v1');
    expect(config.OPENROUTER_MODEL).toBe('meta/llama-3.2-11b-vision-instruct');
  });
});

