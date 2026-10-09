import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import type { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import type { RetrievalService } from '../rag/retrieval/RetrievalService.js';

const SearchKnowledgeSchema = z.object({
  query: z.string().trim().min(1, 'Search query must not be empty').max(1000),
  topK: z.number().int().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const IngestDocumentSchema = z.object({
  filename: z.string().trim().min(1),
  fileType: z.string().trim().min(1),
  content: z.string().min(1, 'Document content cannot be empty'),
  knowledgeBaseId: z.string().default('kb-vayu-motors-default'),
  isDemo: z.boolean().default(false),
});

export interface KnowledgeRoutesOptions {
  knowledgeStore: KnowledgeStore;
  retrievalService: RetrievalService;
}

export const knowledgeRoutes: FastifyPluginAsync<KnowledgeRoutesOptions> = async (
  fastify,
  options
) => {
  const { knowledgeStore, retrievalService } = options;

  // 1. Semantic Knowledge Search Endpoint
  fastify.post('/api/knowledge/search', async (request, reply) => {
    const parseResult = SearchKnowledgeSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues[0]?.message || 'Invalid search payload');
    }

    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { query, topK, threshold } = parseResult.data;

    const result = await retrievalService.retrieve(orgId, query, { topK, threshold });
    return reply.status(200).send(result);
  });

  // 2. List Knowledge Documents
  fastify.get('/api/knowledge/documents', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const docs = await knowledgeStore.listDocuments(orgId);
    return reply.status(200).send({ items: docs, total: docs.length });
  });

  // 3. Ingest New Document
  fastify.post('/api/knowledge/documents', async (request, reply) => {
    const parseResult = IngestDocumentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues[0]?.message || 'Invalid document payload');
    }

    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { filename, fileType, content, knowledgeBaseId, isDemo } = parseResult.data;

    const doc = await knowledgeStore.addDocument({
      orgId,
      knowledgeBaseId,
      filename,
      fileType,
      content,
      isDemo,
    });

    return reply.status(201).send(doc);
  });

  // 4. Retrieve Document by ID
  fastify.get('/api/documents/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const doc = await knowledgeStore.getDocumentById(orgId, id);
    if (!doc) {
      throw new NotFoundError(`Document with ID "${id}" was not found.`);
    }

    return reply.status(200).send(doc);
  });

  // 5. Delete Document by ID
  fastify.delete('/api/documents/:id', async (request, reply) => {
    const orgId = (request as { orgId?: string }).orgId || 'org-vayu-motors-dev';
    const { id } = request.params as { id: string };

    const deleted = await knowledgeStore.deleteDocument(orgId, id);
    if (!deleted) {
      throw new NotFoundError(`Document with ID "${id}" was not found.`);
    }

    return reply.status(200).send({ message: `Document "${id}" deleted cleanly.` });
  });
};
