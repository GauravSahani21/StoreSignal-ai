import type { Repositories } from '../database/repositories/index.js';
import { AssignmentEngine, type AssignmentContext, type AssignmentResult } from './AssignmentEngine.js';
import { analyzeExperiment } from './statistics.js';
import type {
  Experiment,
  ExperimentAnalysis,
  ExperimentEvent,
  ExperimentStatus,
  ExperimentVariant,
} from './types.js';

export class ExperimentService {
  private repositories: Repositories;
  private assignmentEngine: AssignmentEngine;

  constructor(repositories: Repositories) {
    this.repositories = repositories;
    this.assignmentEngine = new AssignmentEngine();
  }

  async createExperiment(params: {
    orgId: string;
    name: string;
    hypothesis: string;
    targetType: 'followup_prompt' | 'rubric_config' | 'channel_strategy';
    eligibilityRules?: Experiment['eligibilityRules'];
    trafficAllocationPct?: number;
    minSampleSize?: number;
  }): Promise<Experiment> {
    return this.repositories.experiments.createExperiment(params);
  }

  async getExperiment(id: string): Promise<{
    experiment: Experiment;
    variants: ExperimentVariant[];
  } | null> {
    const experiment = await this.repositories.experiments.getExperimentById(id);
    if (!experiment) return null;
    const variants = await this.repositories.experiments.getVariantsByExperimentId(id);
    return { experiment, variants };
  }

  async listExperiments(orgId: string, status?: ExperimentStatus): Promise<Experiment[]> {
    return this.repositories.experiments.listExperiments(orgId, status);
  }

  async updateExperimentStatus(id: string, status: ExperimentStatus): Promise<Experiment | null> {
    return this.repositories.experiments.updateExperiment(id, { status });
  }

  async createVariant(params: {
    orgId: string;
    experimentId: string;
    key: string;
    name: string;
    description?: string;
    weight?: number;
    config?: Record<string, unknown>;
    isControl?: boolean;
  }): Promise<ExperimentVariant> {
    return this.repositories.experiments.createVariant(params);
  }

  async getVariants(experimentId: string): Promise<ExperimentVariant[]> {
    return this.repositories.experiments.getVariantsByExperimentId(experimentId);
  }

  /**
   * Deterministically assigns an entity to an experiment variant.
   * If already assigned, retrieves the existing assignment.
   */
  async assignEntity(
    orgId: string,
    experimentId: string,
    context: AssignmentContext
  ): Promise<AssignmentResult> {
    const experiment = await this.repositories.experiments.getExperimentById(experimentId);
    if (!experiment) {
      return {
        isEnrolled: false,
        experimentId,
        variant: null,
        reason: `Experiment "${experimentId}" not found.`,
      };
    }

    const variants = await this.repositories.experiments.getVariantsByExperimentId(experimentId);
    if (variants.length === 0) {
      return {
        isEnrolled: false,
        experimentId,
        variant: null,
        reason: 'No variants found for experiment.',
      };
    }

    // Check existing assignment
    const existing = await this.repositories.experiments.getAssignment(
      orgId,
      experimentId,
      context.entityType,
      context.entityId
    );
    if (existing) {
      const variant = variants.find((v) => v.id === existing.variantId) || null;
      return {
        isEnrolled: true,
        experimentId,
        variant,
      };
    }

    // Evaluate assignment through deterministic engine
    const assignment = this.assignmentEngine.assign(experiment, variants, context);
    if (assignment.isEnrolled && assignment.variant) {
      await this.repositories.experiments.saveAssignment({
        orgId,
        experimentId,
        variantId: assignment.variant.id,
        variantKey: assignment.variant.key,
        entityType: context.entityType,
        entityId: context.entityId,
      });

      // Record exposure event automatically
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId,
        variantId: assignment.variant.id,
        entityType: context.entityType,
        entityId: context.entityId,
        eventType: 'exposure',
        metadata: {
          channel: context.channel,
          intentScore: context.intentScore,
        },
      });
    }

    return assignment;
  }

  async recordEvent(params: {
    orgId: string;
    experimentId: string;
    variantId: string;
    entityType: 'shopper' | 'conversation';
    entityId: string;
    eventType: 'exposure' | 'send' | 'response' | 'conversion' | 'cost_recorded';
    value?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ExperimentEvent> {
    return this.repositories.experiments.recordEvent(params);
  }

  async getEvents(experimentId: string): Promise<ExperimentEvent[]> {
    return this.repositories.experiments.getEventsByExperimentId(experimentId);
  }

  async importEventsCsv(
    orgId: string,
    experimentId: string,
    csvContent: string
  ): Promise<{ importedCount: number; errors: string[] }> {
    return this.repositories.experiments.importEventsCsv(orgId, experimentId, csvContent);
  }

  async analyzeExperiment(experimentId: string): Promise<ExperimentAnalysis | null> {
    const experiment = await this.repositories.experiments.getExperimentById(experimentId);
    if (!experiment) return null;

    const variants = await this.repositories.experiments.getVariantsByExperimentId(experimentId);
    const events = await this.repositories.experiments.getEventsByExperimentId(experimentId);

    return analyzeExperiment(experiment, variants, events);
  }

  /**
   * Seeds demo experiments with realistic showroom outcomes for Indiranagar & Koramangala
   */
  async seedDemoExperiments(orgId: string): Promise<void> {
    const existing = await this.repositories.experiments.listExperiments(orgId);
    if (existing.length > 0) return;

    // Experiment 1: High-Intent WhatsApp Outreach Prompt Tone
    const exp1 = await this.repositories.experiments.createExperiment({
      orgId,
      name: 'Festive Financing Hook vs Technical Spec Focus',
      hypothesis:
        'Personalizing follow-up drafts with festive zero-down EMI options increases test-ride return conversions compared to purely technical vehicle spec recaps.',
      targetType: 'followup_prompt',
      trafficAllocationPct: 100,
      minSampleSize: 30,
      eligibilityRules: {
        minIntentScore: 50,
        permittedChannels: ['whatsapp', 'email'],
      },
    });

    await this.repositories.experiments.updateExperiment(exp1.id, { status: 'running' });

    const c1 = await this.repositories.experiments.createVariant({
      orgId,
      experimentId: exp1.id,
      key: 'control',
      name: 'Technical Spec Focus (Control)',
      description: 'Standard prompt emphasizing mileage (68 kmpl) and 5-year warranty.',
      weight: 50,
      isControl: true,
      config: {
        promptTone: 'informative_technical',
        primaryHook: 'mileage_and_warranty',
      },
    });

    const v1 = await this.repositories.experiments.createVariant({
      orgId,
      experimentId: exp1.id,
      key: 'variant_a',
      name: 'Festive Financing Hook (Challenger)',
      description: 'Challenger prompt emphasizing ₹3,850 EMI and zero down-payment festive schemes.',
      weight: 50,
      isControl: false,
      config: {
        promptTone: 'action_oriented_financial',
        primaryHook: 'zero_down_emi',
      },
    });

    // Seed realistic observations for exp1 (N = 45 control, N = 48 variant_a)
    // Control: 45 exposures, 9 conversions (20%)
    for (let i = 0; i < 45; i++) {
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp1.id,
        variantId: c1.id,
        entityType: 'shopper',
        entityId: `shp-ctrl-${i}`,
        eventType: 'exposure',
      });
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp1.id,
        variantId: c1.id,
        entityType: 'shopper',
        entityId: `shp-ctrl-${i}`,
        eventType: 'send',
      });
      if (i < 9) {
        await this.repositories.experiments.recordEvent({
          orgId,
          experimentId: exp1.id,
          variantId: c1.id,
          entityType: 'shopper',
          entityId: `shp-ctrl-${i}`,
          eventType: 'conversion',
          value: 76500,
        });
      }
    }

    // Variant A: 48 exposures, 18 conversions (37.5%)
    for (let i = 0; i < 48; i++) {
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp1.id,
        variantId: v1.id,
        entityType: 'shopper',
        entityId: `shp-var-${i}`,
        eventType: 'exposure',
      });
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp1.id,
        variantId: v1.id,
        entityType: 'shopper',
        entityId: `shp-var-${i}`,
        eventType: 'send',
      });
      if (i < 18) {
        await this.repositories.experiments.recordEvent({
          orgId,
          experimentId: exp1.id,
          variantId: v1.id,
          entityType: 'shopper',
          entityId: `shp-var-${i}`,
          eventType: 'conversion',
          value: 82000,
        });
      }
    }

    // Experiment 2: Exploratory Underpowered Pilot (Low sample size N=12 to test warnings)
    const exp2 = await this.repositories.experiments.createExperiment({
      orgId,
      name: 'Weekend Priority Test-Ride Call Task Scheduling',
      hypothesis:
        'Generating morning call tasks for floor advisors yields higher appointment confirmation than afternoon tasks.',
      targetType: 'channel_strategy',
      trafficAllocationPct: 100,
      minSampleSize: 40,
      eligibilityRules: {
        minIntentScore: 65,
      },
    });

    await this.repositories.experiments.updateExperiment(exp2.id, { status: 'running' });

    const c2 = await this.repositories.experiments.createVariant({
      orgId,
      experimentId: exp2.id,
      key: 'control',
      name: 'Afternoon Call Window (Control)',
      weight: 50,
      isControl: true,
      config: { callWindow: '14:00-17:00' },
    });

    const v2 = await this.repositories.experiments.createVariant({
      orgId,
      experimentId: exp2.id,
      key: 'variant_morning',
      name: 'Morning Priority Window',
      weight: 50,
      isControl: false,
      config: { callWindow: '10:00-12:00' },
    });

    // Only 8 exposures in control, 7 in morning (below minSampleSize of 40)
    for (let i = 0; i < 8; i++) {
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp2.id,
        variantId: c2.id,
        entityType: 'conversation',
        entityId: `conv-call-ctrl-${i}`,
        eventType: 'exposure',
      });
      if (i < 2) {
        await this.repositories.experiments.recordEvent({
          orgId,
          experimentId: exp2.id,
          variantId: c2.id,
          entityType: 'conversation',
          entityId: `conv-call-ctrl-${i}`,
          eventType: 'conversion',
          value: 120000,
        });
      }
    }

    for (let i = 0; i < 7; i++) {
      await this.repositories.experiments.recordEvent({
        orgId,
        experimentId: exp2.id,
        variantId: v2.id,
        entityType: 'conversation',
        entityId: `conv-call-mrn-${i}`,
        eventType: 'exposure',
      });
      if (i < 3) {
        await this.repositories.experiments.recordEvent({
          orgId,
          experimentId: exp2.id,
          variantId: v2.id,
          entityType: 'conversation',
          entityId: `conv-call-mrn-${i}`,
          eventType: 'conversion',
          value: 132000,
        });
      }
    }
  }
}
