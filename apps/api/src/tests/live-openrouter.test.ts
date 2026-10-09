import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';

describe('Live OpenRouter Gateway Integration (Gated)', () => {
  const isLiveEnabled = process.env.RUN_LIVE_TESTS === '1';
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());

  if (!isLiveEnabled || !hasApiKey) {
    it.skip('Skipping live OpenRouter test (requires RUN_LIVE_TESTS=1 and OPENROUTER_API_KEY)', () => {
      // Skipped in automated/CI runs without credentials
    });
    return;
  }

  it('executes a real end-to-end request through Fastify to OpenRouter and returns grounded response', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
    });

    const app = await buildApp({ env, logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      payload: {
        message: 'Respond strictly with the single word: STORE_SIGNAL_VERIFIED',
      },
    });

    expect(response.statusCode).toBe(200);

    const data = JSON.parse(response.payload);
    expect(data.response).toBeDefined();
    expect(data.response.length).toBeGreaterThan(0);
    expect(data.model).toBeDefined();
    expect(data.latencyMs).toBeGreaterThan(0);

    await app.close();
  });
});
