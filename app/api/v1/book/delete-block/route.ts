import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookDeleteBlockSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/delete-block
 * Body: { bookId, pageId, blockIndex }
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId, pageId, blockIndex } =
      await validatedBody(BookDeleteBlockSchema, req);

    const engine = getBookEngine();
    const page = await engine.deleteBlock(bookId, pageId, blockIndex);

    if (!page) {
      return apiError('Page or block not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] delete-block error:', err);
    return apiError('Failed to delete block', 500);
  }
}
