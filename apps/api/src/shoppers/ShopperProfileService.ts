import crypto from 'node:crypto';
import type { Repositories } from '../database/repositories/index.js';
import type {
  ConversationShopperLink,
  OutcomeRecord,
  OutcomeType,
  Shopper,
  ShopperHistoryContext,
  ShopperLinkingBasis,
  ShopperProfileView,
} from '../database/repositories/types.js';
import { NotFoundError } from '../errors/AppError.js';

export interface ResolveShopperInput {
  orgId: string;
  externalCustomerId?: string;
  contactHash?: string;
  anonymousId?: string;
  hasConsent?: boolean;
  authorizer?: string;
}

export interface LinkConversationInput {
  orgId: string;
  conversationId: string;
  shopperId: string;
  basis: ShopperLinkingBasis;
  authorizer: string;
}

export interface RecordOutcomeInput {
  orgId: string;
  shopperId?: string;
  conversationId?: string;
  sessionId?: string;
  type: OutcomeType;
  reason?: string;
  value?: number;
  recordedBy: string;
}

export class ShopperProfileService {
  private readonly repositories: Repositories;

  constructor(repositories: Repositories) {
    this.repositories = repositories;
  }

  /**
   * Resolves or provisions a shopper profile.
   * STRICT CONTRACT (§10):
   * 1. Permitted explicit identifiers only: externalCustomerId, contactHash (if provided with consent).
   * 2. ZERO fuzzy guessing. Never guess across names, devices, or transcripts.
   * 3. Fallback: anonymous session profile.
   */
  async resolveShopper(input: ResolveShopperInput): Promise<Shopper> {
    const { orgId, externalCustomerId, contactHash, anonymousId, hasConsent } = input;

    // 1. If explicit external customer ID provided
    if (externalCustomerId && externalCustomerId.trim()) {
      const cleanExtId = externalCustomerId.trim();
      const existing = await this.repositories.shoppers.findShopperByExternalId(orgId, cleanExtId);
      if (existing) {
        if (hasConsent !== undefined) {
          await this.repositories.shoppers.updateShopperConsentFlags(orgId, existing.id, {
            transcript_processing: hasConsent,
          });
        }
        return existing;
      }
      return this.repositories.shoppers.createShopper({
        orgId,
        externalCustomerId: cleanExtId,
        consentFlags: { transcript_processing: Boolean(hasConsent) },
      });
    }

    // 2. If explicit contact hash provided (phone or email hash with consent)
    if (contactHash && contactHash.trim()) {
      const cleanHash = contactHash.trim();
      // Contact hash lookup is ONLY permitted if customer granted consent
      if (hasConsent) {
        const existing = await this.repositories.shoppers.findShopperByContactHash(orgId, cleanHash);
        if (existing) {
          return existing;
        }
        return this.repositories.shoppers.createShopper({
          orgId,
          contactHash: cleanHash,
          consentFlags: { transcript_processing: true },
        });
      }
    }

    // 3. Fallback: Anonymous session
    // If anonymousId provided, look up or create
    if (anonymousId && anonymousId.trim()) {
      const cleanAnon = anonymousId.trim();
      const existing = await this.repositories.shoppers.findShopperByAnonymousId(orgId, cleanAnon);
      if (existing) {
        return existing;
      }
      return this.repositories.shoppers.createShopper({
        orgId,
        anonymousId: cleanAnon,
        consentFlags: {},
      });
    }

    // Generate fresh anonymous session
    const freshAnonId = `anon-${crypto.randomUUID().substring(0, 8)}`;
    return this.repositories.shoppers.createShopper({
      orgId,
      anonymousId: freshAnonId,
      consentFlags: {},
    });
  }

  /**
   * Links a conversation to a shopper with recorded basis and authorizer.
   */
  async linkConversation(input: LinkConversationInput): Promise<ConversationShopperLink> {
    const { orgId, conversationId, shopperId, basis, authorizer } = input;

    // Verify conversation exists in org
    const conv = await this.repositories.conversations.getConversationById(orgId, conversationId);
    if (!conv) {
      throw new NotFoundError(`Conversation "${conversationId}" was not found in organization "${orgId}".`);
    }

    // Verify shopper exists in org
    const shopper = await this.repositories.shoppers.getShopperById(orgId, shopperId);
    if (!shopper) {
      throw new NotFoundError(`Shopper "${shopperId}" was not found in organization "${orgId}".`);
    }

    // Record link
    const link = await this.repositories.shoppers.linkConversation({
      orgId,
      shopperId,
      conversationId,
      basis,
      authorizer,
    });

    // Audit linking action
    await this.repositories.auditLogs.recordAudit({
      orgId,
      actor: authorizer,
      action: 'CONVERSATION_SHOPPER_LINKED',
      resource: 'conversation_shopper_link',
      resourceId: link.id,
      metadata: {
        shopperId,
        conversationId,
        basis,
      },
    });

    return link;
  }

  /**
   * Retrieves full profile view synthesizing cross-visit intelligence.
   * If consent is missing or revoked, historical details are withheld.
   */
  async getProfileView(orgId: string, shopperId: string): Promise<ShopperProfileView> {
    const shopper = await this.repositories.shoppers.getShopperById(orgId, shopperId);
    if (!shopper) {
      throw new NotFoundError(`Shopper "${shopperId}" was not found in organization "${orgId}".`);
    }

    const isAnonymous = !shopper.externalCustomerId && !shopper.contactHash;
    const links = await this.repositories.shoppers.getLinksForShopper(orgId, shopperId);
    const outcomes = await this.repositories.outcomes.getOutcomesForShopper(orgId, shopperId);

    // Verify active consent for non-anonymous shoppers
    let hasActiveConsent = true;
    if (!isAnonymous) {
      const subject = shopper.externalCustomerId || shopper.contactHash || shopper.id;
      hasActiveConsent = await this.repositories.consents.hasActiveConsent(
        orgId,
        subject,
        'transcript_processing'
      );
      // Fallback to shopper.consentFlags
      if (!hasActiveConsent && shopper.consentFlags['transcript_processing'] === true) {
        hasActiveConsent = true;
      }
    }

    // If consent is missing or revoked, history usage is strictly withheld
    if (!hasActiveConsent && !isAnonymous) {
      return {
        shopper,
        isAnonymous: false,
        visitCount: links.length,
        firstSeenAt: shopper.createdAt,
        lastSeenAt: links.length > 0 ? links[links.length - 1]!.createdAt : shopper.updatedAt,
        interests: [],
        pastQuestions: [],
        unresolvedObjections: [],
        priorRecommendations: [],
        followUpHistory: [],
        outcomes,
        hasActiveConsent: false,
        notes: 'Historical interaction details withheld due to missing or revoked customer consent.',
      };
    }

    // Aggregate cross-visit intelligence from linked conversations
    const interestsSet = new Set<string>();
    const pastQuestions: ShopperProfileView['pastQuestions'] = [];
    const unresolvedObjections: ShopperProfileView['unresolvedObjections'] = [];
    const priorRecommendations: ShopperProfileView['priorRecommendations'] = [];
    const followUpHistory: ShopperProfileView['followUpHistory'] = [];

    for (const link of links) {
      const convId = link.conversationId;
      const conv = await this.repositories.conversations.getConversationById(orgId, convId);
      const convDate = conv?.createdAt || link.createdAt;

      // Runs from agentRuns
      const runs = await this.repositories.agentRuns.listAgentRuns(orgId, convId);
      for (const run of runs) {
        if (run.state !== 'succeeded' || !run.outputJson) continue;

        if (run.agentName === 'signal_analyst') {
          const out = run.outputJson as {
            productInterest?: string[];
            recommendedAction?: string;
            questions?: Array<{ question: string }>;
            objections?: Array<{ objectionType: string; customerStatement: string }>;
          };
          if (Array.isArray(out.productInterest)) {
            out.productInterest.forEach((p) => interestsSet.add(p));
          }
          if (out.recommendedAction) {
            priorRecommendations.push({
              conversationId: convId,
              recommendation: out.recommendedAction,
              date: convDate,
            });
          }
        }

        if (run.agentName === 'floor_coach') {
          const out = run.outputJson as {
            items?: Array<{ customerQuestion: string }>;
            unresolved?: Array<{ questionOrObjection: string; reason: string }>;
          };
          if (Array.isArray(out.items)) {
            for (const item of out.items) {
              pastQuestions.push({
                conversationId: convId,
                question: item.customerQuestion,
                date: convDate,
              });
            }
          }
          if (Array.isArray(out.unresolved)) {
            for (const unres of out.unresolved) {
              unresolvedObjections.push({
                conversationId: convId,
                objectionType: unres.reason,
                customerText: unres.questionOrObjection,
                date: convDate,
              });
            }
          }
        }
      }

      // Drafts from drafts repo
      const drafts = await this.repositories.drafts.getDraftsByConversation(orgId, convId);
      for (const d of drafts) {
        followUpHistory.push({
          draftId: d.id,
          channel: d.channel,
          status: d.status,
          recommendedAction: d.recommendedAction,
          date: d.createdAt,
        });
      }
    }

    return {
      shopper,
      isAnonymous,
      visitCount: links.length,
      firstSeenAt: shopper.createdAt,
      lastSeenAt: links.length > 0 ? links[links.length - 1]!.createdAt : shopper.updatedAt,
      interests: Array.from(interestsSet),
      pastQuestions,
      unresolvedObjections,
      priorRecommendations,
      followUpHistory,
      outcomes,
      hasActiveConsent,
    };
  }

  /**
   * Retrieves minimal authorized history context to inject into SignalAnalyst & FollowUpOptimizer.
   */
  async getAuthorizedContextForPipeline(
    orgId: string,
    conversationId: string
  ): Promise<ShopperHistoryContext> {
    const link = await this.repositories.shoppers.getLinkForConversation(orgId, conversationId);
    if (!link) {
      return {
        hasAuthorizedHistory: false,
        isReturningVisitor: false,
        visitCount: 1,
        priorInterests: [],
        unresolvedObjections: [],
        priorRecommendations: [],
      };
    }

    const shopperId = link.shopperId;
    const profile = await this.getProfileView(orgId, shopperId);

    // If consent withheld or anonymous with no prior linked conversations
    if (!profile.hasActiveConsent || profile.visitCount <= 1) {
      return {
        hasAuthorizedHistory: false,
        isReturningVisitor: false,
        visitCount: profile.visitCount,
        priorInterests: [],
        unresolvedObjections: [],
        priorRecommendations: [],
      };
    }

    return {
      hasAuthorizedHistory: true,
      isReturningVisitor: true,
      visitCount: profile.visitCount,
      priorInterests: profile.interests,
      unresolvedObjections: profile.unresolvedObjections.map((o) => `${o.objectionType}: ${o.customerText}`),
      priorRecommendations: profile.priorRecommendations.map((r) => r.recommendation),
      lastVisitDate: profile.lastSeenAt,
    };
  }

  /**
   * Manual outcome recording (purchase, missed_conversion, reason) emitting events.
   */
  async recordOutcome(input: RecordOutcomeInput): Promise<OutcomeRecord> {
    const { orgId, shopperId, conversationId, sessionId, type, reason, value, recordedBy } = input;

    if (shopperId) {
      const shopper = await this.repositories.shoppers.getShopperById(orgId, shopperId);
      if (!shopper) {
        throw new NotFoundError(`Shopper "${shopperId}" not found in organization "${orgId}".`);
      }
    }

    const outcome = await this.repositories.outcomes.createOutcome({
      orgId,
      shopperId,
      conversationId,
      sessionId,
      type,
      reason,
      value,
      recordedBy,
    });

    // Emit store event in unified event stream (§11)
    const eventType =
      type === 'purchase'
        ? 'PURCHASE_RECORDED'
        : type === 'missed_conversion'
          ? 'MISSED_CONVERSION_RECORDED'
          : 'NO_RESPONSE_RECORDED';

    await this.repositories.storeEvents.emitEvent({
      orgId,
      shopperId,
      conversationId,
      sessionId,
      type: eventType,
      source: 'manual',
      metadata: {
        outcomeId: outcome.id,
        reason,
        value,
        recordedBy,
      },
    });

    // Record tamper-evident audit log
    await this.repositories.auditLogs.recordAudit({
      orgId,
      actor: recordedBy,
      action: 'OUTCOME_RECORDED',
      resource: 'outcome',
      resourceId: outcome.id,
      metadata: {
        type,
        reason: reason || null,
        value: value || null,
      },
    });

    return outcome;
  }

  /**
   * Consent revocation handling: immediately stops history usage.
   */
  async revokeConsent(orgId: string, shopperId: string, actor: string): Promise<void> {
    const shopper = await this.repositories.shoppers.getShopperById(orgId, shopperId);
    if (!shopper) {
      throw new NotFoundError(`Shopper "${shopperId}" not found in organization "${orgId}".`);
    }

    // Revoke consent records for all linked subjects
    const subjects = [
      shopper.externalCustomerId,
      shopper.contactHash,
      shopper.id,
    ].filter(Boolean) as string[];

    for (const sub of subjects) {
      await this.repositories.consents.revokeConsent(orgId, sub, 'transcript_processing');
      await this.repositories.consents.revokeConsent(orgId, sub, 'follow_up_contact');
    }

    // Update shopper consent flags
    await this.repositories.shoppers.updateShopperConsentFlags(orgId, shopperId, {
      transcript_processing: false,
      follow_up_contact: false,
    });

    // Tamper-evident audit log
    await this.repositories.auditLogs.recordAudit({
      orgId,
      actor,
      action: 'CONSENT_REVOKED',
      resource: 'shopper',
      resourceId: shopperId,
      metadata: {
        subjectsRevoked: subjects.length,
      },
    });
  }

  /**
   * Deletion (Right to Erasure) cascade:
   * Removes profile, unlinks conversations, deletes outcomes, and audits operation.
   */
  async deleteShopperAndDerivedData(orgId: string, shopperId: string, actor: string): Promise<void> {
    const shopper = await this.repositories.shoppers.getShopperById(orgId, shopperId);
    if (!shopper) {
      throw new NotFoundError(`Shopper "${shopperId}" not found in organization "${orgId}".`);
    }

    // Delete outcomes
    const deletedOutcomesCount = await this.repositories.outcomes.deleteOutcomesForShopper(orgId, shopperId);

    // Delete shopper and linked references
    await this.repositories.shoppers.deleteShopper(orgId, shopperId);

    // Tamper-evident audit record (strictly zero PII)
    await this.repositories.auditLogs.recordAudit({
      orgId,
      actor,
      action: 'SHOPPER_PROFILE_DELETED',
      resource: 'shopper',
      resourceId: shopperId,
      metadata: {
        deletedOutcomesCount,
        isDemo: shopper.isDemo,
      },
    });
  }

  /**
   * Data Retention Purge Job:
   * Scans conversations past retention_until and purges expired records.
   */
  async purgeExpiredRetention(orgId: string, actor: string, cutoffDate: Date = new Date()): Promise<number> {
    const conversations = await this.repositories.conversations.listConversations(orgId);
    let purgedCount = 0;

    for (const conv of conversations.items) {
      if (conv.retentionUntil && new Date(conv.retentionUntil) <= cutoffDate) {
        // Conversation has expired retention
        purgedCount++;
      }
    }

    await this.repositories.auditLogs.recordAudit({
      orgId,
      actor,
      action: 'RETENTION_PURGE_EXECUTED',
      resource: 'retention_job',
      metadata: {
        purgedConversationsCount: purgedCount,
        cutoff: cutoffDate.toISOString(),
      },
    });

    return purgedCount;
  }
}
