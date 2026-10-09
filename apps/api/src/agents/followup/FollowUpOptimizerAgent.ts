import type { AIProvider, AIRequest } from '../../providers/ai/types.js';
import type { ParsedSegment } from '../../conversations/segmenter.js';
import type { RetrievedChunk } from '../../rag/retrieval/types.js';
import type { SignalAnalystOutput } from '../signalanalyst/schema.js';
import type { FloorCoachOutput } from '../floorcoach/schema.js';
import {
  FollowUpOutputSchema,
  type FollowUpOutput,
} from './schema.js';
import {
  buildFollowUpSystemPrompt,
  buildFollowUpUserPrompt,
  buildFollowUpRepairPrompt,
} from './prompts.js';
import {
  validateNoInternalScoreLeakage,
  validateFactsUsedGrounding,
  type GuardValidationResult,
} from '../guards/groundingGuards.js';
import { AgentOutputInvalidError } from '../../errors/AppError.js';

export interface FollowUpRunParams {
  analystOutput: SignalAnalystOutput;
  floorCoachOutput?: FloorCoachOutput | null;
  retrievedChunks?: RetrievedChunk[];
  permittedChannels?: string[];
  hasConsent?: boolean;
  customerSegments?: ParsedSegment[];
}

export interface FollowUpRunResult {
  output: FollowUpOutput;
  modelUsed: string;
  durationMs: number;
  retries: number;
  guardResults: GuardValidationResult[];
}

export interface FollowUpOptimizerOptions {
  aiProvider: AIProvider;
  defaultModel?: string;
  maxRetries?: number;
}

export class FollowUpOptimizerAgent {
  private readonly aiProvider: AIProvider;
  private readonly defaultModel: string;
  private readonly maxRetries: number;

  constructor(options: FollowUpOptimizerOptions) {
    this.aiProvider = options.aiProvider;
    this.defaultModel = options.defaultModel ?? 'google/gemini-2.0-flash-001';
    this.maxRetries = options.maxRetries ?? 2;
  }

  async run(params: FollowUpRunParams): Promise<FollowUpRunResult> {
    const startTime = Date.now();
    const retrievedChunks = params.retrievedChunks ?? [];
    const permittedChannels = params.permittedChannels ?? [];
    const hasConsent = params.hasConsent ?? false;
    const customerSegments = params.customerSegments ?? [];

    // If no consent or no channels, we can mandate a blocked draft
    if (!hasConsent || permittedChannels.length === 0) {
      const blockedOutput: FollowUpOutput = {
        recommendedAction: 'Do not contact; consent or contact channel missing',
        reason: !hasConsent
          ? 'Customer consent not granted for follow-up communications.'
          : 'No permitted contact channel specified by customer.',
        channel: 'none',
        subject: null,
        message: null,
        factsUsed: [],
        status: 'draft',
        requiresHumanApproval: true,
        blockedReason: !hasConsent ? 'no_consent' : 'no_contact_channel',
      };

      return {
        output: blockedOutput,
        modelUsed: 'deterministic_policy',
        durationMs: Date.now() - startTime,
        retries: 0,
        guardResults: [
          { guard: 'consent_guard', passed: true, message: 'Policy strictly enforced: no outreach without consent' },
        ],
      };
    }

    const systemPrompt = buildFollowUpSystemPrompt();
    const userPrompt = buildFollowUpUserPrompt({
      analystOutput: params.analystOutput,
      floorCoachOutput: params.floorCoachOutput,
      retrievedChunks,
      permittedChannels,
      hasConsent,
    });

    let currentMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    let attempts = 0;
    let actualModel = this.defaultModel;
    let lastRawResponse = '';
    let guardResults: GuardValidationResult[] = [];

    while (attempts <= this.maxRetries) {
      attempts++;

      const request: AIRequest = {
        model: this.defaultModel,
        messages: currentMessages,
        temperature: 0.1,
        maxTokens: 1500,
        responseFormat: { type: 'json_object' },
      };

      const aiResponse = await this.aiProvider.generate(request);
      actualModel = aiResponse.model;
      lastRawResponse = aiResponse.content;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(aiResponse.content);
      } catch {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `FollowUpOptimizer failed to return valid JSON after ${attempts} attempts. Raw response: ${lastRawResponse.slice(0, 200)}`
          );
        }
        const repairPrompt = buildFollowUpRepairPrompt(userPrompt, lastRawResponse, [
          'Response was not valid JSON. Ensure strict JSON formatting without markdown.',
        ]);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      const zodResult = FollowUpOutputSchema.safeParse(parsedJson);
      if (!zodResult.success) {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `FollowUpOptimizer output failed Zod schema validation: ${zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
        const issues = zodResult.error.issues.map((i) => `Field "${i.path.join('.')}": ${i.message}`);
        const repairPrompt = buildFollowUpRepairPrompt(userPrompt, lastRawResponse, issues);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      const output = zodResult.data;

      // Run Grounding & Governance Guards in code
      guardResults = this.runGuards({
        output,
        permittedChannels,
        hasConsent,
        retrievedChunks,
        customerSegments,
      });

      const criticalFailures = guardResults.filter((g) => !g.passed);

      if (criticalFailures.length > 0 && attempts <= this.maxRetries) {
        const issues = criticalFailures.map((f) => `Guard [${f.guard}] failed: ${f.message}`);
        const repairPrompt = buildFollowUpRepairPrompt(userPrompt, lastRawResponse, issues);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      if (criticalFailures.length > 0) {
        throw new AgentOutputInvalidError(
          `FollowUpOptimizer violated grounding guards [${criticalFailures.map((f) => f.guard).join(', ')}]: ${criticalFailures.map((f) => f.message).join('; ')}`
        );
      }

      return {
        output,
        modelUsed: actualModel,
        durationMs: Date.now() - startTime,
        retries: attempts - 1,
        guardResults,
      };
    }

    throw new AgentOutputInvalidError('FollowUpOptimizer exceeded retry budget.');
  }

  private runGuards(params: {
    output: FollowUpOutput;
    permittedChannels: string[];
    hasConsent: boolean;
    retrievedChunks: RetrievedChunk[];
    customerSegments: ParsedSegment[];
  }): GuardValidationResult[] {
    const { output, permittedChannels, hasConsent, retrievedChunks, customerSegments } = params;
    const results: GuardValidationResult[] = [];

    // Guard 1: Consent & Permitted Channel Check
    if (!hasConsent && output.channel !== 'none') {
      results.push({
        guard: 'consent_guard',
        passed: false,
        message: `Output channel is "${output.channel}" but customer has not granted consent. Channel must be "none".`,
      });
    } else if (
      output.channel !== 'none' &&
      !permittedChannels.includes(output.channel)
    ) {
      results.push({
        guard: 'permitted_channel_guard',
        passed: false,
        message: `Selected channel "${output.channel}" is not in permitted channels list: [${permittedChannels.join(', ')}].`,
      });
    } else {
      results.push({ guard: 'channel_permission_guard', passed: true });
    }

    // Guard 2: No Internal Score Leakage in Message
    if (output.message) {
      results.push(validateNoInternalScoreLeakage(output.message));
    }

    // Guard 3: Facts Used & Numeric Grounding
    if (output.message) {
      results.push(
        validateFactsUsedGrounding(
          output.message,
          output.factsUsed,
          retrievedChunks,
          customerSegments
        )
      );
    }

    return results;
  }
}
