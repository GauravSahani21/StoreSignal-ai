import { z } from 'zod';
import { ObjectionTypeEnum } from '../../config/vocabularies.js';
import { EvidenceSchema } from '../floorcoach/schema.js';

export const SignalAnalystOutputSchema = z.object({
  summary: z.string().min(10, 'Executive interaction summary is required'),
  productInterests: z.array(
    z.object({
      productRef: z.string().nullable(),
      text: z.string().min(1),
      basis: z.enum(['explicit', 'inferred']),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  preferences: z.array(
    z.object({
      text: z.string().min(1),
      basis: z.enum(['explicit', 'inferred']),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  budget: z
    .object({
      value: z.string().min(1),
      basis: z.literal('explicit'),
      evidence: z.array(EvidenceSchema).min(1),
    })
    .nullable(),
  timeline: z
    .object({
      value: z.string().min(1),
      basis: z.literal('explicit'),
      evidence: z.array(EvidenceSchema).min(1),
    })
    .nullable(),
  competitorMentions: z.array(
    z.object({
      name: z.string().min(1),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  objections: z.array(
    z.object({
      type: ObjectionTypeEnum,
      text: z.string().min(1),
      resolved: z.boolean(),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  unresolvedQuestions: z.array(
    z.object({
      text: z.string().min(1),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  intentSignals: z.array(
    z.object({
      signalId: z.string().min(1),
      present: z.boolean(),
      evidence: z.array(EvidenceSchema),
    })
  ),
  missedConversionHypotheses: z.array(
    z.object({
      text: z.string().min(1),
      confidence: z.enum(['low', 'medium']),
      evidence: z.array(EvidenceSchema).min(1),
    })
  ),
  recommendedNextAction: z.string().min(5),
});

export type SignalAnalystOutput = z.infer<typeof SignalAnalystOutputSchema>;
