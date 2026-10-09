import crypto from 'node:crypto';
import type {
  Experiment,
  ExperimentEntityType,
  ExperimentVariant,
} from './types.js';

export interface AssignmentContext {
  entityType: ExperimentEntityType;
  entityId: string;
  intentScore?: number | null;
  channel?: string;
  storeId?: string;
}

export interface AssignmentResult {
  isEnrolled: boolean;
  experimentId: string;
  variant: ExperimentVariant | null;
  reason?: string;
}

/**
 * Generates a deterministic integer between 0 and 99 from a string seed.
 * Uniformly distributed and completely deterministic.
 */
export function hashToBucket(seed: string): number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  // Take first 8 chars (32 bits) as an integer
  const num = parseInt(hash.substring(0, 8), 16);
  return num % 100;
}

export class AssignmentEngine {
  /**
   * Deterministically assigns an entity to an experiment variant.
   */
  assign(
    experiment: Experiment,
    variants: ExperimentVariant[],
    context: AssignmentContext
  ): AssignmentResult {
    // 1. Experiment must be running
    if (experiment.status !== 'running') {
      return {
        isEnrolled: false,
        experimentId: experiment.id,
        variant: null,
        reason: `Experiment status is '${experiment.status}', not 'running'.`,
      };
    }

    // 2. Validate Variants exist
    if (variants.length === 0) {
      return {
        isEnrolled: false,
        experimentId: experiment.id,
        variant: null,
        reason: 'No variants configured for this experiment.',
      };
    }

    // 3. Eligibility rules verification
    const rules = experiment.eligibilityRules;
    if (rules.minIntentScore !== undefined && context.intentScore !== undefined && context.intentScore !== null) {
      if (context.intentScore < rules.minIntentScore) {
        return {
          isEnrolled: false,
          experimentId: experiment.id,
          variant: null,
          reason: `Intent score (${context.intentScore}) is below minimum requirement of ${rules.minIntentScore}.`,
        };
      }
    }

    if (rules.permittedChannels && rules.permittedChannels.length > 0 && context.channel) {
      if (!rules.permittedChannels.includes(context.channel)) {
        return {
          isEnrolled: false,
          experimentId: experiment.id,
          variant: null,
          reason: `Target channel '${context.channel}' not in permitted channels list.`,
        };
      }
    }

    if (rules.storeIds && rules.storeIds.length > 0 && context.storeId) {
      if (!rules.storeIds.includes(context.storeId)) {
        return {
          isEnrolled: false,
          experimentId: experiment.id,
          variant: null,
          reason: `Store '${context.storeId}' is not targeted by this experiment.`,
        };
      }
    }

    // 4. Traffic allocation check (seeded hash)
    const trafficSeed = `traffic:${experiment.id}:${context.entityId}`;
    const trafficBucket = hashToBucket(trafficSeed);
    if (trafficBucket >= experiment.trafficAllocationPct) {
      return {
        isEnrolled: false,
        experimentId: experiment.id,
        variant: null,
        reason: `Entity fell outside traffic allocation (${trafficBucket} >= ${experiment.trafficAllocationPct}%).`,
      };
    }

    // 5. Deterministic variant split
    const sortedVariants = [...variants].sort((a, b) => a.key.localeCompare(b.key));
    const totalWeight = sortedVariants.reduce((sum, v) => sum + Math.max(1, v.weight), 0);

    const variantSeed = `variant:${experiment.id}:${context.entityId}`;
    const variantBucket = hashToBucket(variantSeed);
    // Scale 0-99 bucket into totalWeight scale
    const targetThreshold = (variantBucket / 100) * totalWeight;

    let cumulative = 0;
    let chosenVariant = sortedVariants[0]!;

    for (const v of sortedVariants) {
      cumulative += Math.max(1, v.weight);
      if (targetThreshold < cumulative) {
        chosenVariant = v;
        break;
      }
    }

    return {
      isEnrolled: true,
      experimentId: experiment.id,
      variant: chosenVariant,
    };
  }
}
