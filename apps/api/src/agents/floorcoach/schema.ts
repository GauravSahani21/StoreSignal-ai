import { z } from 'zod';
import { ObjectionTypeEnum } from '../../config/vocabularies.js';

export const EvidenceSchema = z.object({
  segmentId: z.string().min(1, 'segmentId is required'),
  quote: z.string().min(1, 'quote is required'),
});

export const SourceRefSchema = z.object({
  chunkId: z.string().min(1, 'chunkId is required'),
  filename: z.string().optional(),
});

export const FloorCoachItemSchema = z.object({
  customerQuestion: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1, 'At least one evidence reference is required'),
  objectionType: ObjectionTypeEnum.nullable(),
  suggestedResponse: z.string().min(1),
  supportingSources: z.array(SourceRefSchema),
  answerStatus: z.enum([
    'answered_from_knowledge',
    'needs_verification',
    'not_a_product_question',
  ]),
  nextStep: z.string().min(1),
});

export const FloorCoachUnresolvedSchema = z.object({
  question: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  reason: z.enum(['no_source_found', 'conflicting_sources', 'retrieval_failed']),
});

export const FloorCoachOutputSchema = z.object({
  items: z.array(FloorCoachItemSchema),
  unresolved: z.array(FloorCoachUnresolvedSchema),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type FloorCoachItem = z.infer<typeof FloorCoachItemSchema>;
export type FloorCoachUnresolved = z.infer<typeof FloorCoachUnresolvedSchema>;
export type FloorCoachOutput = z.infer<typeof FloorCoachOutputSchema>;
