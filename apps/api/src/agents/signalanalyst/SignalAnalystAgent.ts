import type { ParsedSegment } from '../../conversations/segmenter.js';
import { AgentOutputInvalidError } from '../../errors/AppError.js';
import type { AIProvider } from '../../providers/ai/types.js';
import { IntentScorer, type IntentAssessment } from '../../scoring/IntentScorer.js';
import {
  type GuardValidationResult,
  validateEvidenceExistence,
  validateExplicitBasis,
  validateQuoteContainment,
} from '../guards/groundingGuards.js';
import {
  SIGNAL_ANALYST_PROMPT_VERSION,
  buildSignalAnalystRepairPrompt,
  buildSignalAnalystSystemPrompt,
  buildSignalAnalystUserPrompt,
} from './prompts.js';
import { type SignalAnalystOutput, SignalAnalystOutputSchema } from './schema.js';

export interface SignalAnalystAgentConfig {
  aiProvider: AIProvider;
  intentScorer?: IntentScorer;
  model?: string;
  maxRetries?: number;
}

export interface SignalAnalystResult {
  output: SignalAnalystOutput;
  intentAssessment: IntentAssessment;
  modelUsed: string;
  durationMs: number;
  retries: number;
  guardResults: GuardValidationResult[];
}

export class SignalAnalystAgent {
  private readonly aiProvider: AIProvider;
  private readonly intentScorer: IntentScorer;
  private readonly model?: string;
  private readonly maxRetries: number;

  constructor(config: SignalAnalystAgentConfig) {
    this.aiProvider = config.aiProvider;
    this.intentScorer = config.intentScorer ?? new IntentScorer();
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async run(segments: ParsedSegment[]): Promise<SignalAnalystResult> {
    const startTime = Date.now();
    const customerSegments = segments.filter((s) => s.speaker === 'customer');

    const systemPrompt = buildSignalAnalystSystemPrompt();
    const userPrompt = buildSignalAnalystUserPrompt(segments);

    let currentMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    let attempts = 0;
    let lastRawResponse = '';
    let guardResults: GuardValidationResult[] = [];
    let actualModel = this.model || 'default';

    while (attempts <= this.maxRetries) {
      attempts++;

      const aiResponse = await this.aiProvider.generate({
        model: this.model,
        messages: currentMessages,
        temperature: 0.1,
      });

      lastRawResponse = aiResponse.content;
      actualModel = aiResponse.model;

      const cleanJson = this.extractJson(lastRawResponse);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleanJson);
      } catch (err) {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `SignalAnalyst output was non-JSON after ${this.maxRetries} repairs: ${err instanceof Error ? err.message : ''}`
          );
        }
        const repairPrompt = buildSignalAnalystRepairPrompt(userPrompt, lastRawResponse, [
          'Output was not valid JSON. Ensure you return ONLY valid JSON matching the schema.',
        ]);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      const zodResult = SignalAnalystOutputSchema.safeParse(parsedJson);
      if (!zodResult.success) {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `SignalAnalyst output failed Zod schema validation: ${zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
        const issues = zodResult.error.issues.map((i) => `Field "${i.path.join('.')}": ${i.message}`);
        const repairPrompt = buildSignalAnalystRepairPrompt(userPrompt, lastRawResponse, issues);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      const output = zodResult.data;

      // Run Grounding Guards (§5.5) in code
      guardResults = this.runGuards(output, segments);
      const criticalFailures = guardResults.filter(
        (g) => !g.passed && g.guard !== 'signal_evidence' // soft-skip signal evidence, hard-fail on explicit budget
      );

      if (criticalFailures.length > 0 && attempts <= this.maxRetries) {
        const issues = criticalFailures.map((f) => `Guard [${f.guard}] failed: ${f.message}`);
        const repairPrompt = buildSignalAnalystRepairPrompt(userPrompt, lastRawResponse, issues);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      if (criticalFailures.length > 0) {
        throw new AgentOutputInvalidError(
          `SignalAnalyst violated grounding guards [${criticalFailures.map((f) => f.guard).join(', ')}]: ${criticalFailures.map((f) => f.message).join('; ')}`
        );
      }

      // Evaluate Intent Signals deterministically via IntentScorer
      const evaluatedSignals = output.intentSignals.map((sig) => {
        const existenceCheck = validateEvidenceExistence(sig.evidence, segments);
        const quoteCheck = validateQuoteContainment(sig.evidence, segments);
        const isValid = existenceCheck.passed && quoteCheck.passed;
        return {
          signalId: sig.signalId,
          present: sig.present,
          isValid,
          evidence: sig.evidence,
        };
      });

      const intentAssessment = this.intentScorer.evaluate(evaluatedSignals, customerSegments);

      return {
        output,
        intentAssessment,
        modelUsed: actualModel,
        durationMs: Date.now() - startTime,
        retries: attempts - 1,
        guardResults,
      };
    }

    throw new AgentOutputInvalidError('SignalAnalyst agent exceeded retry budget.');
  }

  private runGuards(output: SignalAnalystOutput, segments: ParsedSegment[]): GuardValidationResult[] {
    const results: GuardValidationResult[] = [];

    // Guard on budget (Must be explicit customer speaker)
    if (output.budget) {
      results.push(validateEvidenceExistence(output.budget.evidence, segments));
      results.push(validateQuoteContainment(output.budget.evidence, segments));
      results.push(validateExplicitBasis(output.budget.evidence, segments));
    }

    // Guard on timeline (Must be explicit customer speaker)
    if (output.timeline) {
      results.push(validateEvidenceExistence(output.timeline.evidence, segments));
      results.push(validateQuoteContainment(output.timeline.evidence, segments));
      results.push(validateExplicitBasis(output.timeline.evidence, segments));
    }

    // Guard on objections
    for (const obj of output.objections) {
      results.push(validateEvidenceExistence(obj.evidence, segments));
      results.push(validateQuoteContainment(obj.evidence, segments));
    }

    return results;
  }

  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('```json')) {
      return trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    }
    if (trimmed.startsWith('```')) {
      return trimmed.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }
    return trimmed;
  }
}

export { SIGNAL_ANALYST_PROMPT_VERSION };
