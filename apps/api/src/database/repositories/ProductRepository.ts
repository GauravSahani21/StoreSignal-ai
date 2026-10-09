import crypto from 'node:crypto';
import type { Product } from './types.js';

export interface CreateProductParams {
  orgId: string;
  sku: string;
  name: string;
  category: string;
  priceMin: number;
  priceMax: number;
  attributes?: Record<string, unknown>;
  isDemo?: boolean;
}

export interface IProductRepository {
  createProduct(params: CreateProductParams): Promise<Product>;
  listProducts(orgId: string): Promise<Product[]>;
  getProductBySku(orgId: string, sku: string): Promise<Product | null>;
  getProductById(orgId: string, id: string): Promise<Product | null>;
}

export class MemoryProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();

  async createProduct(params: CreateProductParams): Promise<Product> {
    const id = `prd-${crypto.randomUUID()}`;
    const product: Product = {
      id,
      orgId: params.orgId,
      sku: params.sku,
      name: params.name,
      category: params.category,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      attributes: params.attributes || {},
      isDemo: Boolean(params.isDemo),
      createdAt: new Date().toISOString(),
    };
    this.products.set(id, product);
    return product;
  }

  async listProducts(orgId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => p.orgId === orgId);
  }

  async getProductBySku(orgId: string, sku: string): Promise<Product | null> {
    for (const product of this.products.values()) {
      if (product.orgId === orgId && product.sku.toLowerCase() === sku.toLowerCase()) {
        return product;
      }
    }
    return null;
  }

  async getProductById(orgId: string, id: string): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product || product.orgId !== orgId) {
      return null;
    }
    return product;
  }
}
