import crypto from 'node:crypto';
import type { EmbeddingProvider } from './types.js';

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = 384;
  readonly model = 'mock-text-embedding-384';

  // Key retail semantic terms and their assigned prime projection dimensions
  private static readonly VOCAB_MAP: Record<string, number[]> = {
    // Models
    prithvi: [10, 11, 12, 13],
    agni: [14, 15, 16, 17],
    vayu: [18, 19, 20, 21],
    garud: [22, 23, 24, 25],
    vidyut: [26, 27, 28, 29],
    trishul: [30, 31, 32, 33],
    commuter: [34, 35, 36],
    scooter: [37, 38, 39],
    electric: [40, 41, 42],

    // Product specs & metrics
    mileage: [50, 51, 52, 53],
    kmpl: [50, 51, 52, 53],
    efficiency: [50, 51, 54],
    fuel: [52, 53, 55],
    engine: [56, 57, 58],
    cc: [56, 57, 59],
    power: [60, 61, 62],
    range: [63, 64, 65],
    battery: [66, 67, 68],
    charging: [69, 70, 71],
    charger: [69, 70, 72],

    // Economics & Sales
    price: [80, 81, 82, 83],
    cost: [80, 81, 84],
    rate: [80, 82, 85],
    showroom: [86, 87, 88],
    financing: [89, 90, 91],
    emi: [89, 90, 92],
    loan: [89, 91, 93],
    discount: [94, 95, 96],
    offer: [94, 95, 97],

    // Maintenance & Care
    service: [100, 101, 102, 103],
    maintenance: [100, 101, 104, 105],
    schedule: [102, 103, 106],
    labour: [107, 108, 109],
    oil: [110, 111, 112],
    warranty: [115, 116, 117, 118],
    guarantee: [115, 116, 119],
    replacement: [120, 121, 122],
    return: [123, 124, 125],
    cancellation: [123, 126, 127],

    // Availability & Delivery
    delivery: [130, 131, 132],
    waiting: [130, 133, 134],
    stock: [135, 136, 137],
    color: [138, 139, 140],
    test: [141, 142, 143],
    ride: [141, 142, 144],
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedSingle(text));
  }

  private embedSingle(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const cleaned = text.toLowerCase();
    const words = cleaned.split(/[\s,.;:!?()[\]{}"'\\/-]+/).filter(Boolean);

    // 1. Project identified semantic terms into primary concept dimensions
    for (const word of words) {
      const dimensions = MockEmbeddingProvider.VOCAB_MAP[word];
      if (dimensions) {
        for (const dim of dimensions) {
          if (dim < this.dimension) {
            vector[dim] = (vector[dim] || 0) + 2.0;
          }
        }
      }

      // Also hash word into deterministic pseudo-random buckets to capture syntax
      const hash = crypto.createHash('md5').update(word).digest();
      const bucket = hash.readUInt16BE(0) % this.dimension;
      vector[bucket] = (vector[bucket] || 0) + 0.5;
    }

    // 2. L2 normalize vector so dot product === cosine similarity
    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      const val = vector[i] || 0;
      sumSquares += val * val;
    }

    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = (vector[i] || 0) / norm;
      }
    }

    return vector;
  }
}
