import crypto from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { type EnvConfig, loadEnv } from './config/env.js';
import { errorHandler } from './errors/errorHandler.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  env?: EnvConfig;
  logger?: FastifyServerOptions['logger'];
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

  // Set centralized error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await app.register(healthRoutes);

  return app;
}
