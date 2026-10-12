import type { Repositories } from '../database/repositories/index.js';
import type { AIProvider } from '../providers/ai/types.js';
import type { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import type { RetrievedChunk } from '../rag/retrieval/types.js';
import { FloorCoachAgent, type FloorCoachResult } from '../agents/floorcoach/FloorCoachAgent.js';
import { SignalAnalystAgent, type SignalAnalystResult } from '../agents/signalanalyst/SignalAnalystAgent.js';
import { FollowUpOptimizerAgent } from '../agents/followup/FollowUpOptimizerAgent.js';
import { FLOOR_COACH_PROMPT_VERSION } from '../agents/floorcoach/prompts.js';
import { SIGNAL_ANALYST_PROMPT_VERSION } from '../agents/signalanalyst/prompts.js';
import { FOLLOWUP_PROMPT_VERSION } from '../agents/followup/prompts.js';
import type { FloorCoachOutput } from '../agents/floorcoach/schema.js';
import type { SignalAnalystOutput } from '../agents/signalanalyst/schema.js';
import type { WorkflowRun, WorkflowState } from '../database/repositories/types.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { globalConversationLock, ConversationLock } from './ConversationLock.js';
import { ShopperProfileService } from '../shoppers/ShopperProfileService.js';

export const ORCHESTRATOR_CONFIG_VERSION = '1.0.0';

export interface ProcessConversationOptions {
  orgId?: string;
  conversationId: string;
  idempotencyKey?: string;
  forceReRun?: boolean;
  permittedChannels?: string[];
  wallClockTimeoutMs?: number;
}

export interface OrchestratorEngineOptions {
  repositories: Repositories;
  aiProvider: AIProvider;
  retrievalService: RetrievalService;
  shopperProfileService?: ShopperProfileService;
  lock?: ConversationLock;
  timeoutMs?: number;
}

export class OrchestratorEngine {
  private readonly repositories: Repositories;
  private readonly aiProvider: AIProvider;
  private readonly retrievalService: RetrievalService;
  private readonly shopperProfileService: ShopperProfileService;
  private readonly lock: ConversationLock;
  private readonly defaultTimeoutMs: number;

  constructor(options: OrchestratorEngineOptions) {
    this.repositories = options.repositories;
    this.aiProvider = options.aiProvider;
    this.retrievalService = options.retrievalService;
    this.shopperProfileService =
      options.shopperProfileService ?? new ShopperProfileService(this.repositories);
    this.lock = options.lock ?? globalConversationLock;
    this.defaultTimeoutMs = options.timeoutMs ?? 45000;
  }

  async processConversation(options: ProcessConversationOptions): Promise<WorkflowRun> {
    const startTime = Date.now();
    const orgId = options.orgId || 'org-vayu-motors-dev';
    const conversationId = options.conversationId;
    const timeoutMs = options.wallClockTimeoutMs ?? this.defaultTimeoutMs;

    // 1. Fetch and validate Conversation + Transcript
    const conversation = await this.repositories.conversations.getConversationById(orgId, conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${conversationId}" was not found.`);
    }

    const latestTranscript = conversation.latestTranscript;
    if (!latestTranscript || latestTranscript.segments.length === 0) {
      throw new ValidationError(`Conversation "${conversationId}" has no valid transcribed segments to analyze.`);
    }

    const transcriptVersion = latestTranscript.version;
    const idempotencyKey =
      options.idempotencyKey ||
      `${conversationId}:${transcriptVersion}:${ORCHESTRATOR_CONFIG_VERSION}`;

    // 2. Idempotency Check: if run already completed and not forceReRun, return cached run
    if (!options.forceReRun) {
      const existingRun = await this.repositories.workflows.getWorkflowRunByIdempotencyKey(orgId, idempotencyKey);
      if (existingRun && (existingRun.state === 'COMPLETED' || existingRun.state === 'AWAITING_APPROVAL' || existingRun.state === 'PARTIAL')) {
        return existingRun;
      }
    }

    // 3. Acquire Exclusive Per-Conversation Lock
    const { acquired, lockId } = this.lock.acquire(conversationId, timeoutMs);
    if (!acquired) {
      throw new ConflictError(
        `Conversation "${conversationId}" is currently undergoing an active workflow process. Concurrent execution is locked.`
      );
    }

    // 4. Initialize Workflow Run & Initial Event
    const workflowRun = await this.repositories.workflows.createWorkflowRun({
      orgId,
      conversationId,
      idempotencyKey,
      state: 'PENDING',
    });

    await this.repositories.workflowEvents.recordEvent({
      orgId,
      conversationId,
      eventType: 'WORKFLOW_STARTED',
      payload: { workflowRunId: workflowRun.id, idempotencyKey, version: workflowRun.version },
    });

    const stepResults: WorkflowRun['stepResults'] = {};
    let finalState: WorkflowState = 'COMPLETED';
    let errorMessage: string | null = null;

    try {
      // --- STEP 1: RETRIEVAL (RETRIEVING) ---
      await this.repositories.workflows.updateWorkflowRun(workflowRun.id, { state: 'RETRIEVING' });
      const retrievalStart = Date.now();

      // Formulate retrieval query from conversation dialogue
      const queryText = latestTranscript.segments
        .map((s) => s.text)
        .join(' ')
        .slice(0, 500);

      await this.repositories.workflowEvents.recordEvent({
        orgId,
        conversationId,
        eventType: 'RETRIEVAL_STARTED',
        payload: { query: queryText },
      });

      const retrievalRes = await this.retrievalService.retrieve(orgId, queryText, { topK: 5 });
      const retrievedChunks: RetrievedChunk[] = retrievalRes.chunks;
      stepResults['retrieval'] = {
        state: retrievalRes.status === 'ok' || retrievalRes.status === 'empty' ? 'SUCCEEDED' : 'FAILED',
        durationMs: Date.now() - retrievalStart,
        output: { chunkCount: retrievedChunks.length, chunkIds: retrievedChunks.map((c) => c.chunkId) },
      };

      await this.repositories.workflowEvents.recordEvent({
        orgId,
        conversationId,
        eventType: 'RETRIEVAL_COMPLETED',
        payload: {
          chunkCount: retrievedChunks.length,
          chunkIds: retrievedChunks.map((c) => c.chunkId),
          status: retrievalRes.status,
        },
      });

      await this.repositories.usageEvents.recordUsage({
        orgId,
        conversationId,
        workflowRunId: workflowRun.id,
        agent: 'retrieval',
        model: 'text-embedding-3-small',
        promptTokens: 120,
        completionTokens: 0,
        totalTokens: 120,
        latencyMs: stepResults['retrieval']?.durationMs || 0,
        costCents: 0.01,
      });

      // --- STEP 2: PARALLEL ANALYSIS (FloorCoach || SignalAnalyst) ---
      await this.repositories.workflows.updateWorkflowRun(workflowRun.id, { state: 'ANALYZING' });

      const floorCoachAgent = new FloorCoachAgent({
        aiProvider: this.aiProvider,
        retrievalService: this.retrievalService,
      });
      const signalAnalystAgent = new SignalAnalystAgent({ aiProvider: this.aiProvider });

      await this.repositories.workflowEvents.recordEvent({
        orgId,
        conversationId,
        eventType: 'ANALYSIS_STARTED',
        payload: { parallelAgents: ['floor_coach', 'signal_analyst'] },
      });

      // Fetch authorized shopper history context (cross-visit continuity)
      const shopperHistory = await this.shopperProfileService.getAuthorizedContextForPipeline(
        orgId,
        conversationId
      );

      // Run FloorCoach and SignalAnalyst sequentially to prevent burst token rate limit collisions on Groq
      let coachResultSettled: PromiseSettledResult<FloorCoachResult>;
      let analystResultSettled: PromiseSettledResult<SignalAnalystResult>;

      try {
        const coachVal = await floorCoachAgent.run(orgId, latestTranscript.segments);
        coachResultSettled = { status: 'fulfilled', value: coachVal };
      } catch (err) {
        coachResultSettled = { status: 'rejected', reason: err };
      }

      try {
        const analystVal = await signalAnalystAgent.run(latestTranscript.segments, shopperHistory);
        analystResultSettled = { status: 'fulfilled', value: analystVal };
      } catch (err) {
        analystResultSettled = { status: 'rejected', reason: err };
      }

      let coachOutput: FloorCoachOutput | null = null;
      let analystOutput: SignalAnalystOutput | null = null;

      // Handle FloorCoach result
      if (coachResultSettled.status === 'fulfilled') {
        const res = coachResultSettled.value;
        coachOutput = res.output;
        stepResults['floor_coach'] = {
          state: 'SUCCEEDED',
          durationMs: res.durationMs,
          output: res.output,
        };

        await this.repositories.agentRuns.saveAgentRun({
          orgId,
          conversationId,
          agentName: 'floor_coach',
          state: 'succeeded',
          modelUsed: res.modelUsed,
          promptVersion: FLOOR_COACH_PROMPT_VERSION,
          durationMs: res.durationMs,
          retries: res.retries,
          validationResults: res.guardResults as unknown as Record<string, unknown>[],
          outputJson: res.output as unknown as Record<string, unknown>,
        });

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'FLOORCOACH_COMPLETED',
          payload: { answeredCount: res.output.items.length, unresolvedCount: res.output.unresolved.length },
        });

        await this.repositories.usageEvents.recordUsage({
          orgId,
          conversationId,
          workflowRunId: workflowRun.id,
          agent: 'floor_coach',
          model: res.modelUsed,
          promptTokens: 480,
          completionTokens: 160,
          totalTokens: 640,
          latencyMs: res.durationMs,
          costCents: 0.12,
        });
      } else {
        const err = coachResultSettled.reason;
        const msg = err instanceof Error ? err.message : String(err);
        stepResults['floor_coach'] = {
          state: 'FAILED',
          error: msg,
        };

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'FLOORCOACH_FAILED',
          payload: { error: msg },
        });
      }

      // Handle SignalAnalyst result
      if (analystResultSettled.status === 'fulfilled') {
        const res = analystResultSettled.value;
        analystOutput = res.output;
        stepResults['signal_analyst'] = {
          state: 'SUCCEEDED',
          durationMs: res.durationMs,
          output: {
            ...res.output,
            intentAssessment: res.intentAssessment,
          },
        };

        await this.repositories.agentRuns.saveAgentRun({
          orgId,
          conversationId,
          agentName: 'signal_analyst',
          state: 'succeeded',
          modelUsed: res.modelUsed,
          promptVersion: SIGNAL_ANALYST_PROMPT_VERSION,
          durationMs: res.durationMs,
          retries: res.retries,
          validationResults: res.guardResults as unknown as Record<string, unknown>[],
          outputJson: {
            ...res.output,
            intentAssessment: res.intentAssessment,
          } as unknown as Record<string, unknown>,
        });

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'SIGNALANALYST_COMPLETED',
          payload: {
            intentScore: res.intentAssessment.score,
            band: res.intentAssessment.band,
            confidence: res.intentAssessment.confidence,
          },
        });

        await this.repositories.usageEvents.recordUsage({
          orgId,
          conversationId,
          workflowRunId: workflowRun.id,
          agent: 'signal_analyst',
          model: res.modelUsed,
          promptTokens: 620,
          completionTokens: 240,
          totalTokens: 860,
          latencyMs: res.durationMs,
          costCents: 0.18,
        });
      } else {
        const err = analystResultSettled.reason;
        const msg = err instanceof Error ? err.message : String(err);
        stepResults['signal_analyst'] = {
          state: 'FAILED',
          error: msg,
        };

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'SIGNALANALYST_FAILED',
          payload: { error: msg },
        });
      }

      // --- STEP 3: DEPENDENCY EVALUATION & FOLLOWUP PLANNING ---
      // If SignalAnalyst failed, FollowUpOptimizer CANNOT run (missing dependency)
      if (!analystOutput) {
        stepResults['followup_optimizer'] = {
          state: 'SKIPPED',
          skipReason: 'missing_dependency: signal_analyst_failed',
        };

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'FOLLOWUP_SKIPPED',
          payload: { reason: 'missing_dependency: signal_analyst_failed' },
        });

        finalState = coachOutput ? 'PARTIAL' : 'FAILED';
      } else {
        // SignalAnalyst succeeded -> execute FollowUpOptimizer
        await this.repositories.workflows.updateWorkflowRun(workflowRun.id, { state: 'FOLLOWUP_PLANNING' });
        const followUpAgent = new FollowUpOptimizerAgent({ aiProvider: this.aiProvider });

        // Check consent for follow_up_contact
        const subjectId = conversation.sessionId || conversationId;
        const hasConsent = await this.repositories.consents.hasActiveConsent(orgId, subjectId, 'follow_up_contact');
        const permittedChannels = hasConsent
          ? (options.permittedChannels && options.permittedChannels.length > 0
              ? options.permittedChannels
              : ['email', 'whatsapp'])
          : [];

        await this.repositories.workflowEvents.recordEvent({
          orgId,
          conversationId,
          eventType: 'FOLLOWUP_STARTED',
          payload: { hasConsent, permittedChannels },
        });

        try {
          const followUpRes = await followUpAgent.run({
            analystOutput,
            floorCoachOutput: coachOutput,
            retrievedChunks,
            permittedChannels,
            hasConsent,
            customerSegments: latestTranscript.segments,
            shopperHistory,
          });

          // Persist draft
          const draft = await this.repositories.drafts.createDraft({
            orgId,
            conversationId,
            channel: followUpRes.output.channel,
            subject: followUpRes.output.subject,
            message: followUpRes.output.message,
            factsUsed: followUpRes.output.factsUsed,
            recommendedAction: followUpRes.output.recommendedAction,
            reason: followUpRes.output.reason,
            blockedReason: followUpRes.output.blockedReason,
          });

          stepResults['followup_optimizer'] = {
            state: 'SUCCEEDED',
            durationMs: followUpRes.durationMs,
            output: { draftId: draft.id, channel: draft.channel, status: draft.status },
          };

          await this.repositories.agentRuns.saveAgentRun({
            orgId,
            conversationId,
            agentName: 'followup_optimizer',
            state: 'succeeded',
            modelUsed: followUpRes.modelUsed,
            promptVersion: FOLLOWUP_PROMPT_VERSION,
            durationMs: followUpRes.durationMs,
            retries: followUpRes.retries,
            validationResults: followUpRes.guardResults as unknown as Record<string, unknown>[],
            outputJson: {
              ...followUpRes.output,
              draftId: draft.id,
            } as unknown as Record<string, unknown>,
          });

          await this.repositories.usageEvents.recordUsage({
            orgId,
            conversationId,
            workflowRunId: workflowRun.id,
            agent: 'followup_optimizer',
            model: followUpRes.modelUsed,
            promptTokens: 550,
            completionTokens: 190,
            totalTokens: 740,
            latencyMs: followUpRes.durationMs,
            costCents: 0.15,
          });

          if (draft.channel !== 'none') {
            await this.repositories.workflowEvents.recordEvent({
              orgId,
              conversationId,
              eventType: 'FOLLOW_UP_DRAFTED',
              payload: { draftId: draft.id, channel: draft.channel },
            });
            // Draft requires human approval
            finalState = coachOutput ? 'AWAITING_APPROVAL' : 'PARTIAL';
          } else {
            // Blocked by policy, no draft to approve
            finalState = coachOutput ? 'COMPLETED' : 'PARTIAL';
          }
        } catch (followUpErr) {
          const msg = followUpErr instanceof Error ? followUpErr.message : String(followUpErr);
          stepResults['followup_optimizer'] = {
            state: 'FAILED',
            error: msg,
          };

          await this.repositories.workflowEvents.recordEvent({
            orgId,
            conversationId,
            eventType: 'FOLLOWUP_FAILED',
            payload: { error: msg },
          });

          finalState = 'PARTIAL';
        }
      }
    } catch (globalErr) {
      finalState = 'FAILED';
      errorMessage = globalErr instanceof Error ? globalErr.message : String(globalErr);
    } finally {
      // 5. Release conversation lock
      this.lock.release(conversationId, lockId);
    }

    const durationMs = Date.now() - startTime;

    // 6. Record final terminal event and persist workflow run
    await this.repositories.workflowEvents.recordEvent({
      orgId,
      conversationId,
      eventType:
        finalState === 'COMPLETED'
          ? 'WORKFLOW_COMPLETED'
          : finalState === 'AWAITING_APPROVAL'
            ? 'WORKFLOW_AWAITING_APPROVAL'
            : finalState === 'PARTIAL'
              ? 'WORKFLOW_PARTIAL'
              : 'WORKFLOW_FAILED',
      payload: {
        workflowRunId: workflowRun.id,
        durationMs,
        state: finalState,
        error: errorMessage,
      },
    });

    const updatedRun = await this.repositories.workflows.updateWorkflowRun(workflowRun.id, {
      state: finalState,
      stepResults,
      resultSummary: {
        floorCoachSuccess: stepResults['floor_coach']?.state === 'SUCCEEDED',
        signalAnalystSuccess: stepResults['signal_analyst']?.state === 'SUCCEEDED',
        followUpSuccess: stepResults['followup_optimizer']?.state === 'SUCCEEDED',
      },
      errorDetail: errorMessage,
      durationMs,
    });

    return updatedRun;
  }
}
