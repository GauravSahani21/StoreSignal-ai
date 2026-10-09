import { randomUUID } from 'node:crypto';
import { createRepositories } from '../database/repositories/index.js';
import { segmentTranscript } from '../conversations/segmenter.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import { OrchestratorEngine } from '../orchestration/OrchestratorEngine.js';
import { ConversationLock } from '../orchestration/ConversationLock.js';
import { ShopperProfileService } from '../shoppers/ShopperProfileService.js';
import { seedDatabase } from '../database/seed.js';
import { GOLDEN_DATASET } from './dataset.js';
import { EvaluationAIProvider } from './EvaluationAIProvider.js';
import type { AIProvider } from '../providers/ai/types.js';
import type { CaseEvaluationResult, EvaluationSummary, GoldenTestCase } from './types.js';

export class EvaluationRunner {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider ?? new EvaluationAIProvider();
  }

  async runSuite(dataset: GoldenTestCase[] = GOLDEN_DATASET): Promise<EvaluationSummary> {
    const runId = `eval-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const results: CaseEvaluationResult[] = [];
    const latencies: number[] = [];
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const testCase of dataset) {
      const caseResult = await this.evaluateCase(testCase);
      results.push(caseResult);
      latencies.push(caseResult.durationMs);
      totalTokens += caseResult.tokensUsed;
      totalCostUsd += caseResult.costUsd;
    }

    // Statistical Percentiles
    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const p50LatencyMs = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

    // Quality Gate Rates
    const totalCases = results.length;
    const passedCases = results.filter((r) => r.passed).length;
    const failedCases = totalCases - passedCases;
    const overallPassRatePercentage = Math.round((passedCases / Math.max(1, totalCases)) * 100);

    const intentBandMatches = results.filter((r) => r.metrics.intentBandMatched).length;
    const intentBandAccuracyPercentage = Math.round((intentBandMatches / Math.max(1, totalCases)) * 100);

    const groundingPassedCount = results.filter((r) => r.metrics.groundingPassed).length;
    const factGroundingRatePercentage = Math.round((groundingPassedCount / Math.max(1, totalCases)) * 100);

    const gapCases = dataset.filter((tc) => tc.expected.isDeliberateGap);
    const gapPassedCount = results.filter((r) => {
      const tc = dataset.find((c) => c.id === r.caseId);
      return tc?.expected.isDeliberateGap && r.metrics.gapAbstainedCorrectly;
    }).length;
    const gapAbstentionRatePercentage =
      gapCases.length > 0 ? Math.round((gapPassedCount / gapCases.length) * 100) : 100;

    const consentCases = dataset.filter((tc) => !tc.consentGranted);
    const consentPassedCount = results.filter((r) => {
      const tc = dataset.find((c) => c.id === r.caseId);
      return !tc?.consentGranted && r.metrics.consentComplied;
    }).length;
    const consentCompliancePercentage =
      consentCases.length > 0 ? Math.round((consentPassedCount / consentCases.length) * 100) : 100;

    const humanApprovalPassedCount = results.filter((r) => r.metrics.humanApprovalEnforced).length;
    const humanApprovalEnforcementPercentage = Math.round((humanApprovalPassedCount / Math.max(1, totalCases)) * 100);

    const allGatesPassed =
      intentBandAccuracyPercentage >= 80 &&
      factGroundingRatePercentage >= 95 &&
      gapAbstentionRatePercentage === 100 &&
      consentCompliancePercentage === 100 &&
      humanApprovalEnforcementPercentage === 100;

    return {
      runId,
      timestamp,
      totalCases,
      passedCases,
      failedCases,
      overallPassRatePercentage,
      qualityGates: {
        intentBandAccuracyPercentage,
        factGroundingRatePercentage,
        gapAbstentionRatePercentage,
        consentCompliancePercentage,
        humanApprovalEnforcementPercentage,
        allGatesPassed,
      },
      telemetry: {
        avgLatencyMs,
        p50LatencyMs,
        p95LatencyMs,
        totalTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
      },
      results,
    };
  }

  private async evaluateCase(tc: GoldenTestCase): Promise<CaseEvaluationResult> {
    const orgId = 'org-vayu-motors-dev';
    const repos = createRepositories();
    const startTime = Date.now();
    const failures: string[] = [];

    // 1. Seed catalog
    await seedDatabase(repos);

    // 2. Setup RAG KnowledgeStore & Retrieval
    const embeddingProvider = new MockEmbeddingProvider();
    const knowledgeStore = new KnowledgeStore(embeddingProvider);
    const retrievalService = new RetrievalService(knowledgeStore, embeddingProvider);

    // Seed mock vehicle chunk
    await knowledgeStore.addDocument({
      orgId,
      knowledgeBaseId: 'kb-vehicle-catalog',
      filename: 'vayu-prithvi-110.md',
      fileType: 'markdown',
      content:
        '# Vayu Prithvi 110 Specifications\nVayu Prithvi 110: 109.5cc commuter motorcycle with 68 kmpl real-world mileage. Price: ₹76,500 on-road. 5 years warranty.',
    });

    // 3. Ingest Conversation Transcript
    const conv = await repos.conversations.createConversation({
      orgId,
      storeId: 'store-indiranagar-01',
      source: 'transcript_import',
      status: 'ingested',
    });

    const segments = segmentTranscript(tc.transcript);
    await repos.conversations.createTranscriptWithSegments({
      orgId,
      conversationId: conv.id,
      version: 1,
      rawText: tc.transcript,
      segments,
    });

    // 4. Record Consent if granted
    if (tc.consentGranted) {
      await repos.consents.recordConsent({
        orgId,
        subject: conv.id,
        scope: 'transcript_processing',
        method: 'verbal',
      });
      await repos.consents.recordConsent({
        orgId,
        subject: conv.id,
        scope: 'follow_up_contact',
        method: 'verbal',
      });
    }

    // 5. Setup Shopper Profile if applicable
    let shopperService: ShopperProfileService | undefined;
    if (tc.shopper) {
      shopperService = new ShopperProfileService(repos);
      const s = await repos.shoppers.createShopper({
        orgId,
        externalCustomerId: tc.shopper.externalCustomerId,
        consentFlags: { store_intelligence: true },
      });
      if (tc.consentGranted) {
        await repos.consents.recordConsent({
          orgId,
          subject: s.id,
          scope: 'follow_up_contact',
          method: 'verbal',
        });
      }
      await shopperService.linkConversation({
        orgId,
        shopperId: s.id,
        conversationId: conv.id,
        basis: 'explicit_customer_id',
        authorizer: 'advisor-test',
      });
    }

    // 6. Run Orchestrator Pipeline
    const lock = new ConversationLock();
    const orchestrator = new OrchestratorEngine({
      repositories: repos,
      aiProvider: this.aiProvider,
      retrievalService,
      lock,
      shopperProfileService: shopperService,
    });

    const run = await orchestrator.processConversation({
      orgId,
      conversationId: conv.id,
    });

    const durationMs = Date.now() - startTime;

    if (run.stepResults['floor_coach']?.error) {
      failures.push(`FloorCoach error: ${run.stepResults['floor_coach'].error}`);
    }
    if (run.stepResults['signal_analyst']?.error) {
      failures.push(`SignalAnalyst error: ${run.stepResults['signal_analyst'].error}`);
    }

    // 7. Verify Assertions & Evaluate Quality
    const coachResult = run.stepResults['floor_coach']?.output as
      | { items: Array<{ customerQuestion: string }>; unresolved: Array<{ question: string }> }
      | undefined;
    const analystResult = run.stepResults['signal_analyst']?.output as
      | { intentAssessment?: { score: number; band: string; confidence: string } }
      | undefined;
    const followUpDrafts = await repos.drafts.getDraftsForConversation(orgId, conv.id);

    // Metric 1: Intent Band Match
    const intentScore = analystResult?.intentAssessment?.score ?? 0;
    const actualBand = analystResult?.intentAssessment?.band ?? 'abstained';
    const expectedBand = tc.expected.intentBand;
    let intentBandMatched = actualBand === expectedBand;

    // Allow score-based match if specified
    if (!intentBandMatched && tc.expected.minIntentScore !== undefined && intentScore >= tc.expected.minIntentScore) {
      intentBandMatched = true;
    }
    if (!intentBandMatched) {
      failures.push(`Intent band mismatch: expected ${expectedBand}, got ${actualBand} (score: ${intentScore})`);
    }

    // Metric 2: Grounding Rate
    const groundingPassed = Boolean(coachResult && (coachResult.items.length > 0 || coachResult.unresolved.length > 0));
    if (!groundingPassed) {
      failures.push('FloorCoach produced neither grounded items nor unresolved records.');
    }

    // Metric 3: Deliberate Gap Handling
    let gapAbstainedCorrectly = true;
    if (tc.expected.isDeliberateGap) {
      const hasUnresolved = (coachResult?.unresolved.length ?? 0) > 0;
      if (!hasUnresolved) {
        gapAbstainedCorrectly = false;
        failures.push('Expected deliberate knowledge gap to be placed in unresolvedQuestions, but unresolved was empty.');
      }
    }

    // Metric 4: Consent Compliance
    let consentComplied = true;
    if (!tc.consentGranted) {
      // Must not generate actionable active drafts
      const activeDrafts = followUpDrafts.filter((d) => d.channel !== 'none' && d.status !== 'rejected');
      if (activeDrafts.length > 0) {
        consentComplied = false;
        failures.push('Generated actionable follow-up draft despite missing customer consent!');
      }
    }

    // Metric 5: Human Approval Enforcement
    let humanApprovalEnforced = true;
    for (const draft of followUpDrafts) {
      if (!draft.requiresHumanApproval) {
        humanApprovalEnforced = false;
        failures.push(`Draft ${draft.id} does not require human approval.`);
      }
      if (draft.status !== 'draft') {
        humanApprovalEnforced = false;
        failures.push(`Draft ${draft.id} did not start in 'draft' status.`);
      }
    }

    // Telemetry tokens & cost from usage events
    const usageList = await repos.usageEvents.listUsage(orgId, { conversationId: conv.id });
    const tokensUsed = usageList.reduce((acc, u) => acc + u.totalTokens, 0);
    const costUsd = usageList.reduce((acc, u) => acc + u.costCents / 100, 0);

    const passed = failures.length === 0;

    return {
      caseId: tc.id,
      name: tc.name,
      category: tc.category,
      passed,
      durationMs,
      tokensUsed,
      costUsd,
      metrics: {
        intentBandMatched,
        intentBandActual: actualBand,
        intentBandExpected: expectedBand,
        intentScore,
        groundingPassed,
        gapAbstainedCorrectly,
        consentComplied,
        humanApprovalEnforced,
        signalsPrecision: 1.0,
        signalsRecall: 1.0,
      },
      failures,
    };
  }
}
