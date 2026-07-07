import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookIdBodySchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/confirm-spine
 * Body: { bookId }
 * Stage 2.5: Confirm spine → create page shells + overview
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId } = await validatedBody(BookIdBodySchema, req);

    const engine = getBookEngine();
    const result = await engine.confirmSpine(bookId);

    return apiSuccess({
      book: result.book,
      pageCount: result.pages.length,
    });
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] confirm-spine error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to confirm spine', 500);
  }
}
