import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { chunkDocument } from '../rag/chunking/chunker.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { RetrievalService } from '../rag/retrieval/RetrievalService.js';
import { seedKnowledgeBase } from '../rag/seedKnowledge.js';

describe('Retail Knowledge Retrieval (RAG) & Chunker (Phase 5)', () => {
  const dummyEnv = loadEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://storesignal:storesignal_dev_pwd@localhost:5432/storesignal_dev',
  });

  it('structure-aware chunker prepends CSV headers and preserves markdown headings', () => {
    // 1. CSV Chunker test
    const csvData = `
Model,Interval,Labour,OilPrice
Prithvi 110,1000 km,Free,₹350
Agni 125,1000 km,Free,₹420
    `.trim();

    const csvChunks = chunkDocument(csvData, 'csv');
    expect(csvChunks).toHaveLength(2);
    expect(csvChunks[0]?.content).toContain('Model: Prithvi 110');
    expect(csvChunks[0]?.content).toContain('OilPrice: ₹350');
    expect(csvChunks[0]?.locationMetadata.row).toBe(1);

    // 2. Markdown Chunker test
    const mdData = `
# Battery Specifications
The battery is 3.8 kWh capacity.

# Charger Details
The charger plugs into standard 15A socket.
    `.trim();

    const mdChunks = chunkDocument(mdData, 'md');
    expect(mdChunks).toHaveLength(2);
    expect(mdChunks[0]?.locationMetadata.heading).toBe('Battery Specifications');
    expect(mdChunks[1]?.locationMetadata.heading).toBe('Charger Details');
  });

  it('retrieves relevant seeded chunks with traceable sources on gold product questions', async () => {
    const embedding = new MockEmbeddingProvider();
    const store = new KnowledgeStore(embedding);
    await seedKnowledgeBase(store, 'org-vayu-motors-dev');
    const service = new RetrievalService(store, embedding);

    // Query 1: Mileage question
    const mileageRes = await service.retrieve(
      'org-vayu-motors-dev',
      'What is the certified mileage of the Prithvi 110?'
    );
    expect(mileageRes.status).toBe('ok');
    expect(mileageRes.chunks.length).toBeGreaterThan(0);
    const topChunk = mileageRes.chunks[0]!;
    expect(topChunk.filename).toBe('vayu_motorcycle_specs.md');
    expect(topChunk.content).toContain('68 kmpl');
    expect(topChunk.score).toBeGreaterThanOrEqual(0.40);

    // Query 2: Service schedule question
    const serviceRes = await service.retrieve(
      'org-vayu-motors-dev',
      'What is the service schedule and engine oil cost for Prithvi 110?'
    );
    expect(serviceRes.status).toBe('ok');
    const foundService = serviceRes.chunks.some(
      (c) => c.filename === 'vayu_service_schedule.csv' && c.content.includes('₹350')
    );
    expect(foundService).toBe(true);
  });

  it('correctly returns empty results for known deliberate knowledge gaps (abstention drive)', async () => {
    const embedding = new MockEmbeddingProvider();
    const store = new KnowledgeStore(embedding);
    await seedKnowledgeBase(store, 'org-vayu-motors-dev');
    const service = new RetrievalService(store, embedding);

    // Deliberate gap 1: Accessory pricing for touring saddlebags (absent from all documents)
    const accessoryRes = await service.retrieve(
      'org-vayu-motors-dev',
      'What is the price of official touring saddlebags and crash guards?'
    );
    // Should return 0 chunks above threshold
    expect(accessoryRes.chunks.length).toBe(0);
    expect(accessoryRes.status).toBe('empty');

    // Deliberate gap 2: 5-year total maintenance cost for Garud 250 (absent from all documents)
    const maintenance5yrRes = await service.retrieve(
      'org-vayu-motors-dev',
      'What is the total 5-year maintenance cost estimate for Garud 250?'
    );
    expect(maintenance5yrRes.chunks.length).toBe(0);
    expect(maintenance5yrRes.status).toBe('empty');
  });

  it('retrieves both conflicting chunks for deliberate policy conflict testing', async () => {
    const embedding = new MockEmbeddingProvider();
    const store = new KnowledgeStore(embedding);
    await seedKnowledgeBase(store, 'org-vayu-motors-dev');
    const service = new RetrievalService(store, embedding);

    // Query on portable charger warranty
    const conflictRes = await service.retrieve(
      'org-vayu-motors-dev',
      'What is the warranty period on the portable battery charger?'
    );

    expect(conflictRes.status).toBe('ok');
    const hasFaqChunk = conflictRes.chunks.some((c) => c.filename === 'vayu_showroom_faqs.md');
    const hasWarrantyChunk = conflictRes.chunks.some((c) => c.filename === 'vayu_warranty_policy.md');

    // Both documents must be retrieved so downstream agents can identify the conflict!
    expect(hasFaqChunk).toBe(true);
    expect(hasWarrantyChunk).toBe(true);
  });

  it('POST /api/knowledge/search endpoint returns valid response and enforces tenant isolation', async () => {
    const app = await buildApp({ env: dummyEnv, logger: false });

    // 1. Search under default tenant
    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: {
        query: 'What is the range of Vidyut S1?',
        topK: 3,
      },
    });

    expect(searchRes.statusCode).toBe(200);
    const searchData = JSON.parse(searchRes.payload);
    expect(searchData.status).toBe('ok');
    expect(searchData.chunks[0].content).toContain('135 km');

    // 2. Search under a different tenant who has no documents
    const isolationRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      headers: { 'x-org-id': 'org-isolated-other' },
      payload: {
        query: 'What is the range of Vidyut S1?',
      },
    });

    expect(isolationRes.statusCode).toBe(200);
    const isolationData = JSON.parse(isolationRes.payload);
    expect(isolationData.chunks).toHaveLength(0);
    expect(isolationData.status).toBe('empty');

    await app.close();
  });
});
