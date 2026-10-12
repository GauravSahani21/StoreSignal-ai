import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';

describe('Live Groq Gateway Integration (Gated)', () => {
  const isLiveEnabled = process.env.RUN_LIVE_TESTS === '1';
  const hasApiKey = Boolean(process.env.GROQ_API_KEY?.trim());

  if (!isLiveEnabled || !hasApiKey) {
    it.skip('Skipping live Groq test (requires RUN_LIVE_TESTS=1 and GROQ_API_KEY)', () => {
      // Skipped in automated/CI runs without credentials
    });
    return;
  }

  it('executes a real end-to-end request through Fastify to Groq and returns grounded response', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
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
