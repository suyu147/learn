import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * POST /api/v1/book/confirm-proposal
 * Body: { bookId }
 * Stage 2: Confirm proposal → generate spine via SpineSynthesizer
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId } = body;

    if (!bookId) {
      return apiError('bookId is required', 400);
    }

    const engine = getBookEngine();
    const result = await engine.confirmProposal(bookId);

    return apiSuccess({
      book: result.book,
      chapterCount: result.spine.chapters.length,
    });
  } catch (err) {
    console.error('[book] confirm-proposal error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to confirm proposal', 500);
  }
}
