import type { FastifyPluginAsync } from 'fastify';
import { FOLLOWUP_PROMPT_VERSION } from '../agents/followup/prompts.js';
import { FollowUpOptimizerAgent } from '../agents/followup/FollowUpOptimizerAgent.js';
import type { Repositories } from '../database/repositories/index.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError.js';
import type { AIProvider } from '../providers/ai/types.js';
import type { SignalAnalystOutput } from '../agents/signalanalyst/schema.js';
import type { FloorCoachOutput } from '../agents/floorcoach/schema.js';
import type { RetrievedChunk } from '../rag/retrieval/types.js';

export interface FollowUpRoutesOptions {
  repositories: Repositories;
  aiProvider: AIProvider;
}

export const followUpRoutes: FastifyPluginAsync<FollowUpRoutesOptions> = async (fastify, options) => {
  const { repositories, aiProvider } = options;

  const followUpAgent = new FollowUpOptimizerAgent({
    aiProvider,
  });

  // 1. Generate Follow-up Draft
  fastify.post('/api/conversations/:id/follow-up', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };
    const body = (request.body as {
      analystOutput?: SignalAnalystOutput;
      floorCoachOutput?: FloorCoachOutput;
      retrievedChunks?: RetrievedChunk[];
      permittedChannels?: string[];
    }) || {};

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    const segments = conversation.latestTranscript?.segments || [];

    // Retrieve validated SignalAnalyst output
    let analystOutput = body.analystOutput;
    if (!analystOutput) {
      const analystRun = await repositories.agentRuns.getLatestAgentRun(orgId, id, 'signal_analyst');
      if (analystRun && analystRun.outputJson) {
        analystOutput = analystRun.outputJson as unknown as SignalAnalystOutput;
      }
    }

    if (!analystOutput) {
      throw new ValidationError(
        `Cannot run FollowUpOptimizer without validated SignalAnalyst output. Run POST /api/conversations/${id}/analyze first.`
      );
    }

    // Retrieve optional FloorCoach output
    let floorCoachOutput = body.floorCoachOutput;
    if (!floorCoachOutput) {
      const coachRun = await repositories.agentRuns.getLatestAgentRun(orgId, id, 'floor_coach');
      if (coachRun && coachRun.outputJson) {
        floorCoachOutput = coachRun.outputJson as unknown as FloorCoachOutput;
      }
    }

    // Check consent for follow_up_contact
    const subjectId = conversation.sessionId || id;
    const hasConsent = await repositories.consents.hasActiveConsent(orgId, subjectId, 'follow_up_contact');

    // Permitted channels: must be empty if no consent
    const permittedChannels = hasConsent
      ? (body.permittedChannels && body.permittedChannels.length > 0
          ? body.permittedChannels
          : ['email', 'whatsapp', 'call_task'])
      : [];

    const result = await followUpAgent.run({
      analystOutput,
      floorCoachOutput,
      retrievedChunks: body.retrievedChunks || [],
      permittedChannels,
      hasConsent,
      customerSegments: segments,
    });

    // Persist Draft
    const draft = await repositories.drafts.createDraft({
      orgId,
      conversationId: id,
      channel: result.output.channel,
      subject: result.output.subject,
      message: result.output.message,
      factsUsed: result.output.factsUsed,
      recommendedAction: result.output.recommendedAction,
      reason: result.output.reason,
      blockedReason: result.output.blockedReason,
    });

    // Record Event: FOLLOW_UP_DRAFTED (only if a real draft exists, not blocked 'none')
    if (draft.channel !== 'none') {
      await repositories.workflowEvents.recordEvent({
        orgId,
        conversationId: id,
        eventType: 'FOLLOW_UP_DRAFTED',
        payload: {
          draftId: draft.id,
          channel: draft.channel,
          version: draft.version,
        },
      });
    }

    // Persist Agent Run
    const runRecord = await repositories.agentRuns.saveAgentRun({
      orgId,
      conversationId: id,
      agentName: 'followup_optimizer',
      state: 'succeeded',
      modelUsed: result.modelUsed,
      promptVersion: FOLLOWUP_PROMPT_VERSION,
      durationMs: result.durationMs,
      retries: result.retries,
      validationResults: result.guardResults as unknown as Record<string, unknown>[],
      outputJson: {
        ...result.output,
        draftId: draft.id,
      } as unknown as Record<string, unknown>,
    });

    return reply.status(200).send({
      conversationId: id,
      agent: 'followup_optimizer',
      runId: runRecord.id,
      modelUsed: result.modelUsed,
      durationMs: result.durationMs,
      retries: result.retries,
      draft,
      guardResults: result.guardResults,
    });
  });

  // 2. List drafts for conversation
  fastify.get('/api/conversations/:id/drafts', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const drafts = await repositories.drafts.getDraftsByConversation(orgId, id);
    return reply.status(200).send({ drafts });
  });

  // 3. Get single draft by ID with approval history
  fastify.get('/api/drafts/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const draft = await repositories.drafts.getDraftById(orgId, id);
    if (!draft) {
      throw new NotFoundError(`Draft "${id}" was not found.`);
    }

    const approvals = await repositories.drafts.getApprovalsForDraft(orgId, id);

    return reply.status(200).send({
      draft,
      approvals,
    });
  });

  // 4. Edit draft (subject / message)
  fastify.patch('/api/drafts/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };
    const body = request.body as { subject?: string | null; message?: string | null };

    const updated = await repositories.drafts.updateDraft(orgId, id, {
      subject: body.subject,
      message: body.message,
    });

    return reply.status(200).send({ draft: updated });
  });

  // 5. Approve draft (Governance Gate: human approval recorded, NO AUTOMATED SEND)
  fastify.post('/api/drafts/:id/approve', async (request, reply) => {
    const callerRole = (request as any).auth?.role;
    if (callerRole === 'advisor') {
      throw new ForbiddenError("Advisors cannot approve drafts. Manager or admin approval required.");
    }
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };
    const body = (request.body as { reviewerId?: string; reviewerNotes?: string }) || {};

    const reviewerId = (request as any).auth?.userId || body.reviewerId || 'user-advisor-1';

    const { draft, approvalRecord } = await repositories.drafts.recordApproval({
      orgId,
      draftId: id,
      decision: 'approved',
      reviewerId,
      reviewerNotes: body.reviewerNotes,
    });

    // Record lifecycle event: FOLLOW_UP_APPROVED
    await repositories.workflowEvents.recordEvent({
      orgId,
      conversationId: draft.conversationId,
      eventType: 'FOLLOW_UP_APPROVED',
      payload: {
        draftId: draft.id,
        reviewerId,
        approvalRecordId: approvalRecord.id,
      },
    });

    return reply.status(200).send({
      draft,
      approvalRecord,
      message: 'Draft approved and archived in approval records. No automated dispatch executed.',
    });
  });

  // 6. Reject draft
  fastify.post('/api/drafts/:id/reject', async (request, reply) => {
    const callerRole = (request as any).auth?.role;
    if (callerRole === 'advisor') {
      throw new ForbiddenError("Advisors cannot reject drafts. Manager or admin authorization required.");
    }
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };
    const body = (request.body as { reviewerId?: string; reviewerNotes?: string }) || {};

    const reviewerId = (request as any).auth?.userId || body.reviewerId || 'user-advisor-1';

    const { draft, approvalRecord } = await repositories.drafts.recordApproval({
      orgId,
      draftId: id,
      decision: 'rejected',
      reviewerId,
      reviewerNotes: body.reviewerNotes,
    });

    await repositories.workflowEvents.recordEvent({
      orgId,
      conversationId: draft.conversationId,
      eventType: 'FOLLOW_UP_REJECTED',
      payload: {
        draftId: draft.id,
        reviewerId,
        approvalRecordId: approvalRecord.id,
      },
    });

    return reply.status(200).send({
      draft,
      approvalRecord,
    });
  });

  // 7. Get conversation workflow events
  fastify.get('/api/conversations/:id/events', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const events = await repositories.workflowEvents.getEventsByConversation(orgId, id);
    return reply.status(200).send({ events });
  });
};
