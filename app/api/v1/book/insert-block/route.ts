import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookInsertBlockSchema } from '@/lib/server/schemas';
import type { BlockType } from '@/lib/deeptutor/services/book/models';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/insert-block
 * Body: { bookId, pageId, index, type, params }
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId, pageId, index, type, params } =
      await validatedBody(BookInsertBlockSchema, req);

    const engine = getBookEngine();
    const page = await engine.insertBlock(
      bookId,
      pageId,
      index ?? 0,
      type as BlockType,
      params ?? {},
    );

    if (!page) {
      return apiError('Page not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] insert-block error:', err);
    return apiError('Failed to insert block', 500);
  }
}
