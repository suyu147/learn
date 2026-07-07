import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/compile-page
 * Body: { bookId, pageId }
 * Stage 3-4: Compile a single page (plan blocks → generate)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, pageId } = body;

    if (!bookId || !pageId) {
      return apiError('bookId and pageId are required', 400);
    }

    const engine = getBookEngine();
    const page = await engine.compilePage(bookId, pageId);

    if (!page) {
      return apiError('Page or chapter not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    console.error('[book] compile-page error:', err);
    return apiError('Failed to compile page', 500);
  }
}
