import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Repositories } from '../database/repositories/index.js';
import { ShopperProfileService } from '../shoppers/ShopperProfileService.js';
import { ValidationError } from '../errors/AppError.js';

const ResolveShopperBodySchema = z.object({
  orgId: z.string().optional(),
  externalCustomerId: z.string().optional(),
  contactHash: z.string().optional(),
  anonymousId: z.string().optional(),
  hasConsent: z.boolean().optional(),
  authorizer: z.string().optional(),
});

const LinkShopperBodySchema = z.object({
  orgId: z.string().optional(),
  shopperId: z.string().min(1),
  basis: z.enum([
    'explicit_customer_id',
    'explicit_phone_hash',
    'explicit_email_hash',
    'anonymous_session',
  ]),
  authorizer: z.string().min(1),
});

const RecordOutcomeBodySchema = z.object({
  orgId: z.string().optional(),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
  type: z.enum(['purchase', 'missed_conversion', 'no_response']),
  reason: z.string().optional(),
  value: z.number().nonnegative().optional(),
  recordedBy: z.string().min(1),
});

const RevokeConsentBodySchema = z.object({
  orgId: z.string().optional(),
  actor: z.string().min(1),
});

const DeleteShopperBodySchema = z.object({
  orgId: z.string().optional(),
  actor: z.string().min(1),
});

const RetentionPurgeBodySchema = z.object({
  orgId: z.string().optional(),
  actor: z.string().min(1),
  cutoffDate: z.string().datetime().optional(),
});

export const shopperRoutes: FastifyPluginAsync<{
  repositories: Repositories;
  shopperProfileService?: ShopperProfileService;
}> = async (fastify, opts) => {
  const service = opts.shopperProfileService ?? new ShopperProfileService(opts.repositories);

  // 1. Resolve or provision shopper (explicit identifiers only; anonymous fallback; no fuzzy guessing)
  fastify.post('/api/shoppers/resolve', async (request, reply) => {
    const parseResult = ResolveShopperBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(`Invalid shopper resolution payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    const shopper = await service.resolveShopper({
      orgId,
      externalCustomerId: parseResult.data.externalCustomerId,
      contactHash: parseResult.data.contactHash,
      anonymousId: parseResult.data.anonymousId,
      hasConsent: parseResult.data.hasConsent,
      authorizer: parseResult.data.authorizer,
    });

    return reply.status(200).send({
      success: true,
      data: shopper,
    });
  });

  // 2. Link conversation to shopper with recorded basis and authorizer
  fastify.post('/api/conversations/:id/link-shopper', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const parseResult = LinkShopperBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(`Invalid link shopper payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    const link = await service.linkConversation({
      orgId,
      conversationId,
      shopperId: parseResult.data.shopperId,
      basis: parseResult.data.basis,
      authorizer: parseResult.data.authorizer,
    });

    return reply.status(200).send({
      success: true,
      data: link,
    });
  });

  // 3. Get Shopper Profile View (interests, past questions, unresolved objections, outcomes, consent)
  fastify.get('/api/shoppers/:id', async (request, reply) => {
    const { id: shopperId } = request.params as { id: string };
    const query = request.query as { orgId?: string };
    const orgId = query.orgId || 'org-vayu-motors-dev';

    const profile = await service.getProfileView(orgId, shopperId);

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  });

  // 4. Get shopper linked to a conversation
  fastify.get('/api/conversations/:id/shopper', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const query = request.query as { orgId?: string };
    const orgId = query.orgId || 'org-vayu-motors-dev';

    const link = await opts.repositories.shoppers.getLinkForConversation(orgId, conversationId);
    if (!link) {
      return reply.status(200).send({
        success: true,
        data: null,
      });
    }

    const profile = await service.getProfileView(orgId, link.shopperId);
    return reply.status(200).send({
      success: true,
      data: {
        profile,
        link,
      },
    });
  });

  // 5. Record manual interaction outcome (purchase, missed_conversion, reason)
  fastify.post('/api/shoppers/:id/outcomes', async (request, reply) => {
    const { id: shopperId } = request.params as { id: string };
    const parseResult = RecordOutcomeBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(`Invalid record outcome payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    const outcome = await service.recordOutcome({
      orgId,
      shopperId,
      conversationId: parseResult.data.conversationId,
      sessionId: parseResult.data.sessionId,
      type: parseResult.data.type,
      reason: parseResult.data.reason,
      value: parseResult.data.value,
      recordedBy: parseResult.data.recordedBy,
    });

    return reply.status(201).send({
      success: true,
      data: outcome,
    });
  });

  // 6. Revoke customer consent immediately
  fastify.post('/api/shoppers/:id/revoke-consent', async (request, reply) => {
    const { id: shopperId } = request.params as { id: string };
    const parseResult = RevokeConsentBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(`Invalid revoke consent payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    await service.revokeConsent(orgId, shopperId, parseResult.data.actor);

    return reply.status(200).send({
      success: true,
      message: 'Consent revoked. Historical data usage stopped immediately.',
    });
  });

  // 7. Deletion cascade (Right to Erasure)
  fastify.delete('/api/shoppers/:id', async (request, reply) => {
    const { id: shopperId } = request.params as { id: string };
    const parseResult = DeleteShopperBodySchema.safeParse(request.body || {});
    if (!parseResult.success) {
      throw new ValidationError(`Invalid delete shopper payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    await service.deleteShopperAndDerivedData(orgId, shopperId, parseResult.data.actor);

    return reply.status(200).send({
      success: true,
      message: `Shopper "${shopperId}" and derived profile records permanently erased.`,
    });
  });

  // 8. Retention Purge Job
  fastify.post('/api/retention/purge', async (request, reply) => {
    const parseResult = RetentionPurgeBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(`Invalid retention purge payload: ${JSON.stringify(parseResult.error.format())}`);
    }

    const orgId = parseResult.data.orgId || 'org-vayu-motors-dev';
    const cutoffDate = parseResult.data.cutoffDate ? new Date(parseResult.data.cutoffDate) : new Date();

    const purgedCount = await service.purgeExpiredRetention(orgId, parseResult.data.actor, cutoffDate);

    return reply.status(200).send({
      success: true,
      data: {
        purgedCount,
        cutoff: cutoffDate.toISOString(),
      },
    });
  });
};
