import crypto from 'node:crypto';
import type { ConversationShopperLink, Shopper, ShopperLinkingBasis } from './types.js';

export interface CreateShopperParams {
  orgId: string;
  externalCustomerId?: string;
  contactHash?: string;
  anonymousId?: string;
  consentFlags?: Record<string, boolean>;
  isDemo?: boolean;
}

export interface LinkConversationParams {
  orgId: string;
  shopperId: string;
  conversationId: string;
  basis: ShopperLinkingBasis;
  authorizer: string;
}

export interface IShopperRepository {
  createShopper(params: CreateShopperParams): Promise<Shopper>;
  getShopperById(orgId: string, id: string): Promise<Shopper | null>;
  findById(orgId: string, id: string): Promise<Shopper | null>;
  findShopperByExternalId(orgId: string, externalId: string): Promise<Shopper | null>;
  findShopperByContactHash(orgId: string, contactHash: string): Promise<Shopper | null>;
  findShopperByAnonymousId(orgId: string, anonymousId: string): Promise<Shopper | null>;
  listShoppers(orgId: string): Promise<Shopper[]>;
  updateShopperConsentFlags(orgId: string, shopperId: string, flags: Record<string, boolean>): Promise<Shopper | null>;
  linkConversation(params: LinkConversationParams): Promise<ConversationShopperLink>;
  getLinkForConversation(orgId: string, conversationId: string): Promise<ConversationShopperLink | null>;
  getLinksForShopper(orgId: string, shopperId: string): Promise<ConversationShopperLink[]>;
  deleteShopper(orgId: string, shopperId: string): Promise<boolean>;
}

export class MemoryShopperRepository implements IShopperRepository {
  private shoppers: Map<string, Shopper> = new Map();
  private links: Map<string, ConversationShopperLink> = new Map();

  async createShopper(params: CreateShopperParams): Promise<Shopper> {
    const id = `shp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const shopper: Shopper = {
      id,
      orgId: params.orgId,
      externalCustomerId: params.externalCustomerId,
      contactHash: params.contactHash,
      anonymousId: params.anonymousId || `anon-${crypto.randomUUID().substring(0, 8)}`,
      consentFlags: params.consentFlags || {},
      isDemo: Boolean(params.isDemo),
      createdAt: now,
      updatedAt: now,
    };
    this.shoppers.set(id, shopper);
    return shopper;
  }

  async getShopperById(orgId: string, id: string): Promise<Shopper | null> {
    const shopper = this.shoppers.get(id);
    if (!shopper || shopper.orgId !== orgId) {
      return null;
    }
    return shopper;
  }

  async findById(orgId: string, id: string): Promise<Shopper | null> {
    return this.getShopperById(orgId, id);
  }

  async findShopperByExternalId(orgId: string, externalId: string): Promise<Shopper | null> {
    for (const shopper of this.shoppers.values()) {
      if (shopper.orgId === orgId && shopper.externalCustomerId === externalId) {
        return shopper;
      }
    }
    return null;
  }

  async findShopperByContactHash(orgId: string, contactHash: string): Promise<Shopper | null> {
    for (const shopper of this.shoppers.values()) {
      if (shopper.orgId === orgId && shopper.contactHash === contactHash) {
        return shopper;
      }
    }
    return null;
  }

  async findShopperByAnonymousId(orgId: string, anonymousId: string): Promise<Shopper | null> {
    for (const shopper of this.shoppers.values()) {
      if (shopper.orgId === orgId && shopper.anonymousId === anonymousId) {
        return shopper;
      }
    }
    return null;
  }

  async listShoppers(orgId: string): Promise<Shopper[]> {
    return Array.from(this.shoppers.values()).filter((s) => s.orgId === orgId);
  }

  async updateShopperConsentFlags(
    orgId: string,
    shopperId: string,
    flags: Record<string, boolean>
  ): Promise<Shopper | null> {
    const shopper = await this.getShopperById(orgId, shopperId);
    if (!shopper) return null;
    shopper.consentFlags = { ...shopper.consentFlags, ...flags };
    shopper.updatedAt = new Date().toISOString();
    this.shoppers.set(shopperId, shopper);
    return shopper;
  }

  async linkConversation(params: LinkConversationParams): Promise<ConversationShopperLink> {
    // Check if link already exists for this conversation
    for (const [key, link] of this.links.entries()) {
      if (link.orgId === params.orgId && link.conversationId === params.conversationId) {
        // Update existing link
        const updated: ConversationShopperLink = {
          ...link,
          shopperId: params.shopperId,
          basis: params.basis,
          authorizer: params.authorizer,
        };
        this.links.set(key, updated);
        return updated;
      }
    }

    const id = `lnk-${crypto.randomUUID()}`;
    const link: ConversationShopperLink = {
      id,
      orgId: params.orgId,
      shopperId: params.shopperId,
      conversationId: params.conversationId,
      basis: params.basis,
      authorizer: params.authorizer,
      createdAt: new Date().toISOString(),
    };
    this.links.set(id, link);
    return link;
  }

  async getLinkForConversation(orgId: string, conversationId: string): Promise<ConversationShopperLink | null> {
    for (const link of this.links.values()) {
      if (link.orgId === orgId && link.conversationId === conversationId) {
        return link;
      }
    }
    return null;
  }

  async getLinksForShopper(orgId: string, shopperId: string): Promise<ConversationShopperLink[]> {
    return Array.from(this.links.values()).filter(
      (l) => l.orgId === orgId && l.shopperId === shopperId
    );
  }

  async deleteShopper(orgId: string, shopperId: string): Promise<boolean> {
    const shopper = await this.getShopperById(orgId, shopperId);
    if (!shopper) return false;

    // Delete shopper
    this.shoppers.delete(shopperId);

    // Cascade delete links
    for (const [key, link] of this.links.entries()) {
      if (link.orgId === orgId && link.shopperId === shopperId) {
        this.links.delete(key);
      }
    }

    return true;
  }
}
