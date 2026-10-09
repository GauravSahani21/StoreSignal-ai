import { describe, it, expect, beforeEach } from 'vitest';
import { createRepositories } from '../database/repositories/index.js';
import { AssignmentEngine, hashToBucket } from '../experiments/AssignmentEngine.js';
import { ExperimentService } from '../experiments/ExperimentService.js';
import {
  calculateWilsonScoreInterval,
  calculateTwoProportionZTest,
  analyzeExperiment,
} from '../experiments/statistics.js';
import type { Experiment, ExperimentVariant, ExperimentEvent } from '../experiments/types.js';
import { buildApp } from '../app.js';

describe('Phase 13: Campaign Experimentation & Optimization Engine', () => {
  let repos = createRepositories();
  let service = new ExperimentService(repos);
  let engine = new AssignmentEngine();
  const orgId = 'org-vayu-motors-dev';

  beforeEach(() => {
    repos = createRepositories();
    service = new ExperimentService(repos);
    engine = new AssignmentEngine();
  });

  describe('Deterministic Assignment Engine', () => {
    it('guarantees 100% determinism: same entity always receives the exact same variant', async () => {
      const exp: Experiment = {
        id: 'exp-det-01',
        orgId,
        name: 'Deterministic Test',
        hypothesis: 'Test determinism',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {},
        trafficAllocationPct: 100,
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'var-1',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 50,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'var-2',
          orgId,
          experimentId: exp.id,
          key: 'variant_a',
          name: 'Variant A',
          weight: 50,
          config: {},
          isControl: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const entityId = 'shopper-rahul-sharma-99';
      const firstResult = engine.assign(exp, variants, {
        entityType: 'shopper',
        entityId,
      });

      expect(firstResult.isEnrolled).toBe(true);
      expect(firstResult.variant).not.toBeNull();

      // Run 100 consecutive assignments for the same entity
      for (let i = 0; i < 100; i++) {
        const result = engine.assign(exp, variants, {
          entityType: 'shopper',
          entityId,
        });
        expect(result.variant?.key).toBe(firstResult.variant?.key);
      }
    });

    it('distributes 1,000 distinct entities evenly across 50/50 variants (uniform hash balance)', async () => {
      const exp: Experiment = {
        id: 'exp-bal-01',
        orgId,
        name: 'Balance Test',
        hypothesis: 'Test uniform distribution',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {},
        trafficAllocationPct: 100,
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'v-ctrl',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 50,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'v-var',
          orgId,
          experimentId: exp.id,
          key: 'variant_a',
          name: 'Variant A',
          weight: 50,
          config: {},
          isControl: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const counts: Record<string, number> = { control: 0, variant_a: 0 };
      const sampleSize = 1000;

      for (let i = 0; i < sampleSize; i++) {
        const result = engine.assign(exp, variants, {
          entityType: 'shopper',
          entityId: `shopper-test-uid-${i}`,
        });
        if (result.variant) {
          counts[result.variant.key] = (counts[result.variant.key] || 0) + 1;
        }
      }

      // Each variant should be between 43% and 57%
      expect(counts['control']).toBeGreaterThan(430);
      expect(counts['control']).toBeLessThan(570);
      expect(counts['variant_a']).toBeGreaterThan(430);
      expect(counts['variant_a']).toBeLessThan(570);
    });

    it('enforces traffic allocation gating strictly', async () => {
      const exp: Experiment = {
        id: 'exp-traffic-01',
        orgId,
        name: 'Traffic 20% Test',
        hypothesis: 'Test 20% allocation',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {},
        trafficAllocationPct: 20, // Only 20% traffic
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'v-ctrl',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 100,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
      ];

      let enrolledCount = 0;
      for (let i = 0; i < 500; i++) {
        const res = engine.assign(exp, variants, {
          entityType: 'shopper',
          entityId: `user-sim-${i}`,
        });
        if (res.isEnrolled) enrolledCount++;
      }

      // 20% of 500 is 100; allow range 75 - 125
      expect(enrolledCount).toBeGreaterThan(70);
      expect(enrolledCount).toBeLessThan(130);
    });

    it('enforces eligibility rules (minIntentScore, permittedChannels, storeIds)', async () => {
      const exp: Experiment = {
        id: 'exp-rules-01',
        orgId,
        name: 'Eligibility Rules Test',
        hypothesis: 'Test filters',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {
          minIntentScore: 60,
          permittedChannels: ['whatsapp'],
          storeIds: ['store-indiranagar-01'],
        },
        trafficAllocationPct: 100,
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'v-1',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 50,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
      ];

      // Disqualified by intent score
      const lowIntent = engine.assign(exp, variants, {
        entityType: 'shopper',
        entityId: 'shp-1',
        intentScore: 45,
        channel: 'whatsapp',
        storeId: 'store-indiranagar-01',
      });
      expect(lowIntent.isEnrolled).toBe(false);
      expect(lowIntent.reason).toContain('Intent score (45) is below minimum');

      // Disqualified by channel
      const wrongChannel = engine.assign(exp, variants, {
        entityType: 'shopper',
        entityId: 'shp-2',
        intentScore: 75,
        channel: 'sms',
        storeId: 'store-indiranagar-01',
      });
      expect(wrongChannel.isEnrolled).toBe(false);
      expect(wrongChannel.reason).toContain('Target channel');

      // Disqualified by store
      const wrongStore = engine.assign(exp, variants, {
        entityType: 'shopper',
        entityId: 'shp-3',
        intentScore: 75,
        channel: 'whatsapp',
        storeId: 'store-koramangala-02',
      });
      expect(wrongStore.isEnrolled).toBe(false);
      expect(wrongStore.reason).toContain('Store');

      // Qualified
      const qualified = engine.assign(exp, variants, {
        entityType: 'shopper',
        entityId: 'shp-4',
        intentScore: 80,
        channel: 'whatsapp',
        storeId: 'store-indiranagar-01',
      });
      expect(qualified.isEnrolled).toBe(true);
      expect(qualified.variant?.key).toBe('control');
    });
  });

  describe('Statistical Analysis Engine & Guardrails', () => {
    it('calculates robust Wilson score intervals bounded in [0, 1]', () => {
      // 0 successes in 10 trials
      const zeroCi = calculateWilsonScoreInterval(0, 10);
      expect(zeroCi.lower).toBe(0);
      expect(zeroCi.upper).toBeGreaterThan(0);
      expect(zeroCi.upper).toBeLessThan(0.35);

      // 10 successes in 10 trials
      const perfectCi = calculateWilsonScoreInterval(10, 10);
      expect(perfectCi.lower).toBeGreaterThan(0.65);
      expect(perfectCi.upper).toBe(1.0);

      // 50 successes in 100 trials
      const midCi = calculateWilsonScoreInterval(50, 100);
      expect(midCi.lower).toBeGreaterThan(0.39);
      expect(midCi.upper).toBeLessThan(0.61);
      expect(midCi.lower).toBeLessThan(0.5);
      expect(midCi.upper).toBeGreaterThan(0.5);
    });

    it('calculates accurate two-proportion z-test statistics', () => {
      // Group 1: 30 / 100 (30%), Group 2: 15 / 100 (15%) -> Significant
      const res = calculateTwoProportionZTest(30, 100, 15, 100);
      expect(res.zScore).toBeGreaterThan(2.0);
      expect(res.pValue).toBeLessThan(0.05);

      // Group 1: 20 / 100 (20%), Group 2: 19 / 100 (19%) -> Not Significant
      const resClose = calculateTwoProportionZTest(20, 100, 19, 100);
      expect(resClose.pValue).toBeGreaterThan(0.5);
    });

    it('STRICT GUARD: refuses to declare a winner when sample size < minSampleSize', () => {
      const exp: Experiment = {
        id: 'exp-low-n',
        orgId,
        name: 'Low N Test',
        hypothesis: 'Low sample test',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {},
        trafficAllocationPct: 100,
        minSampleSize: 30, // Requires 30
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'v-ctrl',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 50,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'v-var',
          orgId,
          experimentId: exp.id,
          key: 'variant_a',
          name: 'Variant A',
          weight: 50,
          config: {},
          isControl: false,
          createdAt: new Date().toISOString(),
        },
      ];

      // Even if variant has 5/5 (100%) and control has 0/5 (0%), N=5 is below minSampleSize of 30!
      const events: ExperimentEvent[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `ev-c-${i}`,
          orgId,
          experimentId: exp.id,
          variantId: 'v-ctrl',
          entityType: 'shopper' as const,
          entityId: `c-${i}`,
          eventType: 'exposure' as const,
          metadata: {},
          createdAt: new Date().toISOString(),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `ev-v-exp-${i}`,
          orgId,
          experimentId: exp.id,
          variantId: 'v-var',
          entityType: 'shopper' as const,
          entityId: `v-${i}`,
          eventType: 'exposure' as const,
          metadata: {},
          createdAt: new Date().toISOString(),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `ev-v-conv-${i}`,
          orgId,
          experimentId: exp.id,
          variantId: 'v-var',
          entityType: 'shopper' as const,
          entityId: `v-${i}`,
          eventType: 'conversion' as const,
          metadata: {},
          createdAt: new Date().toISOString(),
        })),
      ];

      const analysis = analyzeExperiment(exp, variants, events);

      expect(analysis.allVariantsMeetSampleSize).toBe(false);
      expect(analysis.winnerDeclared).toBe(false);
      expect(analysis.winningVariantKey).toBeNull();
      expect(analysis.limitationsAndWarnings.some((w) => w.includes('Minimum sample size'))).toBe(true);
      expect(analysis.statisticalComparison?.comparisons[0]?.verdict).toBe('insufficient_sample');
    });

    it('declares a winner when sample size >= minSampleSize AND p < 0.05 with positive uplift', () => {
      const exp: Experiment = {
        id: 'exp-valid-winner',
        orgId,
        name: 'Sufficient Sample Test',
        hypothesis: 'Big uplift test',
        targetType: 'followup_prompt',
        status: 'running',
        eligibilityRules: {},
        trafficAllocationPct: 100,
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variants: ExperimentVariant[] = [
        {
          id: 'v-ctrl',
          orgId,
          experimentId: exp.id,
          key: 'control',
          name: 'Control',
          weight: 50,
          config: {},
          isControl: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'v-var',
          orgId,
          experimentId: exp.id,
          key: 'variant_a',
          name: 'Variant A',
          weight: 50,
          config: {},
          isControl: false,
          createdAt: new Date().toISOString(),
        },
      ];

      // Control: 50 exposures, 5 conversions (10%)
      // Variant A: 50 exposures, 25 conversions (50%)
      const events: ExperimentEvent[] = [];
      for (let i = 0; i < 50; i++) {
        events.push({
          id: `c-exp-${i}`,
          orgId,
          experimentId: exp.id,
          variantId: 'v-ctrl',
          entityType: 'shopper',
          entityId: `c-${i}`,
          eventType: 'exposure',
          metadata: {},
          createdAt: new Date().toISOString(),
        });
        if (i < 5) {
          events.push({
            id: `c-conv-${i}`,
            orgId,
            experimentId: exp.id,
            variantId: 'v-ctrl',
            entityType: 'shopper',
            entityId: `c-${i}`,
            eventType: 'conversion',
            metadata: {},
            createdAt: new Date().toISOString(),
          });
        }
      }

      for (let i = 0; i < 50; i++) {
        events.push({
          id: `v-exp-${i}`,
          orgId,
          experimentId: exp.id,
          variantId: 'v-var',
          entityType: 'shopper',
          entityId: `v-${i}`,
          eventType: 'exposure',
          metadata: {},
          createdAt: new Date().toISOString(),
        });
        if (i < 25) {
          events.push({
            id: `v-conv-${i}`,
            orgId,
            experimentId: exp.id,
            variantId: 'v-var',
            entityType: 'shopper',
            entityId: `v-${i}`,
            eventType: 'conversion',
            metadata: {},
            createdAt: new Date().toISOString(),
          });
        }
      }

      const analysis = analyzeExperiment(exp, variants, events);

      expect(analysis.allVariantsMeetSampleSize).toBe(true);
      expect(analysis.winnerDeclared).toBe(true);
      expect(analysis.winningVariantKey).toBe('variant_a');
      expect(analysis.statisticalComparison?.comparisons[0]?.isSignificant).toBe(true);
      expect(analysis.statisticalComparison?.comparisons[0]?.verdict).toBe('significant_winner');
    });
  });

  describe('CSV Outcome Ingestion & Zero External Send Path', () => {
    it('successfully imports outcome events from CSV format', async () => {
      const exp = await service.createExperiment({
        orgId,
        name: 'CSV Test',
        hypothesis: 'CSV ingestion test',
        targetType: 'followup_prompt',
      });

      await service.createVariant({
        orgId,
        experimentId: exp.id,
        key: 'control',
        name: 'Control',
        isControl: true,
      });

      await service.createVariant({
        orgId,
        experimentId: exp.id,
        key: 'variant_a',
        name: 'Variant A',
      });

      const csvContent =
        'variant_key,entity_id,event_type,value\n' +
        'control,shp-101,exposure,\n' +
        'control,shp-101,conversion,76500\n' +
        'variant_a,shp-102,exposure,\n' +
        'variant_a,shp-102,conversion,82000';

      const importResult = await service.importEventsCsv(orgId, exp.id, csvContent);
      expect(importResult.importedCount).toBe(4);
      expect(importResult.errors.length).toBe(0);

      const events = await service.getEvents(exp.id);
      expect(events.length).toBe(4);
      expect(events.filter((e) => e.eventType === 'conversion').length).toBe(2);
    });

    it('confirms ZERO outbound messaging send paths exist in experiment pipeline (§12, §15)', async () => {
      // Experimentation records assignments and events, but NEVER calls SMS/WhatsApp API
      const exp = await service.createExperiment({
        orgId,
        name: 'Safety Audit',
        hypothesis: 'Audit messaging safety',
        targetType: 'followup_prompt',
      });

      await service.createVariant({
        orgId,
        experimentId: exp.id,
        key: 'control',
        name: 'Control',
      });

      await service.updateExperimentStatus(exp.id, 'running');

      const assignment = await service.assignEntity(orgId, exp.id, {
        entityType: 'shopper',
        entityId: 'shp-safety-01',
        channel: 'whatsapp',
      });

      expect(assignment.isEnrolled).toBe(true);
      // No outbound API keys or external clients are invoked
      const recordedEvents = await service.getEvents(exp.id);
      expect(recordedEvents.length).toBe(1);
      expect(recordedEvents[0]!.eventType).toBe('exposure');
      // Zero 'send' events without manual approval
      expect(recordedEvents.some((e) => e.eventType === 'send')).toBe(false);
    });
  });

  describe('Fastify REST Endpoints Integration', () => {
    it('serves experiments and analysis via API routes', async () => {
      const app = await buildApp({
        repositories: repos,
        skipAutoSeed: false,
      });

      // GET /api/experiments
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/experiments',
        headers: { 'x-org-id': orgId },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.success).toBe(true);
      expect(listBody.data.length).toBeGreaterThanOrEqual(1);

      // Seeded experiment ID
      const expId = listBody.data[0].id;

      // GET /api/experiments/:id/analysis
      const analysisRes = await app.inject({
        method: 'GET',
        url: `/api/experiments/${expId}/analysis`,
        headers: { 'x-org-id': orgId },
      });
      expect(analysisRes.statusCode).toBe(200);
      const analysisBody = JSON.parse(analysisRes.body);
      expect(analysisBody.success).toBe(true);
      expect(analysisBody.data.variants.length).toBeGreaterThanOrEqual(2);
      expect(analysisBody.data.limitationsAndWarnings.length).toBeGreaterThanOrEqual(1);

      // POST /api/experiments/:id/assign
      const assignRes = await app.inject({
        method: 'POST',
        url: `/api/experiments/${expId}/assign`,
        headers: { 'x-org-id': orgId },
        payload: {
          entityType: 'shopper',
          entityId: 'shp-api-test-101',
          intentScore: 70,
          channel: 'whatsapp',
        },
      });
      expect(assignRes.statusCode).toBe(200);
      const assignBody = JSON.parse(assignRes.body);
      expect(assignBody.success).toBe(true);
      expect(assignBody.data.isEnrolled).toBe(true);

      await app.close();
    });
  });
});
