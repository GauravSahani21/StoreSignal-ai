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

  it('loads Groq API key and resolves default Groq endpoint and model', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      GROQ_API_KEY: 'gsk_test_key_123',
    });

    expect(config.GROQ_API_KEY).toBe('gsk_test_key_123');
    expect(config.GROQ_BASE_URL).toBe('https://api.groq.com/openai/v1');
    expect(config.GROQ_MODEL).toBe('openai/gpt-oss-120b');
  });

  it('allows overriding GROQ_BASE_URL and GROQ_MODEL', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      GROQ_API_KEY: 'gsk_custom_key',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
      GROQ_MODEL: 'qwen/qwen3.8-27b',
    });

    expect(config.GROQ_MODEL).toBe('qwen/qwen3.8-27b');
    expect(config.GROQ_BASE_URL).toBe('https://api.groq.com/openai/v1');
  });

  it('works without GROQ_API_KEY (unconfigured state)', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
    });

    expect(config.GROQ_API_KEY).toBeUndefined();
    expect(config.GROQ_BASE_URL).toBe('https://api.groq.com/openai/v1');
    expect(config.GROQ_MODEL).toBe('openai/gpt-oss-120b');
  });
});
