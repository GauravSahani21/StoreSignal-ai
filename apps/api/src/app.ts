import crypto from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { type EnvConfig, loadEnv } from './config/env.js';
import { errorHandler } from './errors/errorHandler.js';
import { OpenRouterProvider } from './providers/ai/openrouter/OpenRouterProvider.js';
import type { AIProvider } from './providers/ai/types.js';
import { aiRoutes } from './routes/ai.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  env?: EnvConfig;
  logger?: FastifyServerOptions['logger'];
  aiProvider?: AIProvider;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv();

  const loggerConfig =
    options.logger ??
    (env.NODE_ENV === 'test'
      ? false
      : {
          level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers["x-api-key"]',
              'headers.authorization',
              'headers["x-api-key"]',
              '*.apiKey',
              '*.token',
              '*.password',
              '*.secret',
              'OPENROUTER_API_KEY',
            ],
            censor: '[REDACTED]',
          },
        });

  const app = Fastify({
    logger: loggerConfig,
    genReqId: (req) => {
      const headerId = req.headers['x-request-id'];
      if (typeof headerId === 'string' && headerId.trim().length > 0) {
        return headerId.trim();
      }
      return `req-${crypto.randomUUID()}`;
    },
    bodyLimit: 1048576, // 1MB default body limit
  });

  // Security headers via Helmet
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  // CORS configured with explicit allowed origin
  await app.register(cors, {
    origin: [env.APP_URL],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Centralized error handler
  app.setErrorHandler(errorHandler);

  // Initialize AI Provider
  const aiProvider =
    options.aiProvider ??
    new OpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY,
      appUrl: env.APP_URL,
      model: env.OPENROUTER_MODEL,
      fallbackModel: env.OPENROUTER_FALLBACK_MODEL,
      timeoutMs: env.OPENROUTER_TIMEOUT_MS,
    });

  // Register routes
  await app.register(healthRoutes);
  await app.register(aiRoutes, { aiProvider });

  return app;
}
