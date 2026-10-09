export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  score: number;
  content: string;
  locationMetadata: Record<string, unknown>;
  isDemo: boolean;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  status: 'ok' | 'empty' | 'failed';
  durationMs: number;
  error?: string;
}

export interface StoredDocument {
  id: string;
  orgId: string;
  knowledgeBaseId: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  chunkCount: number;
  isDemo: boolean;
  createdAt: string;
}

export interface StoredChunk {
  id: string;
  orgId: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  locationMetadata: Record<string, unknown>;
  embedding: number[];
  isDemo: boolean;
}
