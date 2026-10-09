import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';

describe('Error Envelope & Centralized Error Handler', () => {
  it('formats custom AppError into the standard envelope { error: { code, message, requestId } }', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
    });

    const app = await buildApp({ env, logger: false });

    // Register a test route that throws ValidationError
    app.get('/test-validation-error', async () => {
      throw new ValidationError('The specified parameter is missing or invalid');
    });

    // Register a test route that throws NotFoundError
    app.get('/test-not-found-error', async () => {
      throw new NotFoundError('Conversation session 123 was not found');
    });

    // Test ValidationError response
    const valRes = await app.inject({
      method: 'GET',
      url: '/test-validation-error',
      headers: { 'x-request-id': 'req-test-val-1' },
    });

    expect(valRes.statusCode).toBe(400);
    const valBody = JSON.parse(valRes.payload);
    expect(valBody).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The specified parameter is missing or invalid',
        requestId: 'req-test-val-1',
      },
    });

    // Test NotFoundError response
    const nfRes = await app.inject({
      method: 'GET',
      url: '/test-not-found-error',
      headers: { 'x-request-id': 'req-test-nf-2' },
    });

    expect(nfRes.statusCode).toBe(404);
    const nfBody = JSON.parse(nfRes.payload);
    expect(nfBody).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Conversation session 123 was not found',
        requestId: 'req-test-nf-2',
      },
    });

    await app.close();
  });

  it('handles unexpected exceptions cleanly without leaking internal stacks', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
    });

    const app = await buildApp({ env, logger: false });

    app.get('/test-unexpected-error', async () => {
      throw new Error('Database password was password123 and failed connection');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-unexpected-error',
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected internal error occurred. Please try again later.');
    expect(body.error.requestId).toBeDefined();

    // Verify stack and sensitive details are never sent to client
    expect(res.payload).not.toContain('password123');
    expect(res.payload).not.toContain('at async');

    await app.close();
  });
});
