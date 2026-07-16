import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createBookEngineWithConfig } from '@/lib/deeptutor/bootstrap';
import { resolveBookEngineConfigFromHeaders } from '@/lib/server/resolve-model';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookCompilePageSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * POST /api/v1/book/compile-page
 * Body: { bookId, pageId }
 * Stage 3-4: Compile a single page (plan blocks → generate)
 */
export async function POST(req: NextRequest) {
  try {
    const { bookId, pageId } = await validatedBody(BookCompilePageSchema, req);

    const config = resolveBookEngineConfigFromHeaders(req);
    const engine = createBookEngineWithConfig(config);
    const page = await engine.compilePage(bookId, pageId);

    if (!page) {
      return apiError('Page or chapter not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(page);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] compile-page error:', err);
    return apiError('Failed to compile page', 500);
  }
}
