import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookIdBodySchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/compile-all
 * Body: { bookId }
 * Compile all pending pages in a book
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId } = await validatedBody(BookIdBodySchema, req);

    const engine = getBookEngine();
    const result = await engine.compileAll(bookId);

    return apiSuccess(result);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] compile-all error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to compile all pages', 500);
  }
}
