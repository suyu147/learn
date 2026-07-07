import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/delete-block
 * Body: { bookId, pageId, blockIndex }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, pageId, blockIndex } = body;

    if (!bookId || !pageId || blockIndex === undefined) {
      return apiError('bookId, pageId, and blockIndex are required', 400);
    }

    const engine = getBookEngine();
    const page = await engine.deleteBlock(bookId, pageId, blockIndex);

    if (!page) {
      return apiError('Page or block not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    console.error('[book] delete-block error:', err);
    return apiError('Failed to delete block', 500);
  }
}
