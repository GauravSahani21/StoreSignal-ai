import crypto from 'node:crypto';
import { chunkDocument } from '../chunking/chunker.js';
import type { EmbeddingProvider } from '../embeddings/types.js';
import type { RetrievedChunk, StoredChunk, StoredDocument } from './types.js';

export interface AddDocumentParams {
  orgId: string;
  knowledgeBaseId: string;
  filename: string;
  fileType: string;
  content: string;
  isDemo?: boolean;
}

export class KnowledgeStore {
  private documents: Map<string, StoredDocument> = new Map();
  private chunks: Map<string, StoredChunk> = new Map();
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  async addDocument(params: AddDocumentParams): Promise<StoredDocument> {
    const docId = `doc-${crypto.randomUUID()}`;
    const rawChunks = chunkDocument(params.content, params.fileType);

    if (rawChunks.length === 0) {
      throw new Error(`Document "${params.filename}" produced zero valid chunks.`);
    }

    const chunkTexts = rawChunks.map((c) => c.content);
    const embeddings = await this.embeddingProvider.embed(chunkTexts);

    const doc: StoredDocument = {
      id: docId,
      orgId: params.orgId,
      knowledgeBaseId: params.knowledgeBaseId,
      filename: params.filename,
      fileType: params.fileType,
      sizeBytes: Buffer.byteLength(params.content, 'utf8'),
      status: 'indexed',
      chunkCount: rawChunks.length,
      isDemo: Boolean(params.isDemo),
      createdAt: new Date().toISOString(),
    };

    this.documents.set(docId, doc);

    for (let i = 0; i < rawChunks.length; i++) {
      const chunkId = `chk-${crypto.randomUUID()}`;
      const rc = rawChunks[i]!;
      const emb = embeddings[i] || new Array<number>(this.embeddingProvider.dimension).fill(0);

      const storedChunk: StoredChunk = {
        id: chunkId,
        orgId: params.orgId,
        documentId: docId,
        filename: params.filename,
        chunkIndex: rc.chunkIndex,
        content: rc.content,
        locationMetadata: rc.locationMetadata,
        embedding: emb,
        isDemo: Boolean(params.isDemo),
      };

      this.chunks.set(chunkId, storedChunk);
    }

    return doc;
  }

  async searchChunks(
    orgId: string,
    queryVector: number[],
    options: { topK?: number; threshold?: number } = {}
  ): Promise<RetrievedChunk[]> {
    const topK = options.topK || 5;
    const threshold = options.threshold !== undefined ? options.threshold : 0.45;

    const scored: RetrievedChunk[] = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.orgId !== orgId) {
        continue; // Enforce strict tenant isolation
      }

      const score = this.calculateCosineSimilarity(queryVector, chunk.embedding);
      if (score >= threshold) {
        scored.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          filename: chunk.filename,
          score,
          content: chunk.content,
          locationMetadata: chunk.locationMetadata,
          isDemo: chunk.isDemo,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async getDocumentById(orgId: string, id: string): Promise<StoredDocument | null> {
    const doc = this.documents.get(id);
    if (!doc || doc.orgId !== orgId) {
      return null;
    }
    return doc;
  }

  async listDocuments(orgId: string): Promise<StoredDocument[]> {
    return Array.from(this.documents.values()).filter((d) => d.orgId === orgId);
  }

  async deleteDocument(orgId: string, id: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc || doc.orgId !== orgId) {
      return false;
    }

    this.documents.delete(id);
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === id && chunk.orgId === orgId) {
        this.chunks.delete(chunkId);
      }
    }
    return true;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] || 0) * (b[i] || 0);
    }
    return dot;
  }
}
