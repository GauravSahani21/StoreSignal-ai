import type { FastifyPluginAsync } from 'fastify';
import { SIGNAL_ANALYST_PROMPT_VERSION } from '../agents/signalanalyst/prompts.js';
import { SignalAnalystAgent } from '../agents/signalanalyst/SignalAnalystAgent.js';
import type { Repositories } from '../database/repositories/index.js';
import { NotFoundError } from '../errors/AppError.js';
import type { AIProvider } from '../providers/ai/types.js';

export interface AnalystRoutesOptions {
  repositories: Repositories;
  aiProvider: AIProvider;
}

export const analystRoutes: FastifyPluginAsync<AnalystRoutesOptions> = async (fastify, options) => {
  const { repositories, aiProvider } = options;

  const analystAgent = new SignalAnalystAgent({
    aiProvider,
  });

  // 1. Run SignalAnalyst Agent on Conversation Transcript
  fastify.post('/api/conversations/:id/analyze', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    if (!conversation.latestTranscript || conversation.latestTranscript.segments.length === 0) {
      throw new NotFoundError(`Conversation "${id}" has no transcribed segments available for analysis.`);
    }

    const result = await analystAgent.run(conversation.latestTranscript.segments);

    // Persist agent execution record
    const runRecord = await repositories.agentRuns.saveAgentRun({
      orgId,
      conversationId: id,
      agentName: 'signal_analyst',
      state: 'succeeded',
      modelUsed: result.modelUsed,
      promptVersion: SIGNAL_ANALYST_PROMPT_VERSION,
      durationMs: result.durationMs,
      retries: result.retries,
      validationResults: result.guardResults as unknown as Record<string, unknown>[],
      outputJson: {
        ...result.output,
        intentAssessment: result.intentAssessment,
      } as unknown as Record<string, unknown>,
    });

    return reply.status(200).send({
      conversationId: id,
      agent: 'signal_analyst',
      runId: runRecord.id,
      modelUsed: result.modelUsed,
      durationMs: result.durationMs,
      retries: result.retries,
      output: result.output,
      intentAssessment: result.intentAssessment,
      guardResults: result.guardResults,
    });
  });

  // 2. Retrieve Latest Analysis
  fastify.get('/api/conversations/:id/analyze', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const runRecord = await repositories.agentRuns.getLatestAgentRun(orgId, id, 'signal_analyst');
    if (!runRecord) {
      throw new NotFoundError(`No SignalAnalyst analysis found for conversation "${id}".`);
    }

    return reply.status(200).send({
      conversationId: id,
      agent: 'signal_analyst',
      runId: runRecord.id,
      modelUsed: runRecord.modelUsed,
      output: runRecord.outputJson,
      createdAt: runRecord.createdAt,
    });
  });
};
