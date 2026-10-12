import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../database/repositories/index.js';

export interface HealthRoutesOptions {
  repositories?: Repositories;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (fastify, options) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      env: process.env.NODE_ENV ?? 'development',
    });
  });

  fastify.post('/api/system/reset-data', async (_request, reply) => {
    const repos = options?.repositories as any;
    if (repos) {
      if (repos.conversations?.conversations?.clear) repos.conversations.conversations.clear();
      if (repos.conversations?.transcripts?.clear) repos.conversations.transcripts.clear();
      if (repos.shoppers?.shoppers?.clear) repos.shoppers.shoppers.clear();
      if (repos.drafts?.drafts?.clear) repos.drafts.drafts.clear();
      if (repos.workflows?.workflows?.clear) repos.workflows.workflows.clear();
      if (repos.outcomes?.outcomes?.clear) repos.outcomes.outcomes.clear();
      if (repos.experiments?.experiments?.clear) repos.experiments.experiments.clear();
      if (repos.storeEvents?.events?.clear) repos.storeEvents.events.clear();
      if (repos.usageEvents?.events?.clear) repos.usageEvents.events.clear();
    }
    return reply.status(200).send({
      status: 'ok',
      message: 'All store data completely reset to zero.',
      timestamp: new Date().toISOString(),
    });
  });
};
