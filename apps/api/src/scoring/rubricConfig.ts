export const RUBRIC_VERSION = '1.0.0';

export interface RubricSignalDefinition {
  signalId: string;
  meaning: string;
  weight: number;
}

export interface RubricConfig {
  version: string;
  baseScore: number;
  minCustomerWordsForEvaluation: number;
  minCustomerSegmentsForEvaluation: number;
  signals: Record<string, RubricSignalDefinition>;
}

export const DEFAULT_RUBRIC_CONFIG: RubricConfig = {
  version: RUBRIC_VERSION,
  baseScore: 20,
  minCustomerWordsForEvaluation: 6,
  minCustomerSegmentsForEvaluation: 1,
  signals: {
    asked_price_or_offers: {
      signalId: 'asked_price_or_offers',
      meaning: 'Asked about price, discounts, or offers',
      weight: 12,
    },
    asked_financing: {
      signalId: 'asked_financing',
      meaning: 'Asked about EMI, financing, or payment options',
      weight: 15,
    },
    asked_availability_delivery: {
      signalId: 'asked_availability_delivery',
      meaning: 'Asked about stock availability, color options, or delivery timelines',
      weight: 15,
    },
    requested_trial_or_test_ride: {
      signalId: 'requested_trial_or_test_ride',
      meaning: 'Requested or accepted a showroom trial or test ride',
      weight: 20,
    },
    stated_timeline_near_term: {
      signalId: 'stated_timeline_near_term',
      meaning: 'Explicitly stated a near-term purchase timeline (e.g. this week/month)',
      weight: 20,
    },
    stated_budget_overlap: {
      signalId: 'stated_budget_overlap',
      meaning: 'Explicitly stated a budget that overlaps a product price range',
      weight: 10,
    },
    compared_specific_competitor: {
      signalId: 'compared_specific_competitor',
      meaning: 'Compared model with a specific named competitor brand/model',
      weight: 5,
    },
    returning_visit: {
      signalId: 'returning_visit',
      meaning: 'Shopper history or statement indicates a returning showroom visit',
      weight: 8,
    },
    asked_for_followup: {
      signalId: 'asked_for_followup',
      meaning: 'Customer asked to be contacted or sent brochure/pricing info',
      weight: 15,
    },
    stated_browsing_only: {
      signalId: 'stated_browsing_only',
      meaning: 'Customer explicitly stated they are only browsing or looking around',
      weight: -20,
    },
    stated_disinterest: {
      signalId: 'stated_disinterest',
      meaning: 'Customer explicitly declined or indicated clear disinterest',
      weight: -30,
    },
    unresolved_blocking_objection: {
      signalId: 'unresolved_blocking_objection',
      meaning: 'An objection was raised and left unresolved at interaction end',
      weight: -10,
    },
  },
};
