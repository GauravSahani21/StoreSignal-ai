import { describe, expect, it, beforeEach } from 'vitest';
import { StoreAnalyticsService } from '../analytics/StoreAnalyticsService.js';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createRepositories, type Repositories } from '../database/repositories/index.js';
import { seedDatabase, DEFAULT_DEV_ORG_ID } from '../database/seed.js';

describe('Retail Analytics Dashboard Engine (Phase 11 & §13)', () => {
  let repos: Repositories;
  let service: StoreAnalyticsService;
  const orgId = DEFAULT_DEV_ORG_ID;

  beforeEach(async () => {
    repos = createRepositories();
    await seedDatabase(repos);
    service = new StoreAnalyticsService(repos);
  });

  describe('Area A: Operations Overview KPIs', () => {
    it('computes honest overview metrics from persisted demo records', async () => {
      const overview = await service.getOverviewMetrics(orgId);

      expect(overview.conversationsProcessed).toBe(6);
      expect(overview.sampleSize).toBe(6);
      expect(overview.isLowDataState).toBe(false);

      // Recorded purchases in seed: conv-demo-001 (₹76500), conv-demo-002 (₹6500), conv-demo-005 (₹132000)
      expect(overview.recordedConversions).toBe(3);
      expect(overview.totalRevenueInr).toBe(76500 + 6500 + 132000);
      expect(overview.conversionRatePercentage).toBe(50); // 3 / 6 = 50%

      // Completed workflows in seed
      expect(overview.workflowSuccessRatePercentage).toBe(100);
      expect(overview.avgProcessingLatencyMs).toBe(745);

      // AI Usage tokens and cost
      expect(overview.totalAiTokensUsed).toBeGreaterThan(0);
      expect(overview.totalAiCostUsd).toBeGreaterThan(0);

      // Questions, objections, and follow-up queue
      expect(overview.questionsDetected).toBeGreaterThan(0);
      expect(overview.objectionsIdentified).toBe(2); // charging_time, price_sensitivity
      expect(overview.followUpDraftsTotal).toBeGreaterThan(0);
    });

    it('handles empty organizations gracefully without division by zero or NaN', async () => {
      const emptyOrgId = 'org-empty-dealership';
      const overview = await service.getOverviewMetrics(emptyOrgId);

      expect(overview.conversationsProcessed).toBe(0);
      expect(overview.recordedConversions).toBe(0);
      expect(overview.totalRevenueInr).toBe(0);
      expect(overview.conversionRatePercentage).toBe(0);
      expect(overview.avgProcessingLatencyMs).toBe(0);
      expect(overview.workflowSuccessRatePercentage).toBe(0);
      expect(overview.totalAiTokensUsed).toBe(0);
      expect(overview.totalAiCostUsd).toBe(0);
      expect(overview.isLowDataState).toBe(true);
    });
  });

  describe('Filters: Store, Date Range, and Demo / Real Badging', () => {
    it('filters metrics by physical retail store location', async () => {
      const indiranagarOverview = await service.getOverviewMetrics(orgId, {
        storeId: 'store-indiranagar-01',
      });
      const koramangalaOverview = await service.getOverviewMetrics(orgId, {
        storeId: 'store-koramangala-02',
      });

      expect(indiranagarOverview.conversationsProcessed).toBe(4);
      expect(koramangalaOverview.conversationsProcessed).toBe(2);

      // Indiranagar has 2 purchases: conv-demo-001 (76500) + conv-demo-002 (6500) = 83000
      expect(indiranagarOverview.totalRevenueInr).toBe(83000);

      // Koramangala has 1 purchase: conv-demo-005 (132000)
      expect(koramangalaOverview.totalRevenueInr).toBe(132000);
    });

    it('filters demo vs real records cleanly', async () => {
      const realOnlyOverview = await service.getOverviewMetrics(orgId, {
        demoFilter: 'real_only',
      });
      expect(realOnlyOverview.conversationsProcessed).toBe(0);
      expect(realOnlyOverview.isLowDataState).toBe(true);

      const demoOnlyOverview = await service.getOverviewMetrics(orgId, {
        demoFilter: 'demo_only',
      });
      expect(demoOnlyOverview.conversationsProcessed).toBe(6);
    });
  });

  describe('Area B: Conversation Intelligence Workspace', () => {
    it('lists conversations with segment counts, intent bands, and returning visitor badges', async () => {
      const list = await service.getConversationList(orgId);

      expect(list).toHaveLength(6);
      const conv1 = list.find((c) => c.id === 'conv-demo-001');
      expect(conv1).toBeDefined();
      expect(conv1?.isDemo).toBe(true);
      expect(conv1?.segmentCount).toBe(4);
      expect(conv1?.intentScore).toBe(82);
      expect(conv1?.intentBand).toBe('high');
      expect(conv1?.externalCustomerId).toBe('CUST-IND-101');

      const conv2 = list.find((c) => c.id === 'conv-demo-002');
      expect(conv2?.isReturningVisitor).toBe(true);
    });

    it('returns single conversation details with evidence chips linking to transcript segments', async () => {
      const details = await service.getConversationDetails(orgId, 'conv-demo-003');

      expect(details).not.toBeNull();
      expect(details!.conversation.id).toBe('conv-demo-003');
      expect(details!.transcript.segments.length).toBeGreaterThan(0);

      // Objection evidence linking
      expect(details!.intelligence.objectionsIdentified).toHaveLength(1);
      const objection = details!.intelligence.objectionsIdentified[0]!;
      expect(objection.objectionType).toBe('charging_time');
      expect(objection.customerQuote).toContain('charging takes 4.5 hours');

      // Unresolved question from FloorCoach
      expect(details!.intelligence.unresolvedQuestions).toContain('Exact outer ring road fast charging points');

      // Missed conversion outcome recorded
      expect(details!.outcomes).toHaveLength(1);
      expect(details!.outcomes[0]!.type).toBe('missed_conversion');
      expect(details!.outcomes[0]!.reason).toContain('fast chargers');
    });
  });

  describe('Area C: Shopper Insights Aggregation', () => {
    it('aggregates intent band distribution and product interest counts', async () => {
      const shopperInsights = await service.getShopperInsights(orgId);

      expect(shopperInsights.totalShoppers).toBe(3);
      expect(shopperInsights.identifiedShoppers).toBe(2);
      expect(shopperInsights.anonymousShoppers).toBe(1);

      // Intent bands in demo seed: 3 high, 1 medium, 1 low, 1 abstained
      expect(shopperInsights.intentBandDistribution.high).toBe(3);
      expect(shopperInsights.intentBandDistribution.medium).toBe(1);
      expect(shopperInsights.intentBandDistribution.low).toBe(1);
      expect(shopperInsights.intentBandDistribution.abstained).toBe(1);

      // Top product interests
      expect(shopperInsights.topProductInterests.length).toBeGreaterThan(0);
      const prithviInterest = shopperInsights.topProductInterests.find((p) => p.productRef === 'vayu-commuter-110');
      expect(prithviInterest).toBeDefined();
      expect(prithviInterest?.count).toBe(2);
    });
  });

  describe('Area D: Agent Activity & AI Usage Tracking', () => {
    it('computes per-agent invocations, latency percentiles, and token accounting', async () => {
      const agentActivity = await service.getAgentActivity(orgId);

      expect(agentActivity.totalInvocations).toBeGreaterThan(0);
      expect(agentActivity.invocationsByAgent['floor_coach']).toBeDefined();
      expect(agentActivity.invocationsByAgent['signal_analyst']).toBeDefined();

      expect(agentActivity.invocationsByAgent['floor_coach']!.count).toBe(6);
      expect(agentActivity.invocationsByAgent['signal_analyst']!.count).toBe(6);

      expect(agentActivity.totalTokens).toBeGreaterThan(0);
      expect(agentActivity.totalCostUsd).toBeGreaterThan(0);
      expect(agentActivity.avgLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('Area E: Follow-Up Queue Metrics', () => {
    it('calculates queue status distribution and channel breakdown', async () => {
      const queueMetrics = await service.getFollowUpQueueMetrics(orgId);

      expect(queueMetrics.totalDrafts).toBe(6);
      expect(queueMetrics.byStatus.approved).toBe(3); // conv 1, 2, 5
      expect(queueMetrics.byStatus.rejected).toBe(1); // conv 4
      expect(queueMetrics.byStatus.draft).toBe(2);    // conv 3, 6

      expect(queueMetrics.byChannel['whatsapp']).toBe(1);
      expect(queueMetrics.byChannel['email']).toBe(2);
      expect(queueMetrics.byChannel['call_task']).toBe(1);
      expect(queueMetrics.approvalRatePercentage).toBe(75); // 3 approved out of 4 reviewed (3+1)
    });
  });

  describe('Area F: Store & Conversion Insights', () => {
    it('aggregates objections, missed reasons, and deal value with statistical honesty', async () => {
      const storeInsights = await service.getStoreConversionInsights(orgId);

      expect(storeInsights.frequentObjections.length).toBe(2);
      const chargingObj = storeInsights.frequentObjections.find((o) => o.type === 'charging_time');
      expect(chargingObj).toBeDefined();

      expect(storeInsights.missedConversionReasons.length).toBe(2);
      expect(storeInsights.totalConversionValueInr).toBe(76500 + 6500 + 132000);
      expect(storeInsights.averageDealValueInr).toBe(Math.round((76500 + 6500 + 132000) / 3));

      // With 6 conversations (>=5), warning is false
      expect(storeInsights.isLowDataWarning).toBe(false);

      // Low data threshold check
      const lowDataInsights = await service.getStoreConversionInsights(orgId, {
        storeId: 'store-koramangala-02', // only 2 conversations
      });
      expect(lowDataInsights.sampleSize).toBe(2);
      expect(lowDataInsights.isLowDataWarning).toBe(true);
    });
  });

  describe('CSV Export Format (RFC 4180)', () => {
    it('exports store events in valid CSV format with headers and quotes', async () => {
      const csv = await service.exportEventsCsv(orgId);

      expect(csv).toContain('id,org_id,store_id,type,source,shopper_id,conversation_id,created_at,metadata_summary');
      expect(csv).toContain('PURCHASE_RECORDED');
      expect(csv).toContain('MISSED_CONVERSION_RECORDED');

      const lines = csv.split('\r\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('REST API Routes Integration', () => {
    it('exposes all Areas A-F and CSV export via HTTP endpoints', async () => {
      const dummyEnv = loadEnv({
        NODE_ENV: 'test',
        APP_URL: 'http://localhost:5173',
        DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
      });

      const app = await buildApp({
        env: dummyEnv,
        repositories: repos,
        skipAutoSeed: true,
      });

      // 1. GET /api/analytics/overview
      const resOverview = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview?storeId=store-indiranagar-01',
      });
      expect(resOverview.statusCode).toBe(200);
      const jsonOverview = resOverview.json();
      expect(jsonOverview.success).toBe(true);
      expect(jsonOverview.data.conversationsProcessed).toBe(4);

      // 2. GET /api/analytics/conversations
      const resConvs = await app.inject({
        method: 'GET',
        url: '/api/analytics/conversations',
      });
      expect(resConvs.statusCode).toBe(200);
      expect(resConvs.json().data).toHaveLength(6);

      // 3. GET /api/analytics/conversations/:id
      const resDetail = await app.inject({
        method: 'GET',
        url: '/api/analytics/conversations/conv-demo-001',
      });
      expect(resDetail.statusCode).toBe(200);
      expect(resDetail.json().data.conversation.id).toBe('conv-demo-001');

      // 4. GET /api/analytics/shoppers
      const resShoppers = await app.inject({
        method: 'GET',
        url: '/api/analytics/shoppers',
      });
      expect(resShoppers.statusCode).toBe(200);
      expect(resShoppers.json().data.totalShoppers).toBe(3);

      // 5. GET /api/analytics/agents
      const resAgents = await app.inject({
        method: 'GET',
        url: '/api/analytics/agents',
      });
      expect(resAgents.statusCode).toBe(200);
      expect(resAgents.json().data.totalInvocations).toBeGreaterThan(0);

      // 6. GET /api/analytics/followups
      const resFollowups = await app.inject({
        method: 'GET',
        url: '/api/analytics/followups',
      });
      expect(resFollowups.statusCode).toBe(200);
      expect(resFollowups.json().data.totalDrafts).toBe(6);

      // 7. GET /api/analytics/store-insights
      const resStoreInsights = await app.inject({
        method: 'GET',
        url: '/api/analytics/store-insights',
      });
      expect(resStoreInsights.statusCode).toBe(200);
      expect(resStoreInsights.json().data.frequentObjections).toHaveLength(2);

      // 8. GET /api/analytics/export/csv
      const resCsv = await app.inject({
        method: 'GET',
        url: '/api/analytics/export/csv',
      });
      expect(resCsv.statusCode).toBe(200);
      expect(resCsv.headers['content-type']).toContain('text/csv');
      expect(resCsv.payload).toContain('PURCHASE_RECORDED');

      await app.close();
    });
  });
});
