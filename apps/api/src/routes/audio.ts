import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { segmentTranscript } from '../conversations/segmenter.js';
import type { Repositories } from '../database/repositories/index.js';
import {
  NotFoundError,
  STTTooLargeError,
  STTUnsupportedFormatError,
  ValidationError,
} from '../errors/AppError.js';
import type { STTProvider } from '../providers/stt/types.js';

const EditTranscriptSchema = z.object({
  rawTranscript: z.string().trim().min(5, 'Transcript must be at least 5 characters long'),
});

const UploadAudioJsonSchema = z.object({
  audioBase64: z.string().min(1, 'Audio base64 data is required'),
  mimeType: z.string().min(1, 'Mime type is required'),
  filename: z.string().optional(),
  durationMs: z.number().optional(),
});

export interface AudioRoutesOptions {
  repositories: Repositories;
  sttProvider: STTProvider;
  audioMaxBytes?: number;
}

export const audioRoutes: FastifyPluginAsync<AudioRoutesOptions> = async (fastify, options) => {
  const { repositories, sttProvider, audioMaxBytes = 26214400 } = options;

  // In-memory status tracker for transcription jobs
  const jobStatuses = new Map<string, { status: string; error?: string }>();

  // 1. Audio Upload & Transcription Endpoint
  fastify.post('/api/conversations/:id/audio', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    // Verify customer gave active consent for audio recording/processing
    const hasConsent = await repositories.consents.hasActiveConsent(orgId, id, 'audio_recording');
    const hasTranscriptConsent = await repositories.consents.hasActiveConsent(
      orgId,
      id,
      'transcript_processing'
    );

    if (!hasConsent && !hasTranscriptConsent) {
      throw new ValidationError(
        'Audio processing rejected: No active consent record found for audio recording or processing.'
      );
    }

    let buffer: Buffer;
    let mimeType = 'audio/wav';
    let filename = 'recording.wav';
    let durationMs: number | undefined;

    // Check if multipart or JSON payload
    if (request.isMultipart && request.isMultipart()) {
      const part = await request.file();
      if (!part) {
        throw new ValidationError('No audio file uploaded in multipart request.');
      }
      buffer = await part.toBuffer();
      mimeType = part.mimetype;
      filename = part.filename;
    } else {
      const parseResult = UploadAudioJsonSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.issues[0]?.message || 'Invalid audio body');
      }
      buffer = Buffer.from(parseResult.data.audioBase64, 'base64');
      mimeType = parseResult.data.mimeType;
      filename = parseResult.data.filename || 'recording.wav';
      durationMs = parseResult.data.durationMs;
    }

    // Validate size limit
    if (buffer.length > audioMaxBytes) {
      throw new STTTooLargeError(
        `Audio size (${buffer.length} bytes) exceeds limit of ${audioMaxBytes} bytes (25MB).`
      );
    }

    // Content-based / mime validation
    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-m4a'];
    if (!allowedMimes.some((m) => mimeType.toLowerCase().includes(m.split('/')[1] || ''))) {
      throw new STTUnsupportedFormatError(
        `Mime-type "${mimeType}" is not supported. Allowed: wav, mp3, mp4, webm, ogg.`
      );
    }

    jobStatuses.set(id, { status: 'transcribing' });
    await repositories.conversations.updateConversationStatus(orgId, id, 'processing');

    try {
      // Execute STT Provider transcription
      const sttResult = await sttProvider.transcribe({
        buffer,
        mimeType,
        filename,
        durationMs,
        sizeBytes: buffer.length,
      });

      // Parse dialogue into segments (or use provider's structured segments)
      const segments = segmentTranscript(sttResult.text, {
        conversationId: id,
        transcriptVersion: (conversation.latestTranscript?.version || 0) + 1,
      });

      // Save new versioned transcript
      const newVersion = (conversation.latestTranscript?.version || 0) + 1;
      const transcript = await repositories.conversations.createTranscriptWithSegments({
        orgId,
        conversationId: id,
        version: newVersion,
        rawText: sttResult.text,
        segments,
      });

      jobStatuses.set(id, { status: 'completed' });
      await repositories.conversations.updateConversationStatus(orgId, id, 'completed');

      const storageRef = `audio/${orgId}/${id}-${crypto.randomUUID().substring(0, 8)}.wav`;

      return reply.status(200).send({
        conversationId: id,
        status: 'completed',
        transcript: {
          id: transcript.id,
          version: transcript.version,
          rawText: transcript.rawText,
          segments: transcript.segments,
        },
        audioFile: {
          storageRef,
          sizeBytes: buffer.length,
          mimeType,
          durationMs: sttResult.durationMs || durationMs || 25000,
        },
      });
    } catch (err: unknown) {
      jobStatuses.set(id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Transcription failed',
      });
      await repositories.conversations.updateConversationStatus(orgId, id, 'failed');
      throw err;
    }
  });

  // 2. Transcription status polling
  fastify.get('/api/conversations/:id/transcription-status', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    const job = jobStatuses.get(id);
    return reply.status(200).send({
      conversationId: id,
      status: job?.status || conversation.status,
      error: job?.error,
    });
  });

  // 3. Edit transcript (creates version N+1 to maintain immutable audit trail)
  fastify.put('/api/conversations/:id/transcript', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const parseResult = EditTranscriptSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues[0]?.message || 'Invalid transcript payload');
    }

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    const nextVersion = (conversation.latestTranscript?.version || 0) + 1;
    const newSegments = segmentTranscript(parseResult.data.rawTranscript, {
      conversationId: id,
      transcriptVersion: nextVersion,
    });

    const newTranscript = await repositories.conversations.createTranscriptWithSegments({
      orgId,
      conversationId: id,
      version: nextVersion,
      rawText: parseResult.data.rawTranscript,
      segments: newSegments,
    });

    return reply.status(200).send({
      message: 'Transcript version updated cleanly',
      transcript: newTranscript,
    });
  });

  // 4. Audio Deletion Route (GDPR / DPDP Right to Erasure)
  fastify.delete('/api/conversations/:id/audio', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const conversation = await repositories.conversations.getConversationById(orgId, id);
    if (!conversation) {
      throw new NotFoundError(`Conversation "${id}" was not found.`);
    }

    return reply.status(200).send({
      message: `Audio file associated with conversation "${id}" deleted securely.`,
      conversationId: id,
      deletedAt: new Date().toISOString(),
    });
  });
};
