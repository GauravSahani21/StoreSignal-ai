import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createRepositories } from '../database/repositories/index.js';

describe('Conversations and Consent API (Phase 3)', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  it('creates, parses, and retrieves a conversation with stable segments and consent record', async () => {
    const repos = createRepositories();
    const app = await buildApp({ env: dummyEnv, logger: false, repositories: repos });

    const rawTranscript = `
[00:00:05] Advisor: Good morning! Looking for the Vayu Agni 125?
[00:00:10] Customer: Yes, what is the on-road price and delivery timeline in Bengaluru?
[00:00:18] Advisor: The Agni 125 starts at ₹88,000 ex-showroom. We have silver in stock.
    `.trim();

    // 1. Ingest conversation with explicit consent
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      payload: {
        rawTranscript,
        hasConsent: true,
        consentMethod: 'verbal',
        source: 'transcript_import',
        isDemo: true,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createData = JSON.parse(createRes.payload);
    expect(createData.conversation).toBeDefined();
    expect(createData.conversation.id).toMatch(/^conv-/);
    expect(createData.conversation.status).toBe('ingested');
    expect(createData.transcript.version).toBe(1);
    expect(createData.transcript.segmentCount).toBe(3);
    expect(createData.transcript.segments[1].speaker).toBe('customer');
    expect(createData.transcript.segments[1].text).toContain('what is the on-road price');

    const conversationId = createData.conversation.id;

    // 2. Retrieve conversation by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversationId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getData = JSON.parse(getRes.payload);
    expect(getData.id).toBe(conversationId);
    expect(getData.latestTranscript.segments).toHaveLength(3);

    // 3. List conversations
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/conversations',
    });
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.payload);
    expect(listData.items.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('strictly rejects conversation ingestion when consent is missing or false', async () => {
    const repos = createRepositories();
    const app = await buildApp({ env: dummyEnv, logger: false, repositories: repos });

    // hasConsent = false
    const resFalse = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      payload: {
        rawTranscript: 'Advisor: Hello!\nCustomer: Hi!',
        hasConsent: false,
      },
    });

    expect(resFalse.statusCode).toBe(400);
    expect(JSON.parse(resFalse.payload).error.message).toContain('consent');

    // hasConsent missing
    const resMissing = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      payload: {
        rawTranscript: 'Advisor: Hello!\nCustomer: Hi!',
      },
    });

    expect(resMissing.statusCode).toBe(400);
    expect(JSON.parse(resMissing.payload).error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('enforces tenant isolation: denying cross-org conversation retrieval', async () => {
    const repos = createRepositories();
    const app = await buildApp({ env: dummyEnv, logger: false, repositories: repos });

    // Create conversation under Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { 'x-org-id': 'org-tenant-alpha' },
      payload: {
        rawTranscript: 'Advisor: Welcome to Store Alpha!\nCustomer: Hello Alpha.',
        hasConsent: true,
      },
    });
    expect(resA.statusCode).toBe(201);
    const convId = JSON.parse(resA.payload).conversation.id;

    // Attempt to access conversation using Tenant B credentials
    const resB = await app.inject({
      method: 'GET',
      url: `/api/conversations/${convId}`,
      headers: { 'x-org-id': 'org-tenant-beta' },
    });

    // Cross-tenant access must return 404 (or 403) and never leak data
    expect(resB.statusCode).toBe(404);

    await app.close();
  });
});
