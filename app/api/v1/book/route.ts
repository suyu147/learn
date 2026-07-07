import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { BookCreateSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

/**
 * GET /api/v1/book — List all books (summary view)
 */
export async function GET(_req: NextRequest) {
  try {
    const engine = getBookEngine();
    const books = await engine.getStorage().listBooks();
    return apiSuccess(books);
  } catch (err) {
    log.error('[book] GET error:', err);
    return apiError('Failed to list books', 500);
  }
}

/**
 * POST /api/v1/book — Stage 1: Create a new book
 * Body: { userIntent, chatSelections?, notebookRefs?, knowledgeBases? }
 * Streams progress events via SSE.
 */
export async function POST(req: NextRequest) {
  try {
    const { userIntent, chatSelections, notebookRefs, knowledgeBases } =
      await validatedBody(BookCreateSchema, req);

    const engine = getBookEngine();
    const book = await engine.createBook(
      userIntent,
      { chatSelections, notebookRefs, knowledgeBases },
      (_event) => { /* SSE events handled by client */ },
    );

    return apiSuccess(book, 201);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[book] POST error:', err);
    return apiError('Failed to create book', 500);
  }
}
