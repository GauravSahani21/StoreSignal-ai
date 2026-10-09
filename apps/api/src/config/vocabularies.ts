import { z } from 'zod';

export const ObjectionTypeEnum = z.enum([
  'price',
  'maintenance_cost',
  'fuel_efficiency',
  'warranty',
  'financing',
  'availability',
  'delivery_time',
  'feature_gap',
  'competitor_preference',
  'trust_brand',
  'trade_in',
  'other',
]);

export type ObjectionType = z.infer<typeof ObjectionTypeEnum>;

export const ConversationStageEnum = z.enum([
  'greeting',
  'discovery',
  'product_demo',
  'objection_handling',
  'negotiation',
  'closing',
  'ended_without_next_step',
]);

export type ConversationStage = z.infer<typeof ConversationStageEnum>;
