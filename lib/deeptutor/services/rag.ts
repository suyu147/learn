/**
 * RAGService — Knowledge base vector retrieval
 *
 * Performs semantic search across knowledge base documents using
 * cosine similarity computed in TypeScript. Embeddings are stored
 * as JSON arrays in the database.
 *
 * Phase 2b: JSON-based vector storage + JS cosine similarity.
 * When pgvector is available, the vectorSearch method can be
 * replaced with raw SQL using the <=> operator for better performance.
 * BM25 hybrid retrieval deferred to Phase 5.
 */

import { prisma } from '@/lib/db/client';
import { createLogger } from '@/lib/logger';
import type { EmbeddingServiceImpl } from './embedding';

const log = createLogger('RAGService');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RAGSearchResult {
  /** The original query */
  query: string;
  /** Concatenated context from all retrieved chunks */
  context: string;
  /** Individual retrieved chunks with scores and metadata */
  sources: RAGSource[];
}

export interface RAGSource {
  /** Chunk ID */
  chunkId: string;
  /** Document ID */
  documentId: string;
  /** Document title */
  documentTitle: string;
  /** Chunk text content */
  content: string;
  /** Similarity score (0-1, higher is better) */
  score: number;
  /** Chunk index within document */
  chunkIndex: number;
  /** Additional metadata (page, source, etc.) */
  metadata: Record<string, unknown>;
}

export interface RAGSearchOptions {
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.3) */
  minScore?: number;
  /** Whether to apply reranking (default: true) */
  rerank?: boolean;
  /** Maximum context length in characters (default: 8000) */
  maxContextLength?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_MAX_CONTEXT_LENGTH = 8000;

// Fetch more candidates than needed for better reranking
const CANDIDATE_MULTIPLIER = 3;

// ---------------------------------------------------------------------------
// RAGService
// ---------------------------------------------------------------------------

export class RAGServiceImpl {
  private embeddingService: EmbeddingServiceImpl;

  constructor(embeddingService: EmbeddingServiceImpl) {
    this.embeddingService = embeddingService;
  }

  /**
   * Search knowledge bases for relevant chunks.
   *
   * @param query     — The search query
   * @param kbIds     — Knowledge base IDs to search across
   * @param options   — Search options (topK, minScore, etc.)
   */
  async search(
    query: string,
    kbIds: string[],
    options: RAGSearchOptions = {},
  ): Promise<RAGSearchResult> {
    const topK = options.topK ?? DEFAULT_TOP_K;
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    const maxContextLength = options.maxContextLength ?? DEFAULT_MAX_CONTEXT_LENGTH;

    if (kbIds.length === 0) {
      return { query, context: '', sources: [] };
    }

    // 1. Embed the query
    const queryEmbedding = await this.embeddingService.embedOne(query);

    // 2. Fetch candidate chunks and compute cosine similarity in JS
    const candidateLimit = topK * CANDIDATE_MULTIPLIER;
    const candidates = await this.vectorSearch(queryEmbedding, kbIds, candidateLimit);

    // 3. Filter by minimum score
    const filtered = candidates.filter((c) => c.score >= minScore);

    if (filtered.length === 0) {
      log.info(`No results above threshold ${minScore} for query: "${query.slice(0, 50)}..."`);
      return { query, context: '', sources: [] };
    }

    // 4. Take top K
    const results = filtered.slice(0, topK);

    // 5. Build context string
    const context = this.buildContext(results, maxContextLength);

    return {
      query,
      context,
      sources: results,
    };
  }

  /**
   * Search a single KB by name. Convenience wrapper.
   */
  async searchByName(
    query: string,
    kbName: string,
    userId: string,
    options: RAGSearchOptions = {},
  ): Promise<RAGSearchResult> {
    const kb = await prisma.dtKnowledgeBase.findFirst({
      where: { userId, name: kbName, status: 'ready' },
    });
    if (!kb) {
      return { query, context: '', sources: [] };
    }
    return this.search(query, [kb.id], options);
  }

  // -------------------------------------------------------------------------
  // Vector Search (TypeScript cosine similarity)
  // -------------------------------------------------------------------------

  /**
   * Fetch chunks from the database and rank by cosine similarity.
   * Embeddings are stored as JSON arrays; similarity is computed in JS.
   *
   * When pgvector is available, replace this method with:
   *   SELECT ... ORDER BY c.embedding <=> $1::vector LIMIT $N
   */
  private async vectorSearch(
    queryVector: number[],
    kbIds: string[],
    limit: number,
  ): Promise<RAGSource[]> {
    try {
      // 1. Find all ready documents in the specified KBs
      const documents = await prisma.dtDocument.findMany({
        where: { kbId: { in: kbIds }, status: 'ready' },
        select: { id: true, title: true },
      });

      if (documents.length === 0) {
        return [];
      }

      const docMap = new Map(documents.map((d) => [d.id, d.title]));
      const docIds = documents.map((d) => d.id);

      // 2. Fetch chunks with embeddings from these documents
      const chunks = await prisma.dtDocumentChunk.findMany({
        where: { documentId: { in: docIds } },
        take: limit * 5,
      });

      // 3. Compute cosine similarity for each chunk with a valid embedding
      const scored: RAGSource[] = [];

      for (const chunk of chunks) {
        if (!chunk.embedding) continue;

        const chunkVector = chunk.embedding as unknown as number[];
        if (!Array.isArray(chunkVector) || chunkVector.length === 0) continue;

        const score = cosineSimilarity(queryVector, chunkVector);
        const docTitle = docMap.get(chunk.documentId) ?? 'Unknown';

        scored.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: docTitle,
          content: chunk.content,
          score,
          chunkIndex: chunk.chunkIndex,
          metadata: (chunk.metadata as Record<string, unknown>) ?? {},
        });
      }

      // 4. Sort by score descending and take top N
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit);
    } catch (err) {
      log.error('Vector search failed:', err);
      throw new RAGError(`Vector search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Context Building
  // -------------------------------------------------------------------------

  /**
   * Build a context string from retrieved chunks.
   * Truncates to maxContextLength if needed.
   */
  private buildContext(sources: RAGSource[], maxLength: number): string {
    const parts: string[] = [];
    let totalLength = 0;

    for (const source of sources) {
      const header = `[Source: ${source.documentTitle}, Chunk ${source.chunkIndex + 1}]`;
      const block = `${header}\n${source.content}\n`;

      if (totalLength + block.length > maxLength) {
        // Truncate this chunk to fit
        const remaining = maxLength - totalLength;
        if (remaining > 100) {
          parts.push(block.slice(0, remaining) + '\n[... truncated]');
        }
        break;
      }

      parts.push(block);
      totalLength += block.length;
    }

    return parts.join('\n---\n\n');
  }
}

// ---------------------------------------------------------------------------
// Cosine Similarity
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (higher = more similar).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class RAGError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RAGError';
  }
}

// Re-export interface for backward compatibility
export interface RAGService {
  search(query: string, kbNames: string[], topK?: number): Promise<Record<string, unknown>[]>;
}
