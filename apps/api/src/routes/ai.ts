import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { EnvConfig } from '../config/env.js';
import { ValidationError } from '../errors/AppError.js';
import type { AIProvider } from '../providers/ai/types.js';

const ChatRequestSchema = z.object({
  message: z
    .string({
      required_error: 'The "message" field is required',
      invalid_type_error: 'The "message" field must be a string',
    })
    .trim()
    .min(1, 'The "message" field must not be empty')
    .max(4000, 'The "message" field must not exceed 4000 characters'),
});

export interface AiRoutesOptions {
  aiProvider: AIProvider;
  env?: EnvConfig;
}

export const aiRoutes: FastifyPluginAsync<AiRoutesOptions> = async (fastify, options) => {
  const { aiProvider, env } = options;

  // Single conversational gateway test endpoint
  fastify.post(
    '/api/ai/chat',
    {
      config: {
        bodyLimit: 65536, // 64KB route-level body limit
      },
    },
    async (request, reply) => {
      const parseResult = ChatRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const errorMessage = firstIssue ? firstIssue.message : 'Invalid request payload';
        throw new ValidationError(errorMessage);
      }

      const { message } = parseResult.data;

      const aiResponse = await aiProvider.generate({
        messages: [{ role: 'user', content: message }],
      });

      return reply.status(200).send({
        response: aiResponse.content,
        model: aiResponse.model,
        latencyMs: aiResponse.latencyMs,
      });
    }
  );

  // Dedicated connectivity status endpoint (separate from /health)
  fastify.get('/api/ai/health', async (_request, reply) => {
    return reply.status(200).send({
      provider: 'groq',
      model: env?.GROQ_MODEL ?? 'openai/gpt-oss-120b',
      baseUrl: env?.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
      status: env?.GROQ_API_KEY ? 'configured' : 'unconfigured',
      timestamp: new Date().toISOString(),
    });
  });
};
