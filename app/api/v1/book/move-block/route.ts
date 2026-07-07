import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/move-block
 * Body: { bookId, pageId, fromIndex, toIndex }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, pageId, fromIndex, toIndex } = body;

    if (!bookId || !pageId || fromIndex === undefined || toIndex === undefined) {
      return apiError('bookId, pageId, fromIndex, and toIndex are required', 400);
    }

    const engine = getBookEngine();
    const page = await engine.moveBlock(bookId, pageId, fromIndex, toIndex);

    if (!page) {
      return apiError('Page or block not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    console.error('[book] move-block error:', err);
    return apiError('Failed to move block', 500);
  }
}
