import crypto from 'node:crypto';
import type { Shopper } from './types.js';

export interface CreateShopperParams {
  orgId: string;
  externalCustomerId?: string;
  contactHash?: string;
  anonymousId?: string;
  consentFlags?: Record<string, boolean>;
  isDemo?: boolean;
}

export interface IShopperRepository {
  createShopper(params: CreateShopperParams): Promise<Shopper>;
  getShopperById(orgId: string, id: string): Promise<Shopper | null>;
  findShopperByExternalId(orgId: string, externalId: string): Promise<Shopper | null>;
  findShopperByAnonymousId(orgId: string, anonymousId: string): Promise<Shopper | null>;
  listShoppers(orgId: string): Promise<Shopper[]>;
}

export class MemoryShopperRepository implements IShopperRepository {
  private shoppers: Map<string, Shopper> = new Map();

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

  async findShopperByExternalId(orgId: string, externalId: string): Promise<Shopper | null> {
    for (const shopper of this.shoppers.values()) {
      if (shopper.orgId === orgId && shopper.externalCustomerId === externalId) {
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
}
