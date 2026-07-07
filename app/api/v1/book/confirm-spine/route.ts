import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/confirm-spine
 * Body: { bookId }
 * Stage 2.5: Confirm spine → create page shells + overview
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId } = body;

    if (!bookId) {
      return apiError('bookId is required', 400);
    }

    const engine = getBookEngine();
    const result = await engine.confirmSpine(bookId);

    return apiSuccess({
      book: result.book,
      pageCount: result.pages.length,
    });
  } catch (err) {
    console.error('[book] confirm-spine error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to confirm spine', 500);
  }
}
