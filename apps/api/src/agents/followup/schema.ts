import { z } from 'zod';

export const FollowUpChannelSchema = z.enum([
  'email',
  'sms',
  'whatsapp',
  'call_task',
  'none',
]);
export type FollowUpChannel = z.infer<typeof FollowUpChannelSchema>;

export const BlockedReasonSchema = z.enum([
  'no_consent',
  'no_contact_channel',
  'insufficient_evidence',
  'opted_out',
]);
export type BlockedReason = z.infer<typeof BlockedReasonSchema>;

export const FactUsedSchema = z.object({
  fact: z.string().min(1),
  sourceChunkId: z.string().optional(),
  sourceSegmentId: z.string().optional(),
});
export type FactUsed = z.infer<typeof FactUsedSchema>;

export const FollowUpOutputSchema = z.object({
  recommendedAction: z.string().min(1),
  reason: z.string().min(1),
  channel: FollowUpChannelSchema,
  subject: z.string().nullable().optional(),
  message: z.string().nullable(),
  factsUsed: z.array(FactUsedSchema),
  status: z.literal('draft'),
  requiresHumanApproval: z.literal(true),
  blockedReason: BlockedReasonSchema.nullable().optional(),
});

export type FollowUpOutput = z.infer<typeof FollowUpOutputSchema>;
