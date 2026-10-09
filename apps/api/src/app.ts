import crypto from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { type EnvConfig, loadEnv } from './config/env.js';
import { createRepositories, type Repositories } from './database/repositories/index.js';
import { errorHandler } from './errors/errorHandler.js';
import { OpenRouterProvider } from './providers/ai/openrouter/OpenRouterProvider.js';
import type { AIProvider } from './providers/ai/types.js';
import { getSTTProvider } from './providers/stt/index.js';
import type { STTProvider } from './providers/stt/types.js';
import { MockEmbeddingProvider } from './rag/embeddings/MockEmbeddingProvider.js';
import type { EmbeddingProvider } from './rag/embeddings/types.js';
import { KnowledgeStore } from './rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from './rag/retrieval/RetrievalService.js';
import { seedKnowledgeBase } from './rag/seedKnowledge.js';
import { aiRoutes } from './routes/ai.js';
import { analystRoutes } from './routes/analyst.js';
import { audioRoutes } from './routes/audio.js';
import { coachRoutes } from './routes/coach.js';
import { consentRoutes } from './routes/consents.js';
import { conversationRoutes } from './routes/conversations.js';
import { healthRoutes } from './routes/health.js';
import { knowledgeRoutes } from './routes/knowledge.js';

export interface AppOptions {
  env?: EnvConfig;
  logger?: FastifyServerOptions['logger'];
  aiProvider?: AIProvider;
  sttProvider?: STTProvider;
  embeddingProvider?: EmbeddingProvider;
  knowledgeStore?: KnowledgeStore;
  retrievalService?: RetrievalService;
  repositories?: Repositories;
  skipAutoSeed?: boolean;
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
              'STT_API_KEY',
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
    bodyLimit: 31457280, // 30MB limit
  });

  // Register Multipart
  await app.register(multipart, {
    limits: {
      fileSize: env.AUDIO_MAX_BYTES,
      files: 1,
    },
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

  // Tenant context middleware (org_id extraction)
  app.decorateRequest('orgId', '');
  app.addHook('preHandler', async (request) => {
    const orgHeader = request.headers['x-org-id'];
    if (typeof orgHeader === 'string' && orgHeader.trim()) {
      (request as unknown as { orgId: string }).orgId = orgHeader.trim();
    } else {
      (request as unknown as { orgId: string }).orgId = 'org-vayu-motors-dev';
    }
  });

  // Initialize Repositories
  const repositories = options.repositories ?? createRepositories();

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

  // Initialize STT Provider
  const sttProvider = getSTTProvider(env, options.sttProvider);

  // Initialize RAG Services
  const embeddingProvider = options.embeddingProvider ?? new MockEmbeddingProvider();
  const knowledgeStore = options.knowledgeStore ?? new KnowledgeStore(embeddingProvider);
  const retrievalService = options.retrievalService ?? new RetrievalService(knowledgeStore, embeddingProvider);

  // Auto-seed default knowledge documents unless skipped
  if (!options.skipAutoSeed) {
    await seedKnowledgeBase(knowledgeStore, 'org-vayu-motors-dev');
  }

  // Register routes
  await app.register(healthRoutes);
  await app.register(aiRoutes, { aiProvider });
  await app.register(consentRoutes, { repositories });
  await app.register(conversationRoutes, { repositories });
  await app.register(audioRoutes, {
    repositories,
    sttProvider,
    audioMaxBytes: env.AUDIO_MAX_BYTES,
  });
  await app.register(knowledgeRoutes, {
    knowledgeStore,
    retrievalService,
  });
  await app.register(coachRoutes, {
    repositories,
    aiProvider,
    retrievalService,
  });
  await app.register(analystRoutes, {
    repositories,
    aiProvider,
  });

  return app;
}
