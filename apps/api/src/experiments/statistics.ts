import type {
  ConfidenceInterval,
  Experiment,
  ExperimentAnalysis,
  ExperimentEvent,
  ExperimentVariant,
  VariantComparison,
  VariantMetrics,
} from './types.js';

/**
 * Standard normal error function approximation (erf)
 * Used to compute two-tailed p-values without external heavy libraries.
 */
function erf(x: number): number {
  // Abramowitz and Stegun formula 7.1.26 approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Cumulative Distribution Function (CDF) for standard normal distribution N(0, 1)
 */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Computes Wilson Score Interval for binomial proportion.
 * Provides robust coverage even for small n or proportions close to 0 or 1.
 * Default z = 1.95996 for 95% two-sided confidence.
 */
export function calculateWilsonScoreInterval(
  successes: number,
  trials: number,
  z: number = 1.95996
): ConfidenceInterval {
  if (trials <= 0) {
    return { lower: 0, upper: 0, confidenceLevel: 0.95 };
  }

  const p = successes / trials;
  const zSquared = z * z;
  const denominator = 1 + zSquared / trials;
  const centerAdjusted = (p + zSquared / (2 * trials)) / denominator;
  const margin =
    (z / denominator) * Math.sqrt((p * (1 - p)) / trials + zSquared / (4 * trials * trials));

  const lower = Math.max(0, Math.min(1, centerAdjusted - margin));
  const upper = Math.max(0, Math.min(1, centerAdjusted + margin));

  return {
    lower: Math.round(lower * 10000) / 10000,
    upper: Math.round(upper * 10000) / 10000,
    confidenceLevel: 0.95,
  };
}

/**
 * Two-proportion Z-test comparing variant (group 1) to control (group 2).
 */
export function calculateTwoProportionZTest(
  successes1: number,
  trials1: number,
  successes2: number,
  trials2: number
): { zScore: number; pValue: number } {
  if (trials1 <= 0 || trials2 <= 0) {
    return { zScore: 0, pValue: 1.0 };
  }

  const p1 = successes1 / trials1;
  const p2 = successes2 / trials2;

  // Pooled proportion under null hypothesis H0: p1 = p2
  const pooledP = (successes1 + successes2) / (trials1 + trials2);

  if (pooledP <= 0 || pooledP >= 1) {
    return { zScore: 0, pValue: 1.0 };
  }

  const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1 / trials1 + 1 / trials2));

  if (standardError === 0) {
    return { zScore: 0, pValue: 1.0 };
  }

  const zScore = (p1 - p2) / standardError;
  // Two-tailed p-value
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  return {
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
  };
}

/**
 * Comprehensive Experiment Analysis with Honest Statistical Guardrails (§12, §15)
 */
export function analyzeExperiment(
  experiment: Experiment,
  variants: ExperimentVariant[],
  events: ExperimentEvent[]
): ExperimentAnalysis {
  const minSampleSize = experiment.minSampleSize || 30;
  const warnings: string[] = [];

  // Group events by variant ID
  const eventsByVariant = new Map<string, ExperimentEvent[]>();
  for (const v of variants) {
    eventsByVariant.set(v.id, []);
  }

  for (const e of events) {
    if (eventsByVariant.has(e.variantId)) {
      eventsByVariant.get(e.variantId)!.push(e);
    }
  }

  // Calculate metrics per variant
  const variantMetricsList: VariantMetrics[] = variants.map((variant) => {
    const vEvents = eventsByVariant.get(variant.id) || [];
    let exposures = 0;
    let sends = 0;
    let responses = 0;
    let conversions = 0;
    let revenue = 0;
    let cost = 0;

    for (const ev of vEvents) {
      if (ev.eventType === 'exposure') exposures += 1;
      else if (ev.eventType === 'send') sends += 1;
      else if (ev.eventType === 'response') responses += 1;
      else if (ev.eventType === 'conversion') {
        conversions += 1;
        if (ev.value && ev.value > 0) revenue += ev.value;
      } else if (ev.eventType === 'cost_recorded') {
        if (ev.value && ev.value > 0) cost += ev.value;
      }
    }

    // Default to at least sends count if exposures wasn't explicitly tracked
    const effectiveDenominator = Math.max(exposures, sends);
    const conversionRate = effectiveDenominator > 0 ? conversions / effectiveDenominator : 0;
    const ci = calculateWilsonScoreInterval(conversions, effectiveDenominator);

    return {
      variantId: variant.id,
      key: variant.key,
      name: variant.name,
      isControl: variant.isControl,
      weight: variant.weight,
      exposures: effectiveDenominator,
      sends,
      responses,
      conversions,
      conversionRate: Math.round(conversionRate * 10000) / 10000,
      conversionConfidenceInterval: ci,
      revenue,
      cost,
      sampleSizeMet: effectiveDenominator >= minSampleSize,
    };
  });

  const totalExposures = variantMetricsList.reduce((acc, v) => acc + v.exposures, 0);
  const totalConversions = variantMetricsList.reduce((acc, v) => acc + v.conversions, 0);
  const overallConversionRate =
    totalExposures > 0 ? Math.round((totalConversions / totalExposures) * 10000) / 10000 : 0;

  const allVariantsMeetSampleSize =
    variantMetricsList.length > 0 && variantMetricsList.every((v) => v.sampleSizeMet);

  // Check sample size warnings
  const lowSampleVariants = variantMetricsList.filter((v) => !v.sampleSizeMet);
  if (lowSampleVariants.length > 0) {
    warnings.push(
      `Statistical limitation: ${lowSampleVariants.length} variant(s) have not reached the required minimum sample size of ${minSampleSize} exposures (N = [${lowSampleVariants.map((v) => `${v.key}:${v.exposures}`).join(', ')}]). Results are exploratory and underpowered.`
    );
  }

  // Statistical comparisons against control
  const controlVariant =
    variantMetricsList.find((v) => v.isControl) || variantMetricsList[0];
  let statisticalComparison: { controlVariantKey: string; comparisons: VariantComparison[] } | null = null;
  let winnerDeclared = false;
  let winningVariantKey: string | null = null;

  if (controlVariant && variantMetricsList.length > 1) {
    const comparisons: VariantComparison[] = [];

    for (const v of variantMetricsList) {
      if (v.variantId === controlVariant.variantId) continue;

      const diff = Math.round((v.conversionRate - controlVariant.conversionRate) * 10000) / 10000;
      const relativeUplift =
        controlVariant.conversionRate > 0
          ? Math.round(((v.conversionRate - controlVariant.conversionRate) / controlVariant.conversionRate) * 10000) / 100
          : 0;

      const zTest = calculateTwoProportionZTest(
        v.conversions,
        v.exposures,
        controlVariant.conversions,
        controlVariant.exposures
      );

      const bothMeetSample = v.sampleSizeMet && controlVariant.sampleSizeMet;
      const isSignificant = bothMeetSample && zTest.pValue < 0.05;

      let verdict: VariantComparison['verdict'] = 'insufficient_sample';
      if (!bothMeetSample) {
        verdict = 'insufficient_sample';
      } else if (isSignificant && diff > 0) {
        verdict = 'significant_winner';
      } else if (isSignificant && diff < 0) {
        verdict = 'significant_underperformer';
      } else {
        verdict = 'no_significant_difference';
      }

      comparisons.push({
        variantKey: v.key,
        controlKey: controlVariant.key,
        conversionRateDiff: diff,
        relativeUpliftPct: relativeUplift,
        zScore: zTest.zScore,
        pValue: zTest.pValue,
        isSignificant,
        verdict,
      });

      // Strict Winner Declaration Check (§12, §15)
      if (isSignificant && diff > 0 && bothMeetSample) {
        // Also verify Wilson intervals don't entirely overlap
        if (v.conversionConfidenceInterval.lower > controlVariant.conversionConfidenceInterval.lower) {
          winnerDeclared = true;
          winningVariantKey = v.key;
        }
      }
    }

    statisticalComparison = {
      controlVariantKey: controlVariant.key,
      comparisons,
    };
  }

  // Add mandatory guardrail warnings
  if (!winnerDeclared) {
    if (lowSampleVariants.length > 0) {
      warnings.push(
        'Winner declaration blocked: Minimum sample size threshold not satisfied across evaluation cohorts. Premature winner declarations are prohibited to prevent statistical false positives.'
      );
    } else {
      warnings.push(
        'No statistically significant difference detected between variants (p >= 0.05). Null hypothesis cannot be rejected.'
      );
    }
  }

  warnings.push(
    'Causality note: Observational correlation does not confirm physical customer causality. Physical retail conversions can be influenced by external showroom foot-traffic and inventory availability.'
  );

  return {
    experiment,
    variants: variantMetricsList,
    totalExposures,
    totalConversions,
    overallConversionRate,
    minSampleSize,
    allVariantsMeetSampleSize,
    statisticalComparison,
    winnerDeclared,
    winningVariantKey,
    limitationsAndWarnings: warnings,
  };
}
