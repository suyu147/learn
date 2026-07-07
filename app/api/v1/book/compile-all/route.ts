import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/compile-all
 * Body: { bookId }
 * Compile all pending pages in a book
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId } = body;

    if (!bookId) {
      return apiError('bookId is required', 400);
    }

    const engine = getBookEngine();
    const result = await engine.compileAll(bookId);

    return apiSuccess(result);
  } catch (err) {
    console.error('[book] compile-all error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to compile all pages', 500);
  }
}
