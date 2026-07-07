import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookMoveBlockSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/move-block
 * Body: { bookId, pageId, fromIndex, toIndex }
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId, pageId, fromIndex, toIndex } =
      await validatedBody(BookMoveBlockSchema, req);

    const engine = getBookEngine();
    const page = await engine.moveBlock(bookId, pageId, fromIndex, toIndex);

    if (!page) {
      return apiError('Page or block not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] move-block error:', err);
    return apiError('Failed to move block', 500);
  }
}
