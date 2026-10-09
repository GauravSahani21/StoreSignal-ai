import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Repositories } from '../database/repositories/index.js';
import { ExperimentService } from '../experiments/ExperimentService.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export const experimentRoutes: FastifyPluginAsync<{
  repositories: Repositories;
  experimentService?: ExperimentService;
}> = async (fastify, opts) => {
  const service = opts.experimentService ?? new ExperimentService(opts.repositories);

  // Auto-seed demo experiments on startup for dev tenant
  await service.seedDemoExperiments('org-vayu-motors-dev').catch((err) => {
    fastify.log.warn({ err }, 'Failed to seed demo experiments');
  });

  // GET /api/experiments
  fastify.get('/', async (req, reply) => {
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const query = req.query as { status?: string };
    const experiments = await service.listExperiments(orgId, query.status as any);

    // Attach basic variant count and analysis preview for each
    const enriched = await Promise.all(
      experiments.map(async (exp) => {
        const variants = await service.getVariants(exp.id);
        const analysis = await service.analyzeExperiment(exp.id);
        return {
          ...exp,
          variantCount: variants.length,
          totalExposures: analysis?.totalExposures ?? 0,
          totalConversions: analysis?.totalConversions ?? 0,
          overallConversionRate: analysis?.overallConversionRate ?? 0,
          allVariantsMeetSampleSize: analysis?.allVariantsMeetSampleSize ?? false,
          winnerDeclared: analysis?.winnerDeclared ?? false,
          winningVariantKey: analysis?.winningVariantKey ?? null,
        };
      })
    );

    return reply.send({ success: true, data: enriched });
  });

  // POST /api/experiments
  fastify.post('/', async (req, reply) => {
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      name: z.string().min(3),
      hypothesis: z.string().min(10),
      targetType: z.enum(['followup_prompt', 'rubric_config', 'channel_strategy']),
      trafficAllocationPct: z.number().int().min(1).max(100).optional(),
      minSampleSize: z.number().int().min(5).max(1000).optional(),
      eligibilityRules: z
        .object({
          minIntentScore: z.number().optional(),
          permittedChannels: z.array(z.string()).optional(),
          customerCategories: z.array(z.string()).optional(),
          storeIds: z.array(z.string()).optional(),
        })
        .optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid experiment parameters: ${parsed.error.message}`);
    }

    const exp = await service.createExperiment({
      orgId,
      ...parsed.data,
    });

    return reply.status(201).send({ success: true, data: exp });
  });

  // GET /api/experiments/:id
  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await service.getExperiment(id);
    if (!result) {
      throw new NotFoundError(`Experiment with id "${id}" not found.`);
    }

    return reply.send({ success: true, data: result });
  });

  // PATCH /api/experiments/:id/status
  fastify.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum(['draft', 'running', 'paused', 'completed']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid status parameter: ${parsed.error.message}`);
    }

    const updated = await service.updateExperimentStatus(id, parsed.data.status);
    if (!updated) {
      throw new NotFoundError(`Experiment with id "${id}" not found.`);
    }

    return reply.send({ success: true, data: updated });
  });

  // POST /api/experiments/:id/variants
  fastify.post('/:id/variants', async (req, reply) => {
    const { id } = req.params as { id: string };
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      key: z.string().min(2),
      name: z.string().min(3),
      description: z.string().optional(),
      weight: z.number().int().min(1).max(100).optional(),
      config: z.record(z.unknown()).optional(),
      isControl: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid variant parameters: ${parsed.error.message}`);
    }

    const variant = await service.createVariant({
      orgId,
      experimentId: id,
      ...parsed.data,
    });

    return reply.status(201).send({ success: true, data: variant });
  });

  // POST /api/experiments/:id/assign
  fastify.post('/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      entityType: z.enum(['shopper', 'conversation']),
      entityId: z.string().min(1),
      intentScore: z.number().optional(),
      channel: z.string().optional(),
      storeId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid assignment parameters: ${parsed.error.message}`);
    }

    const result = await service.assignEntity(orgId, id, parsed.data);
    return reply.send({ success: true, data: result });
  });

  // POST /api/experiments/:id/events
  fastify.post('/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string };
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      variantId: z.string().min(1),
      entityType: z.enum(['shopper', 'conversation']),
      entityId: z.string().min(1),
      eventType: z.enum(['exposure', 'send', 'response', 'conversion', 'cost_recorded']),
      value: z.number().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid event parameters: ${parsed.error.message}`);
    }

    const event = await service.recordEvent({
      orgId,
      experimentId: id,
      ...parsed.data,
    });

    return reply.status(201).send({ success: true, data: event });
  });

  // POST /api/experiments/:id/events/csv
  fastify.post('/:id/events/csv', async (req, reply) => {
    const { id } = req.params as { id: string };
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      csvContent: z.string().min(5),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid CSV payload: ${parsed.error.message}`);
    }

    const result = await service.importEventsCsv(orgId, id, parsed.data.csvContent);
    return reply.send({ success: true, data: result });
  });

  // GET /api/experiments/:id/analysis
  fastify.get('/:id/analysis', async (req, reply) => {
    const { id } = req.params as { id: string };
    const analysis = await service.analyzeExperiment(id);
    if (!analysis) {
      throw new NotFoundError(`Experiment with id "${id}" not found.`);
    }

    return reply.send({ success: true, data: analysis });
  });
};
