import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import type { BlockType } from '@/lib/deeptutor/services/book/models';

/**
 * POST /api/v1/book/insert-block
 * Body: { bookId, pageId, index, type, params }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, pageId, index, type, params } = body;

    if (!bookId || !pageId || type === undefined) {
      return apiError('bookId, pageId, and type are required', 400);
    }

    const engine = getBookEngine();
    const page = await engine.insertBlock(
      bookId,
      pageId,
      index ?? 0,
      type as BlockType,
      params ?? {},
    );

    if (!page) {
      return apiError('Page not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    console.error('[book] insert-block error:', err);
    return apiError('Failed to insert block', 500);
  }
}
