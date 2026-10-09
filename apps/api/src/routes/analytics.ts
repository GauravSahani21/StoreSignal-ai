import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Repositories } from '../database/repositories/index.js';
import { StoreAnalyticsService } from '../analytics/StoreAnalyticsService.js';
import type { AnalyticsFilter, DemoFilter } from '../database/repositories/types.js';

const AnalyticsQuerySchema = z.object({
  orgId: z.string().optional(),
  storeId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  demoFilter: z.enum(['all', 'real_only', 'demo_only']).optional(),
});

export const analyticsRoutes: FastifyPluginAsync<{
  repositories: Repositories;
  analyticsService?: StoreAnalyticsService;
}> = async (fastify, opts) => {
  const service = opts.analyticsService ?? new StoreAnalyticsService(opts.repositories);

  const parseFilter = (query: unknown): { orgId: string; filter: AnalyticsFilter } => {
    const parse = AnalyticsQuerySchema.safeParse(query);
    const data = parse.success ? parse.data : {};
    const orgId = data.orgId || 'org-vayu-motors-dev';
    const filter: AnalyticsFilter = {
      storeId: data.storeId,
      from: data.from,
      to: data.to,
      demoFilter: (data.demoFilter as DemoFilter) || 'all',
    };
    return { orgId, filter };
  };

  // Area A: Operations Overview KPIs
  fastify.get('/api/analytics/overview', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const overview = await service.getOverviewMetrics(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: overview,
    });
  });

  // Area B: Conversation Workspace List
  fastify.get('/api/analytics/conversations', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const conversations = await service.getConversationList(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: conversations,
    });
  });

  // Area B: Single Conversation Intelligence View
  fastify.get('/api/analytics/conversations/:id', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const query = request.query as { orgId?: string };
    const orgId = query.orgId || 'org-vayu-motors-dev';

    const details = await service.getConversationDetails(orgId, conversationId);
    if (!details) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Conversation "${conversationId}" not found` },
      });
    }

    return reply.status(200).send({
      success: true,
      data: details,
    });
  });

  // Area C: Shopper Insights Aggregation
  fastify.get('/api/analytics/shoppers', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const shopperInsights = await service.getShopperInsights(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: shopperInsights,
    });
  });

  // Area D: Agent Activity & Usage
  fastify.get('/api/analytics/agents', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const agentActivity = await service.getAgentActivity(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: agentActivity,
    });
  });

  // Area E: Governed Follow-Up Queue Metrics
  fastify.get('/api/analytics/followups', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const followups = await service.getFollowUpQueueMetrics(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: followups,
    });
  });

  // Area F: Store & Conversion Insights
  fastify.get('/api/analytics/store-insights', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const storeInsights = await service.getStoreConversionInsights(orgId, filter);
    return reply.status(200).send({
      success: true,
      data: storeInsights,
    });
  });

  // CSV Export of Store Events
  fastify.get('/api/analytics/export/csv', async (request, reply) => {
    const { orgId, filter } = parseFilter(request.query);
    const csvContent = await service.exportEventsCsv(orgId, filter);

    return reply
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="store-events.csv"')
      .send(csvContent);
  });
};
