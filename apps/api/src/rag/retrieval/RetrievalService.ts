import type { EmbeddingProvider } from '../embeddings/types.js';
import type { KnowledgeStore } from './KnowledgeStore.js';
import type { RetrievalResult } from './types.js';

export interface RetrievalOptions {
  topK?: number;
  threshold?: number;
}

export class RetrievalService {
  private readonly store: KnowledgeStore;
  private readonly embeddingProvider: EmbeddingProvider;

  constructor(store: KnowledgeStore, embeddingProvider: EmbeddingProvider) {
    this.store = store;
    this.embeddingProvider = embeddingProvider;
  }

  async retrieve(
    orgId: string,
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    if (!query || !query.trim()) {
      return {
        query,
        chunks: [],
        status: 'empty',
        durationMs: 0,
      };
    }

    try {
      const [queryVector] = await this.embeddingProvider.embed([query]);
      if (!queryVector) {
        throw new Error('Failed to generate query embedding vector.');
      }

      const chunks = await this.store.searchChunks(orgId, queryVector, {
        topK: options.topK || 4,
        threshold: options.threshold !== undefined ? options.threshold : 0.40,
      });

      const durationMs = Date.now() - startTime;

      return {
        query,
        chunks,
        status: chunks.length > 0 ? 'ok' : 'empty',
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      return {
        query,
        chunks: [],
        status: 'failed',
        durationMs,
        error: err instanceof Error ? err.message : 'Knowledge retrieval failed',
      };
    }
  }
}
