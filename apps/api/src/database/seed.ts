import type { Repositories } from './repositories/index.js';

export const DEFAULT_DEV_ORG_ID = 'org-vayu-motors-dev';

export async function seedDatabase(repos: Repositories): Promise<{
  orgId: string;
  productCount: number;
  shopperCount: number;
}> {
  const orgId = DEFAULT_DEV_ORG_ID;

  // 1. Seed Products per Appendix D (Fictional brand: Vayu Motors)
  const productsToSeed = [
    {
      sku: 'vayu-commuter-110',
      name: 'Vayu Prithvi 110',
      category: 'commuter_motorcycle',
      priceMin: 72000,
      priceMax: 78000,
      attributes: {
        displacementCc: 109.7,
        powerBhp: 8.4,
        mileageKmpl: 68,
        fuelTankLitres: 10,
        kerbWeightKg: 112,
        seatHeightMm: 790,
        brakes: 'Drum / Optional Front Disc',
        warrantyYears: 5,
        warrantyKm: 70000,
        colors: ['Midnight Black', 'Electric Blue', 'Scarlet Red'],
      },
    },
    {
      sku: 'vayu-commuter-125',
      name: 'Vayu Agni 125',
      category: 'commuter_motorcycle',
      priceMin: 88000,
      priceMax: 95000,
      attributes: {
        displacementCc: 124.8,
        powerBhp: 11.2,
        mileageKmpl: 58,
        fuelTankLitres: 10.5,
        kerbWeightKg: 118,
        seatHeightMm: 795,
        brakes: 'Disc Front, Drum Rear (Synchronized Braking)',
        warrantyYears: 5,
        warrantyKm: 70000,
        colors: ['Titanium Grey', 'Blazing Orange', 'Pearl White'],
      },
    },
    {
      sku: 'vayu-urban-160',
      name: 'Vayu Vayu 160R',
      category: 'mid_range_motorcycle',
      priceMin: 125000,
      priceMax: 135000,
      attributes: {
        displacementCc: 159.7,
        powerBhp: 17.5,
        mileageKmpl: 45,
        fuelTankLitres: 12,
        kerbWeightKg: 144,
        seatHeightMm: 800,
        brakes: 'Dual Disc with Single-Channel ABS',
        warrantyYears: 3,
        warrantyKm: 50000,
        colors: ['Matte Stealth Black', 'Racing Red', 'Metallic Blue'],
      },
    },
    {
      sku: 'vayu-tourer-250',
      name: 'Vayu Garud 250',
      category: 'touring_motorcycle',
      priceMin: 185000,
      priceMax: 198000,
      attributes: {
        displacementCc: 248.8,
        powerBhp: 27.0,
        mileageKmpl: 35,
        fuelTankLitres: 14.5,
        kerbWeightKg: 162,
        seatHeightMm: 815,
        brakes: 'Dual Disc with Dual-Channel ABS',
        warrantyYears: 3,
        warrantyKm: 50000,
        colors: ['Desert Sand', 'Alpine White', 'Phantom Black'],
      },
    },
    {
      sku: 'vayu-ev-scooter',
      name: 'Vayu Vidyut S1',
      category: 'electric_scooter',
      priceMin: 115000,
      priceMax: 128000,
      attributes: {
        batteryKwh: 3.8,
        certifiedRangeKm: 135,
        realWorldRangeKm: 105,
        topSpeedKmph: 85,
        chargingTimeHours: 4.5,
        kerbWeightKg: 108,
        seatHeightMm: 770,
        brakes: 'Combined Disc Braking',
        batteryWarrantyYears: 5,
        batteryWarrantyKm: 60000,
        colors: ['Cyber Cyan', 'Pearl Silver', 'Volt Yellow'],
      },
    },
    {
      sku: 'vayu-premium-400',
      name: 'Vayu Trishul 400',
      category: 'premium_roadster',
      priceMin: 260000,
      priceMax: 285000,
      attributes: {
        displacementCc: 398.2,
        powerBhp: 42.0,
        mileageKmpl: 28,
        fuelTankLitres: 13,
        kerbWeightKg: 171,
        seatHeightMm: 810,
        brakes: 'ByBre Dual Disc with Dual-Channel Cornering ABS',
        warrantyYears: 2,
        warrantyKm: 30000,
        colors: ['Nebula Matte Black', 'Heritage Silver'],
      },
    },
  ];

  for (const p of productsToSeed) {
    const existing = await repos.products.getProductBySku(orgId, p.sku);
    if (!existing) {
      await repos.products.createProduct({
        orgId,
        sku: p.sku,
        name: p.name,
        category: p.category,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        attributes: p.attributes,
        isDemo: true,
      });
    }
  }

  // 2. Seed Shoppers with explicit / anonymous profiles and varied consent
  const shoppersToSeed = [
    {
      externalCustomerId: 'CUST-IND-101',
      contactHash: 'hash-rahul-sharma-9876543210',
      anonymousId: 'anon-rahul-101',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: true,
      },
    },
    {
      externalCustomerId: 'CUST-IND-102',
      contactHash: 'hash-priya-patel-9811223344',
      anonymousId: 'anon-priya-102',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: false, // Explicitly declined follow-up
      },
    },
    {
      externalCustomerId: undefined, // Pure walk-in anonymous shopper
      contactHash: undefined,
      anonymousId: 'anon-walkin-bengaluru-901',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: false,
      },
    },
  ];

  for (const s of shoppersToSeed) {
    const existing = s.externalCustomerId
      ? await repos.shoppers.findShopperByExternalId(orgId, s.externalCustomerId)
      : await repos.shoppers.findShopperByAnonymousId(orgId, s.anonymousId);

    if (!existing) {
      await repos.shoppers.createShopper({
        orgId,
        externalCustomerId: s.externalCustomerId,
        contactHash: s.contactHash,
        anonymousId: s.anonymousId,
        consentFlags: s.consentFlags,
        isDemo: true,
      });
    }
  }

  return {
    orgId,
    productCount: productsToSeed.length,
    shopperCount: shoppersToSeed.length,
  };
}
