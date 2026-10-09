import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../database/repositories/index.js';
import type { AIProvider } from '../providers/ai/types.js';
import type { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import { OrchestratorEngine } from '../orchestration/OrchestratorEngine.js';
import { NotFoundError } from '../errors/AppError.js';

export interface OrchestrationRoutesOptions {
  repositories: Repositories;
  aiProvider: AIProvider;
  retrievalService: RetrievalService;
  orchestratorEngine?: OrchestratorEngine;
}

export const orchestrationRoutes: FastifyPluginAsync<OrchestrationRoutesOptions> = async (
  fastify,
  options
) => {
  const { repositories, aiProvider, retrievalService } = options;

  const orchestratorEngine =
    options.orchestratorEngine ??
    new OrchestratorEngine({
      repositories,
      aiProvider,
      retrievalService,
    });

  // 1. Single Entry Point: Process Conversation through Multi-Agent Governed Pipeline
  fastify.post('/api/conversations/:id/process', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };
    const body = (request.body as {
      idempotencyKey?: string;
      forceReRun?: boolean;
      permittedChannels?: string[];
    }) || {};

    const workflowRun = await orchestratorEngine.processConversation({
      orgId,
      conversationId: id,
      idempotencyKey: body.idempotencyKey,
      forceReRun: body.forceReRun,
      permittedChannels: body.permittedChannels,
    });

    return reply.status(200).send({
      workflowRun,
    });
  });

  // 2. Retrieve Specific Workflow Run by ID
  fastify.get('/api/workflows/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const run = await repositories.workflows.getWorkflowRunById(orgId, id);
    if (!run) {
      throw new NotFoundError(`Workflow run "${id}" was not found.`);
    }

    return reply.status(200).send({ workflowRun: run });
  });

  // 3. Retrieve Workflow Events by Workflow ID
  fastify.get('/api/workflows/:id/events', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const run = await repositories.workflows.getWorkflowRunById(orgId, id);
    if (!run) {
      throw new NotFoundError(`Workflow run "${id}" was not found.`);
    }

    const events = await repositories.workflowEvents.getEventsByConversation(orgId, run.conversationId);
    return reply.status(200).send({
      workflowRunId: id,
      conversationId: run.conversationId,
      events,
    });
  });

  // 4. Retrieve Conversation Trace (Timeline & Latest Run)
  fastify.get('/api/conversations/:id/trace', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const latestRun = await repositories.workflows.getLatestWorkflowRun(orgId, id);
    const events = await repositories.workflowEvents.getEventsByConversation(orgId, id);

    return reply.status(200).send({
      conversationId: id,
      latestRun,
      events,
    });
  });
};
