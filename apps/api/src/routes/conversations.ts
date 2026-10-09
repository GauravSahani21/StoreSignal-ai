import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { segmentTranscript } from '../conversations/segmenter.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import type { Repositories } from '../database/repositories/index.js';

const ImportConversationSchema = z.object({
  rawTranscript: z
    .string({
      required_error: 'The "rawTranscript" field is required',
    })
    .trim()
    .min(10, 'Transcript must contain at least 10 characters'),
  source: z.enum(['transcript_import', 'audio_upload', 'mic_recording']).default('transcript_import'),
  language: z.string().default('en'),
  hasConsent: z.boolean({
    required_error: 'Mandatory consent attestation "hasConsent" is required to process conversation data',
  }),
  consentMethod: z.enum(['verbal', 'written', 'digital']).default('verbal'),
  sessionId: z.string().optional(),
  shopperId: z.string().optional(),
  isDemo: z.boolean().default(false),
});

export interface ConversationRoutesOptions {
  repositories: Repositories;
}

export const conversationRoutes: FastifyPluginAsync<ConversationRoutesOptions> = async (
  fastify,
  options
) => {
  const { repositories } = options;

  // 1. Ingest conversation from transcript with mandatory consent check
  fastify.post('/api/conversations', async (request, reply) => {
    const parseResult = ImportConversationSchema.safeParse(request.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new ValidationError(issue ? issue.message : 'Invalid conversation payload');
    }

    const { rawTranscript, source, language, hasConsent, consentMethod, sessionId, isDemo } =
      parseResult.data;

    // Strict Privacy Guard: Zero processing without verified consent
    if (hasConsent !== true) {
      throw new ValidationError(
        'Processing rejected: Explicit customer consent (hasConsent: true) is mandatory per privacy policy.'
      );
    }

    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';

    // 1. Create Conversation record
    const conversation = await repositories.conversations.createConversation({
      orgId,
      sessionId,
      source,
      language,
      status: 'ingested',
      isDemo,
    });

    // 2. Parse Transcript into stable, addressable segments
    const segments = segmentTranscript(rawTranscript, {
      conversationId: conversation.id,
      transcriptVersion: 1,
    });

    // 3. Persist immutable transcript version 1 with segments
    const transcript = await repositories.conversations.createTranscriptWithSegments({
      orgId,
      conversationId: conversation.id,
      version: 1,
      rawText: rawTranscript,
      segments,
    });

    // 4. Record verifiable consent record
    await repositories.consents.recordConsent({
      orgId,
      subject: conversation.id,
      scope: 'transcript_processing',
      method: consentMethod,
      evidenceNotes: `Consent recorded at conversation ingestion for ${source}`,
    });

    return reply.status(201).send({
      conversation,
      transcript: {
        id: transcript.id,
        version: transcript.version,
        segmentCount: transcript.segments.length,
        segments: transcript.segments,
      },
    });
  });

  // 2. List conversations for tenant
  fastify.get('/api/conversations', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const query = request.query as { limit?: string; offset?: string; status?: string };

    const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;
    const status = query.status;

    const result = await repositories.conversations.listConversations(orgId, {
      limit,
      offset,
      status,
    });

    return reply.status(200).send(result);
  });

  // 3. Retrieve single conversation by ID with latest transcript and segments
  fastify.get('/api/conversations/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation with ID "${id}" was not found.`);
    }

    return reply.status(200).send(conversation);
  });
};
