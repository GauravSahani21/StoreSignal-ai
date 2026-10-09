import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError.js';
import type { Repositories } from '../database/repositories/index.js';

const RecordConsentSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required (e.g. shopper ID or session ref)'),
  scope: z.enum(['audio_recording', 'transcript_processing', 'follow_up_contact'], {
    errorMap: () => ({ message: 'Invalid consent scope' }),
  }),
  method: z.enum(['verbal', 'written', 'digital'], {
    errorMap: () => ({ message: 'Invalid consent method' }),
  }),
  evidenceNotes: z.string().optional(),
});

export interface ConsentsRouteOptions {
  repositories: Repositories;
}

export const consentRoutes: FastifyPluginAsync<ConsentsRouteOptions> = async (fastify, options) => {
  const { repositories } = options;

  fastify.post('/api/consents', async (request, reply) => {
    const parseResult = RecordConsentSchema.safeParse(request.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new ValidationError(issue ? issue.message : 'Invalid consent record payload');
    }

    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { subject, scope, method, evidenceNotes } = parseResult.data;

    const record = await repositories.consents.recordConsent({
      orgId,
      subject,
      scope,
      method,
      evidenceNotes,
    });

    return reply.status(201).send(record);
  });
};
