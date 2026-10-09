import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createRepositories } from '../database/repositories/index.js';
import { MockSTTProvider } from '../providers/stt/MockSTTProvider.js';

describe('Speech-to-Text & Audio Ingestion API (Phase 4)', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  it('transcribes consented audio into stable segments and provides status updates', async () => {
    const repos = createRepositories();
    const mockSTT = new MockSTTProvider();
    const app = await buildApp({
      env: dummyEnv,
      logger: false,
      repositories: repos,
      sttProvider: mockSTT,
    });

    // 1. Create a conversation and grant audio consent
    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'audio_upload',
      isDemo: true,
    });
    await repos.consents.recordConsent({
      orgId: 'org-vayu-motors-dev',
      subject: conv.id,
      scope: 'audio_recording',
      method: 'verbal',
    });

    // 2. Upload sample audio data
    const dummyAudioBase64 = Buffer.from('RIFF....WAVEfmt....data....mock audio bytes').toString('base64');
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/audio`,
      payload: {
        audioBase64: dummyAudioBase64,
        mimeType: 'audio/wav',
        durationMs: 25000,
      },
    });

    expect(uploadRes.statusCode).toBe(200);
    const uploadData = JSON.parse(uploadRes.payload);
    expect(uploadData.status).toBe('completed');
    expect(uploadData.transcript.version).toBe(1);
    expect(uploadData.transcript.segments.length).toBeGreaterThan(0);
    expect(uploadData.audioFile.storageRef).toBeDefined();

    // 3. Check status polling
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conv.id}/transcription-status`,
    });
    expect(statusRes.statusCode).toBe(200);
    expect(JSON.parse(statusRes.payload).status).toBe('completed');

    await app.close();
  });

  it('strictly rejects audio processing when consent is absent', async () => {
    const repos = createRepositories();
    const app = await buildApp({
      env: dummyEnv,
      logger: false,
      repositories: repos,
      sttProvider: new MockSTTProvider(),
    });

    // Create conversation without recording consent
    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'audio_upload',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/audio`,
      payload: {
        audioBase64: Buffer.from('audio').toString('base64'),
        mimeType: 'audio/wav',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error.message).toContain('consent');

    await app.close();
  });

  it('rejects unsupported audio formats with 400 STT_UNSUPPORTED_FORMAT', async () => {
    const repos = createRepositories();
    const app = await buildApp({
      env: dummyEnv,
      logger: false,
      repositories: repos,
      sttProvider: new MockSTTProvider(),
    });

    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'audio_upload',
    });
    await repos.consents.recordConsent({
      orgId: 'org-vayu-motors-dev',
      subject: conv.id,
      scope: 'audio_recording',
      method: 'digital',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conv.id}/audio`,
      payload: {
        audioBase64: Buffer.from('fake data').toString('base64'),
        mimeType: 'video/avi', // Invalid
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error.code).toBe('STT_UNSUPPORTED_FORMAT');

    await app.close();
  });

  it('allows transcript edits by creating immutable version N+1 with fresh segments', async () => {
    const repos = createRepositories();
    const app = await buildApp({
      env: dummyEnv,
      logger: false,
      repositories: repos,
      sttProvider: new MockSTTProvider(),
    });

    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'transcript_import',
    });
    await repos.conversations.createTranscriptWithSegments({
      orgId: 'org-vayu-motors-dev',
      conversationId: conv.id,
      version: 1,
      rawText: 'Advisor: Initial version.',
      segments: [],
    });

    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/conversations/${conv.id}/transcript`,
      payload: {
        rawTranscript:
          '[00:00:04] Advisor: Corrected greeting!\n[00:00:10] Customer: Perfect, thank you.',
      },
    });

    expect(editRes.statusCode).toBe(200);
    const data = JSON.parse(editRes.payload);
    expect(data.transcript.version).toBe(2);
    expect(data.transcript.segments).toHaveLength(2);

    await app.close();
  });

  it('supports right-to-erasure by deleting audio record', async () => {
    const repos = createRepositories();
    const app = await buildApp({
      env: dummyEnv,
      logger: false,
      repositories: repos,
      sttProvider: new MockSTTProvider(),
    });

    const conv = await repos.conversations.createConversation({
      orgId: 'org-vayu-motors-dev',
      source: 'audio_upload',
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${conv.id}/audio`,
    });

    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).message).toContain('deleted securely');

    await app.close();
  });
});
