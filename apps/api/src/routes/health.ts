import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      env: process.env.NODE_ENV ?? 'development',
    });
  });
};
