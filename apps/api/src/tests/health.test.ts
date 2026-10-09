import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';

describe('GET /health', () => {
  it('returns 200 with status ok and no exposed secrets or external calls', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: 3001,
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
    });

    const app = await buildApp({ env, logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body.env).toBe('test');
    expect(typeof body.timestamp).toBe('string');

    // Strict security check: ensure no database connection strings or passwords leaked
    const payloadString = response.payload.toLowerCase();
    expect(payloadString).not.toContain('storesignal_dev_pwd');
    expect(payloadString).not.toContain('postgresql:');
    expect(payloadString).not.toContain('secret');

    await app.close();
  });
});
