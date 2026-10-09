import { describe, expect, it } from 'vitest';
import { createRepositories } from '../database/repositories/index.js';
import { DEFAULT_DEV_ORG_ID, seedDatabase } from '../database/seed.js';

describe('Database Seed Script (Appendix D)', () => {
  it('seeds 6 fictional Vayu Motors products and shoppers flagged is_demo', async () => {
    const repos = createRepositories();

    const result = await seedDatabase(repos);
    expect(result.productCount).toBe(6);
    expect(result.shopperCount).toBe(3);

    const products = await repos.products.listProducts(DEFAULT_DEV_ORG_ID);
    expect(products).toHaveLength(6);

    for (const p of products) {
      expect(p.isDemo).toBe(true);
      expect(p.priceMin).toBeGreaterThan(0);
      expect(p.attributes).toBeDefined();
    }

    const prithvi = await repos.products.getProductBySku(DEFAULT_DEV_ORG_ID, 'vayu-commuter-110');
    expect(prithvi?.name).toBe('Vayu Prithvi 110');
    expect((prithvi?.attributes as { mileageKmpl: number }).mileageKmpl).toBe(68);

    const shoppers = await repos.shoppers.listShoppers(DEFAULT_DEV_ORG_ID);
    expect(shoppers).toHaveLength(3);
    for (const s of shoppers) {
      expect(s.isDemo).toBe(true);
    }
  });

  it('is strictly idempotent and does not create duplicate entries when run multiple times', async () => {
    const repos = createRepositories();

    // First execution
    await seedDatabase(repos);

    // Second execution
    await seedDatabase(repos);

    const products = await repos.products.listProducts(DEFAULT_DEV_ORG_ID);
    expect(products).toHaveLength(6);

    const shoppers = await repos.shoppers.listShoppers(DEFAULT_DEV_ORG_ID);
    expect(shoppers).toHaveLength(3);
  });
});
