import type { ParsedSegment } from '../../conversations/segmenter.js';
import { AgentOutputInvalidError } from '../../errors/AppError.js';
import type { AIProvider } from '../../providers/ai/types.js';
import type { RetrievalService } from '../../rag/retrieval/RetrievalService.js';
import type { RetrievedChunk } from '../../rag/retrieval/types.js';
import {
  type GuardValidationResult,
  validateEvidenceExistence,
  validateNumericGrounding,
  validateQuoteContainment,
  validateSourceSubset,
} from '../guards/groundingGuards.js';
import {
  FLOOR_COACH_PROMPT_VERSION,
  buildFloorCoachRepairPrompt,
  buildFloorCoachSystemPrompt,
  buildFloorCoachUserPrompt,
} from './prompts.js';
import { type FloorCoachOutput, FloorCoachOutputSchema } from './schema.js';

export interface FloorCoachAgentConfig {
  aiProvider: AIProvider;
  retrievalService: RetrievalService;
  model?: string;
  maxRetries?: number;
}

export interface FloorCoachResult {
  output: FloorCoachOutput;
  modelUsed: string;
  durationMs: number;
  retries: number;
  retrievedChunks: RetrievedChunk[];
  guardResults: GuardValidationResult[];
}

export class FloorCoachAgent {
  private readonly aiProvider: AIProvider;
  private readonly retrievalService: RetrievalService;
  private readonly model?: string;
  private readonly maxRetries: number;

  constructor(config: FloorCoachAgentConfig) {
    this.aiProvider = config.aiProvider;
    this.retrievalService = config.retrievalService;
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async run(orgId: string, segments: ParsedSegment[]): Promise<FloorCoachResult> {
    const startTime = Date.now();

    // 1. Gather dialogue context for RAG retrieval
    const customerSegments = segments.filter((s) => s.speaker === 'customer');
    const query = customerSegments.map((s) => s.text).join(' ') || segments.map((s) => s.text).join(' ');

    // 2. Perform knowledge retrieval
    const retrievalRes = await this.retrievalService.retrieve(orgId, query, { topK: 5, threshold: 0.38 });
    const retrievedChunks = retrievalRes.chunks;

    // 3. Construct prompts
    const systemPrompt = buildFloorCoachSystemPrompt();
    const userPrompt = buildFloorCoachUserPrompt(segments, retrievedChunks);

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
        temperature: 0.1, // Low temperature for factual extraction
      });

      lastRawResponse = aiResponse.content;
      actualModel = aiResponse.model;

      // Extract JSON string from markdown code blocks if wrapped
      const cleanJson = this.extractJson(lastRawResponse);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleanJson);
      } catch (err) {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `FloorCoach model returned non-JSON output after ${this.maxRetries} repair attempts: ${err instanceof Error ? err.message : ''}`
          );
        }
        // Prepare repair prompt
        const repairPrompt = buildFloorCoachRepairPrompt(userPrompt, lastRawResponse, [
          'Output was not valid JSON. Ensure you return ONLY valid JSON matching the schema.',
        ]);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      // Schema validation via Zod
      const zodResult = FloorCoachOutputSchema.safeParse(parsedJson);
      if (!zodResult.success) {
        if (attempts > this.maxRetries) {
          throw new AgentOutputInvalidError(
            `FloorCoach output failed Zod schema validation: ${zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
        const issues = zodResult.error.issues.map((i) => `Field "${i.path.join('.')}": ${i.message}`);
        const repairPrompt = buildFloorCoachRepairPrompt(userPrompt, lastRawResponse, issues);
        currentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: repairPrompt },
        ];
        continue;
      }

      const output = zodResult.data;

      // 4. Run Grounding Guards (§5.5) in code
      guardResults = this.runGuards(output, segments, retrievedChunks);
      const failedGuards = guardResults.filter((g) => !g.passed);

      if (failedGuards.length === 0) {
        return {
          output,
          modelUsed: actualModel,
          durationMs: Date.now() - startTime,
          retries: attempts - 1,
          retrievedChunks,
          guardResults,
        };
      }

      if (attempts > this.maxRetries) {
        throw new AgentOutputInvalidError(
          `FloorCoach output violated grounding guards after retries: ${failedGuards.map((g) => g.message).join('; ')}`
        );
      }

      // Repair prompt with specific guard failures
      const repairPrompt = buildFloorCoachRepairPrompt(
        userPrompt,
        lastRawResponse,
        failedGuards.map((g) => `Guard [${g.guard}] failed: ${g.message}`)
      );
      currentMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: repairPrompt },
      ];
    }

    throw new AgentOutputInvalidError('FloorCoach agent exceeded retry budget.');
  }

  private runGuards(
    output: FloorCoachOutput,
    segments: ParsedSegment[],
    retrievedChunks: RetrievedChunk[]
  ): GuardValidationResult[] {
    const results: GuardValidationResult[] = [];
    const customerSegments = segments.filter((s) => s.speaker === 'customer');

    for (const item of output.items) {
      // Guard 1: Evidence existence
      const exRes = validateEvidenceExistence(item.evidence, segments);
      results.push(exRes);

      // Guard 2: Quote containment
      const qcRes = validateQuoteContainment(item.evidence, segments);
      results.push(qcRes);

      // Guard 3: Source subset
      const ssRes = validateSourceSubset(item.supportingSources, retrievedChunks);
      results.push(ssRes);

      // Guard 4: Numeric grounding
      if (item.answerStatus === 'answered_from_knowledge') {
        const citedChunks = retrievedChunks.filter((c) =>
          item.supportingSources.some((src) => src.chunkId === c.chunkId)
        );
        const ngRes = validateNumericGrounding(item.suggestedResponse, citedChunks, customerSegments);
        results.push(ngRes);
      }
    }

    for (const unres of output.unresolved) {
      results.push(validateEvidenceExistence(unres.evidence, segments));
      results.push(validateQuoteContainment(unres.evidence, segments));
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

export { FLOOR_COACH_PROMPT_VERSION };
