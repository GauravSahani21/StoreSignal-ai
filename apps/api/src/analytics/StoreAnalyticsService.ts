import type { Repositories } from '../database/repositories/index.js';
import type {
  AgentActivityMetrics,
  AnalyticsFilter,
  ConversationIntelligenceView,
  ConversationListItem,
  FollowUpQueueMetrics,
  OverviewMetrics,
  ShopperInsightsMetrics,
  StoreConversionInsights,
} from '../database/repositories/types.js';

export class StoreAnalyticsService {
  constructor(private readonly repositories: Repositories) {}

  /**
   * Filter conversations based on storeId, date range, and demo filter
   */
  private async getFilteredConversations(orgId: string, filter?: AnalyticsFilter) {
    const { items: all } = await this.repositories.conversations.listConversations(orgId, { limit: 1000 });
    return all.filter((c) => {
      if (filter?.storeId && c.storeId !== filter.storeId) return false;
      if (filter?.from && new Date(c.createdAt) < new Date(filter.from)) return false;
      if (filter?.to && new Date(c.createdAt) > new Date(filter.to)) return false;
      if (filter?.demoFilter === 'real_only' && c.isDemo) return false;
      if (filter?.demoFilter === 'demo_only' && !c.isDemo) return false;
      return true;
    });
  }

  /**
   * Area A: Overview KPIs
   */
  async getOverviewMetrics(orgId: string, filter?: AnalyticsFilter): Promise<OverviewMetrics> {
    const convs = await this.getFilteredConversations(orgId, filter);
    const convIds = new Set(convs.map((c) => c.id));
    const sampleSize = convs.length;

    // Fetch outcomes, drafts, shoppers, workflows
    const allOutcomes = await this.repositories.outcomes.listOutcomes(orgId);
    const outcomes = allOutcomes.filter((o) => !o.conversationId || convIds.has(o.conversationId));

    const allDrafts = await this.repositories.drafts.listDrafts(orgId);
    const drafts = allDrafts.filter((d) => convIds.has(d.conversationId));

    const relevantLinks = (await Promise.all(convs.map((c) => this.repositories.shoppers.getLinkForConversation(orgId, c.id)))).filter(Boolean);

    // Unique authorized shoppers
    const uniqueShopperIds = new Set(relevantLinks.map((l) => l!.shopperId));
    let uniqueAuthorizedShoppers = 0;
    for (const sid of uniqueShopperIds) {
      const shopper = await this.repositories.shoppers.findById(orgId, sid);
      if (shopper) {
        uniqueAuthorizedShoppers++;
      }
    }

    // Workflows and latency
    const workflows = (await Promise.all(convs.map((c) => this.repositories.workflows.getLatestRunForConversation(orgId, c.id)))).filter(Boolean);

    let totalDurationMs = 0;
    let completedWorkflows = 0;
    let questionsDetected = 0;
    let objectionsIdentified = 0;
    let unresolvedQuestions = 0;

    for (const wf of workflows) {
      if (wf!.state === 'COMPLETED') completedWorkflows++;
      totalDurationMs += wf!.durationMs || 0;

      // Extract metrics from workflow step results
      const analystOutput = wf!.stepResults['signal_analyst']?.output as Record<string, unknown> | undefined;
      if (analystOutput) {
        const questions = (analystOutput['questionsAsked'] as unknown[]) || [];
        const objections = (analystOutput['objections'] as unknown[]) || [];
        questionsDetected += questions.length;
        objectionsIdentified += objections.length;
      }

      const coachOutput = wf!.stepResults['floor_coach']?.output as Record<string, unknown> | undefined;
      if (coachOutput) {
        const unresolved = (coachOutput['unresolvedQuestions'] as unknown[]) || [];
        unresolvedQuestions += unresolved.length;
      }
    }

    const recordedPurchases = outcomes.filter((o) => o.type === 'purchase');
    const totalRevenueInr = recordedPurchases.reduce((acc, p) => acc + (p.value || 0), 0);
    const pendingApprovals = drafts.filter((d) => d.status === 'draft' && d.requiresHumanApproval).length;

    // AI Usage summary
    const usageSummary = await this.repositories.usageEvents.getSummary(orgId, {
      from: filter?.from,
      to: filter?.to,
    });

    return {
      conversationsProcessed: sampleSize,
      uniqueAuthorizedShoppers,
      questionsDetected,
      objectionsIdentified,
      unresolvedQuestions,
      followUpDraftsTotal: drafts.length,
      pendingApprovals,
      recordedConversions: recordedPurchases.length,
      totalRevenueInr,
      conversionRatePercentage: sampleSize > 0 ? Number(((recordedPurchases.length / sampleSize) * 100).toFixed(1)) : 0,
      avgProcessingLatencyMs: workflows.length > 0 ? Math.round(totalDurationMs / workflows.length) : 0,
      workflowSuccessRatePercentage: workflows.length > 0 ? Number(((completedWorkflows / workflows.length) * 100).toFixed(1)) : 0,
      totalAiTokensUsed: usageSummary.totalTokens,
      totalAiCostUsd: usageSummary.totalCostUsd,
      sampleSize,
      isLowDataState: sampleSize < 5,
    };
  }

  /**
   * Area B: Conversation List
   */
  async getConversationList(orgId: string, filter?: AnalyticsFilter): Promise<ConversationListItem[]> {
    const convs = await this.getFilteredConversations(orgId, filter);

    const items: ConversationListItem[] = [];
    for (const c of convs) {
      const transcript = await this.repositories.conversations.getTranscript(c.id);
      const link = await this.repositories.shoppers.getLinkForConversation(orgId, c.id);
      let shopperInfo: { externalCustomerId?: string; isReturningVisitor: boolean } = {
        isReturningVisitor: false,
      };

      if (link) {
        const shopper = await this.repositories.shoppers.findById(orgId, link.shopperId);
        if (shopper) {
          const links = await this.repositories.shoppers.getLinksForShopper(orgId, shopper.id);
          shopperInfo = {
            externalCustomerId: shopper.externalCustomerId ?? undefined,
            isReturningVisitor: links.length > 1,
          };
        }
      }

      const wf = await this.repositories.workflows.getLatestRunForConversation(orgId, c.id);
      let intentScore: number | undefined;
      let intentBand: string | undefined;

      if (wf?.stepResults['signal_analyst']?.output) {
        const analystOutput = wf.stepResults['signal_analyst'].output as Record<string, unknown>;
        const assessment = analystOutput['intentAssessment'] as Record<string, unknown> | undefined;
        if (assessment) {
          intentScore = typeof assessment['score'] === 'number' ? assessment['score'] : undefined;
          intentBand = typeof assessment['band'] === 'string' ? assessment['band'] : undefined;
        }
      }

      items.push({
        id: c.id,
        orgId: c.orgId,
        storeId: c.storeId ?? 'default-store',
        isDemo: c.isDemo,
        status: c.status,
        source: c.source,
        segmentCount: transcript?.segments.length || 0,
        shopperId: link?.shopperId,
        externalCustomerId: shopperInfo.externalCustomerId,
        isReturningVisitor: shopperInfo.isReturningVisitor,
        workflowState: wf?.state,
        workflowDurationMs: wf?.durationMs,
        intentScore,
        intentBand,
        createdAt: c.createdAt,
      });
    }

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Area B: Single Conversation Intelligence View
   */
  async getConversationDetails(orgId: string, conversationId: string): Promise<ConversationIntelligenceView | null> {
    const conv = await this.repositories.conversations.findById(conversationId);
    if (!conv || conv.orgId !== orgId) return null;

    const transcript = await this.repositories.conversations.getTranscript(conversationId);
    const link = await this.repositories.shoppers.getLinkForConversation(orgId, conversationId);
    let shopperData: ConversationIntelligenceView['shopper'] = null;

    if (link) {
      const s = await this.repositories.shoppers.findById(orgId, link.shopperId);
      if (s) {
        const links = await this.repositories.shoppers.getLinksForShopper(orgId, s.id);
        shopperData = {
          id: s.id,
          externalCustomerId: s.externalCustomerId,
          isIdentified: Boolean(s.externalCustomerId || s.contactHash),
          visitCount: links.length,
        };
      }
    }

    const wf = await this.repositories.workflows.getLatestRunForConversation(orgId, conversationId);
    const drafts = await this.repositories.drafts.getDraftsForConversation(orgId, conversationId);
    const outcomes = await this.repositories.outcomes.getOutcomesForConversation(orgId, conversationId);

    // Parse intelligence from workflow outputs
    const coachOut = wf?.stepResults['floor_coach']?.output as Record<string, unknown> | undefined;
    const analystOut = wf?.stepResults['signal_analyst']?.output as Record<string, unknown> | undefined;

    const questionsDetected: Array<{ question: string; segmentId?: string }> = [];
    if (analystOut && Array.isArray(analystOut['questionsAsked'])) {
      for (const q of analystOut['questionsAsked']) {
        const qObj = q as { question?: string; evidence?: Array<{ segmentId?: string }> };
        if (qObj.question) {
          questionsDetected.push({
            question: qObj.question,
            segmentId: qObj.evidence?.[0]?.segmentId,
          });
        }
      }
    }

    const objectionsIdentified: Array<{ objectionType: string; customerQuote: string; segmentId?: string }> = [];
    if (analystOut && Array.isArray(analystOut['objections'])) {
      for (const obj of analystOut['objections']) {
        const o = obj as { type?: string; customerQuote?: string; evidence?: Array<{ segmentId?: string }> };
        if (o.type && o.customerQuote) {
          objectionsIdentified.push({
            objectionType: o.type,
            customerQuote: o.customerQuote,
            segmentId: o.evidence?.[0]?.segmentId,
          });
        }
      }
    }

    const suggestedResponses: Array<{ topic: string; response: string; citedChunks?: string[] }> = [];
    if (coachOut && Array.isArray(coachOut['suggestions'])) {
      for (const s of coachOut['suggestions']) {
        const sObj = s as { topic?: string; guidance?: string; sources?: string[] };
        if (sObj.topic && sObj.guidance) {
          suggestedResponses.push({
            topic: sObj.topic,
            response: sObj.guidance,
            citedChunks: sObj.sources,
          });
        }
      }
    }

    const productInterests: Array<{ productRef: string; text: string; basis: string; segmentId?: string }> = [];
    if (analystOut && Array.isArray(analystOut['productInterests'])) {
      for (const p of analystOut['productInterests']) {
        const pObj = p as { productRef?: string; text?: string; basis?: string; evidence?: Array<{ segmentId?: string }> };
        if (pObj.productRef && pObj.text) {
          productInterests.push({
            productRef: pObj.productRef,
            text: pObj.text,
            basis: pObj.basis || 'explicit',
            segmentId: pObj.evidence?.[0]?.segmentId,
          });
        }
      }
    }

    const assessment = analystOut?.['intentAssessment'] as Record<string, unknown> | undefined;
    const contributingSignals: Array<{ signalId: string; weight: number; label: string; evidenceQuote?: string; segmentId?: string }> = [];
    if (assessment && Array.isArray(assessment['contributingSignals'])) {
      for (const sig of assessment['contributingSignals']) {
        const sigObj = sig as { signalId?: string; weight?: number; label?: string; evidence?: Array<{ segmentId?: string; quote?: string }> };
        if (sigObj.signalId && typeof sigObj.weight === 'number') {
          contributingSignals.push({
            signalId: sigObj.signalId,
            weight: sigObj.weight,
            label: sigObj.label || sigObj.signalId,
            evidenceQuote: sigObj.evidence?.[0]?.quote,
            segmentId: sigObj.evidence?.[0]?.segmentId,
          });
        }
      }
    }

    const unresolvedQuestions = (coachOut?.['unresolvedQuestions'] as string[]) || [];

    return {
      conversation: {
        id: conv.id,
        orgId: conv.orgId,
        storeId: conv.storeId ?? 'default-store',
        isDemo: conv.isDemo,
        status: conv.status,
        source: conv.source,
        createdAt: conv.createdAt,
      },
      transcript: {
        id: transcript?.id || 'empty-transcript',
        segments:
          transcript?.segments.map((seg) => ({
            id: seg.id,
            speaker: seg.speaker,
            text: seg.text,
            startMs: seg.startMs,
            endMs: seg.endMs,
          })) || [],
      },
      shopper: shopperData,
      intelligence: {
        summary: typeof analystOut?.['summary'] === 'string' ? analystOut['summary'] : undefined,
        intentScore: typeof assessment?.['score'] === 'number' ? assessment['score'] : undefined,
        intentBand: typeof assessment?.['band'] === 'string' ? assessment['band'] : undefined,
        intentConfidence: typeof assessment?.['confidence'] === 'string' ? assessment['confidence'] : undefined,
        questionsDetected,
        objectionsIdentified,
        unresolvedQuestions,
        suggestedResponses,
        productInterests,
        contributingSignals,
      },
      workflow: wf
        ? {
            id: wf.id,
            state: wf.state,
            durationMs: wf.durationMs,
            stepResults: wf.stepResults,
          }
        : null,
      drafts: drafts.map((d) => ({
        id: d.id,
        channel: d.channel,
        status: d.status,
        subject: d.subject,
        message: d.message,
        recommendedAction: d.recommendedAction,
      })),
      outcomes,
    };
  }

  /**
   * Area C: Shopper Insights Aggregation
   */
  async getShopperInsights(orgId: string, filter?: AnalyticsFilter): Promise<ShopperInsightsMetrics> {
    const convs = await this.getFilteredConversations(orgId, filter);
    const allOutcomes = await this.repositories.outcomes.listOutcomes(orgId);

    const intentBandDistribution: Record<'high' | 'medium' | 'low' | 'abstained', number> = {
      high: 0,
      medium: 0,
      low: 0,
      abstained: 0,
    };

    const productInterestCounts = new Map<string, { name: string; count: number }>();
    const shoppersSeen = new Set<string>();
    let identifiedShoppers = 0;
    let anonymousShoppers = 0;
    let returningVisitors = 0;

    let firstTimeConversions = 0;
    let firstTimeTotal = 0;
    let repeatConversions = 0;
    let repeatTotal = 0;

    for (const c of convs) {
      const link = await this.repositories.shoppers.getLinkForConversation(orgId, c.id);
      let isRepeat = false;

      if (link) {
        const links = await this.repositories.shoppers.getLinksForShopper(orgId, link.shopperId);
        if (links.length > 1) {
          isRepeat = true;
        }

        if (!shoppersSeen.has(link.shopperId)) {
          shoppersSeen.add(link.shopperId);
          const s = await this.repositories.shoppers.findById(orgId, link.shopperId);
          if (s) {
            const isIdentified = Boolean(s.externalCustomerId || s.contactHash);
            if (isIdentified) identifiedShoppers++;
            else anonymousShoppers++;
            if (links.length > 1) {
              returningVisitors++;
            }
          }
        }
      }

      // Check conversion on this conversation
      const convPurchases = allOutcomes.filter((o) => o.conversationId === c.id && o.type === 'purchase');
      if (isRepeat) {
        repeatTotal++;
        if (convPurchases.length > 0) repeatConversions++;
      } else {
        firstTimeTotal++;
        if (convPurchases.length > 0) firstTimeConversions++;
      }

      // Workflow intent and product interests
      const wf = await this.repositories.workflows.getLatestRunForConversation(orgId, c.id);
      if (wf?.stepResults['signal_analyst']?.output) {
        const analystOut = wf.stepResults['signal_analyst'].output as Record<string, unknown>;
        const assessment = analystOut['intentAssessment'] as Record<string, unknown> | undefined;
        const band = assessment?.['band'] as 'high' | 'medium' | 'low' | 'abstained' | undefined;
        if (band && band in intentBandDistribution) {
          intentBandDistribution[band]++;
        }

        if (Array.isArray(analystOut['productInterests'])) {
          for (const item of analystOut['productInterests']) {
            const p = item as { productRef?: string; text?: string };
            if (p.productRef) {
              const current = productInterestCounts.get(p.productRef) || {
                name: p.text || p.productRef,
                count: 0,
              };
              current.count++;
              productInterestCounts.set(p.productRef, current);
            }
          }
        }
      }
    }

    const topProductInterests = Array.from(productInterestCounts.entries())
      .map(([productRef, val]) => ({
        productRef,
        name: val.name,
        count: val.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalShoppers: shoppersSeen.size,
      identifiedShoppers,
      anonymousShoppers,
      returningVisitors,
      intentBandDistribution,
      topProductInterests,
      conversionByVisitorType: {
        firstTimeConversions,
        firstTimeTotal,
        repeatConversions,
        repeatTotal,
      },
      sampleSize: convs.length,
    };
  }

  /**
   * Area D: Agent Activity & Usage Metrics
   */
  async getAgentActivity(orgId: string, filter?: AnalyticsFilter): Promise<AgentActivityMetrics> {
    const usage = await this.repositories.usageEvents.listUsage(orgId, {
      from: filter?.from,
      to: filter?.to,
    });

    const invocationsByAgent: AgentActivityMetrics['invocationsByAgent'] = {};
    const agents: NonNullable<AgentActivityMetrics['agents']> = {};
    const agentLatencies: Record<string, number[]> = {};
    let totalTokens = 0;
    let totalCostCents = 0;
    const latencies: number[] = [];

    for (const u of usage) {
      totalTokens += u.totalTokens || 0;
      totalCostCents += u.costCents || 0;
      latencies.push(u.latencyMs);

      if (!agentLatencies[u.agent]) {
        agentLatencies[u.agent] = [];
      }
      agentLatencies[u.agent]!.push(u.latencyMs);

      const current = invocationsByAgent[u.agent] || {
        count: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
      };
      current.count++;
      current.successCount++;
      current.avgLatencyMs += u.latencyMs;
      invocationsByAgent[u.agent] = current;

      const agt = agents[u.agent] || {
        invocations: 0,
        successful: 0,
        failed: 0,
        successRatePercentage: 100,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
      };
      agt.invocations++;
      agt.successful++;
      agt.totalPromptTokens += u.promptTokens || 0;
      agt.totalCompletionTokens += u.completionTokens || 0;
      agt.totalTokens += u.totalTokens || 0;
      agt.totalCostUsd += Number(((u.costCents || 0) / 100).toFixed(4));
      agents[u.agent] = agt;
    }

    for (const agent of Object.keys(invocationsByAgent)) {
      const item = invocationsByAgent[agent]!;
      if (item.count > 0) {
        item.avgLatencyMs = Math.round(item.avgLatencyMs / item.count);
      }
    }

    for (const [agent, lats] of Object.entries(agentLatencies)) {
      lats.sort((a, b) => a - b);
      const agt = agents[agent];
      if (agt && lats.length > 0) {
        agt.p50LatencyMs = lats[Math.floor(lats.length * 0.5)] ?? 0;
        agt.p95LatencyMs = lats[Math.floor(lats.length * 0.95)] ?? 0;
        agt.totalCostUsd = Number(agt.totalCostUsd.toFixed(4));
      }
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies.length > 0 ? (latencies[p95Index] ?? 0) : 0;
    const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const totalCostUsd = Number((totalCostCents / 100).toFixed(4));

    return {
      totalInvocations: usage.length,
      invocationsByAgent,
      agents,
      overallSuccessRate: usage.length > 0 ? 100 : 0,
      avgLatencyMs,
      p95LatencyMs,
      totalTokens,
      totalCostUsd,
      overallCostUsd: totalCostUsd,
      sampleSize: usage.length,
    };
  }

  /**
   * Area E: Governed Follow-Up Queue Status
   */
  async getFollowUpQueueMetrics(orgId: string, filter?: AnalyticsFilter): Promise<FollowUpQueueMetrics> {
    const convs = await this.getFilteredConversations(orgId, filter);
    const convIds = new Set(convs.map((c) => c.id));
    const allDrafts = await this.repositories.drafts.listDrafts(orgId);
    const drafts = allDrafts.filter((d) => convIds.has(d.conversationId));

    const byStatus: Record<'draft' | 'approved' | 'rejected', number> = {
      draft: 0,
      approved: 0,
      rejected: 0,
    };

    const byChannel: Record<string, number> = {};

    for (const d of drafts) {
      if (d.status in byStatus) {
        byStatus[d.status]++;
      }
      byChannel[d.channel] = (byChannel[d.channel] || 0) + 1;
    }

    const reviewed = byStatus.approved + byStatus.rejected;
    const approvalRatePercentage = reviewed > 0 ? Number(((byStatus.approved / reviewed) * 100).toFixed(1)) : 0;

    return {
      totalDrafts: drafts.length,
      byStatus,
      byChannel,
      approvalRatePercentage,
      sampleSize: drafts.length,
    };
  }

  /**
   * Area F: Store & Conversion Insights
   */
  async getStoreConversionInsights(orgId: string, filter?: AnalyticsFilter): Promise<StoreConversionInsights> {
    const convs = await this.getFilteredConversations(orgId, filter);
    const convIds = new Set(convs.map((c) => c.id));
    const sampleSize = convs.length;

    const allOutcomes = await this.repositories.outcomes.listOutcomes(orgId);
    const outcomes = allOutcomes.filter((o) => !o.conversationId || convIds.has(o.conversationId));

    const objectionCounts = new Map<string, number>();
    const unansweredQuestionCounts = new Map<string, number>();
    const missedReasonCounts = new Map<string, number>();

    let totalConversionValueInr = 0;
    let purchaseCount = 0;

    for (const o of outcomes) {
      if (o.type === 'purchase') {
        purchaseCount++;
        totalConversionValueInr += o.value || 0;
      } else if (o.type === 'missed_conversion' && o.reason) {
        missedReasonCounts.set(o.reason, (missedReasonCounts.get(o.reason) || 0) + 1);
      }
    }

    for (const c of convs) {
      const wf = await this.repositories.workflows.getLatestRunForConversation(orgId, c.id);
      if (wf) {
        const analystOut = wf.stepResults['signal_analyst']?.output as Record<string, unknown> | undefined;
        if (analystOut && Array.isArray(analystOut['objections'])) {
          for (const obj of analystOut['objections']) {
            const o = obj as { type?: string };
            if (o.type) {
              objectionCounts.set(o.type, (objectionCounts.get(o.type) || 0) + 1);
            }
          }
        }

        const coachOut = wf.stepResults['floor_coach']?.output as Record<string, unknown> | undefined;
        if (coachOut && Array.isArray(coachOut['unresolvedQuestions'])) {
          for (const q of coachOut['unresolvedQuestions']) {
            if (typeof q === 'string') {
              unansweredQuestionCounts.set(q, (unansweredQuestionCounts.get(q) || 0) + 1);
            }
          }
        }
      }
    }

    const totalObjections = Array.from(objectionCounts.values()).reduce((a, b) => a + b, 0);
    const frequentObjections = Array.from(objectionCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalObjections > 0 ? Number(((count / totalObjections) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const frequentUnansweredQuestions = Array.from(unansweredQuestionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count);

    const missedConversionReasons = Array.from(missedReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      frequentObjections,
      frequentUnansweredQuestions,
      missedConversionReasons,
      totalConversionValueInr,
      averageDealValueInr: purchaseCount > 0 ? Math.round(totalConversionValueInr / purchaseCount) : 0,
      sampleSize,
      isLowDataWarning: sampleSize < 5,
    };
  }

  /**
   * CSV Event Export (RFC 4180 format)
   */
  async exportEventsCsv(orgId: string, filter?: AnalyticsFilter): Promise<string> {
    const events = await this.repositories.storeEvents.listEvents(orgId, {
      storeId: filter?.storeId,
      from: filter?.from,
      to: filter?.to,
    });

    const headers = ['id', 'org_id', 'store_id', 'type', 'source', 'shopper_id', 'conversation_id', 'created_at', 'metadata_summary'];
    const rows: string[] = [headers.join(',')];

    for (const e of events) {
      const summary = JSON.stringify(e.metadata || {}).replace(/"/g, '""');
      rows.push([
        `"${e.id}"`,
        `"${e.orgId}"`,
        `"${e.storeId || ''}"`,
        `"${e.type}"`,
        `"${e.source}"`,
        `"${e.shopperId || ''}"`,
        `"${e.conversationId || ''}"`,
        `"${e.createdAt}"`,
        `"${summary}"`,
      ].join(','));
    }

    return rows.join('\r\n');
  }
}
