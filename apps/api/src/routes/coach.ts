import type { FastifyPluginAsync } from 'fastify';
import { FloorCoachAgent } from '../agents/floorcoach/FloorCoachAgent.js';
import { FLOOR_COACH_PROMPT_VERSION } from '../agents/floorcoach/prompts.js';
import type { Repositories } from '../database/repositories/index.js';
import { NotFoundError } from '../errors/AppError.js';
import type { AIProvider } from '../providers/ai/types.js';
import type { RetrievalService } from '../rag/retrieval/RetrievalService.js';

export interface CoachRoutesOptions {
  repositories: Repositories;
  aiProvider: AIProvider;
  retrievalService: RetrievalService;
}

export const coachRoutes: FastifyPluginAsync<CoachRoutesOptions> = async (fastify, options) => {
  const { repositories, aiProvider, retrievalService } = options;

  const coachAgent = new FloorCoachAgent({
    aiProvider,
    retrievalService,
  });

  // 1. Run FloorCoach Agent on Conversation Transcript
  fastify.post('/api/conversations/:id/coach', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    if (!conversation.latestTranscript || conversation.latestTranscript.segments.length === 0) {
      throw new NotFoundError(`Conversation "${id}" has no transcribed segments available for coaching.`);
    }

    const result = await coachAgent.run(orgId, conversation.latestTranscript.segments);

    // Persist agent execution record
    const runRecord = await repositories.agentRuns.saveAgentRun({
      orgId,
      conversationId: id,
      agentName: 'floor_coach',
      state: 'succeeded',
      modelUsed: result.modelUsed,
      promptVersion: FLOOR_COACH_PROMPT_VERSION,
      durationMs: result.durationMs,
      retries: result.retries,
      validationResults: result.guardResults as unknown as Record<string, unknown>[],
      outputJson: result.output as unknown as Record<string, unknown>,
    });

    return reply.status(200).send({
      conversationId: id,
      agent: 'floor_coach',
      runId: runRecord.id,
      modelUsed: result.modelUsed,
      durationMs: result.durationMs,
      retries: result.retries,
      output: result.output,
      guardResults: result.guardResults,
    });
  });

  // 2. Retrieve Latest FloorCoach Result
  fastify.get('/api/conversations/:id/coach', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const runRecord = await repositories.agentRuns.getLatestAgentRun(orgId, id, 'floor_coach');
    if (!runRecord) {
      throw new NotFoundError(`No FloorCoach analysis found for conversation "${id}".`);
    }

    return reply.status(200).send({
      conversationId: id,
      agent: 'floor_coach',
      runId: runRecord.id,
      modelUsed: runRecord.modelUsed,
      output: runRecord.outputJson,
      createdAt: runRecord.createdAt,
    });
  });
};
