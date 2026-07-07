import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';

/**
 * GET /api/v1/book — List all books (summary view)
 */
export async function GET(_req: NextRequest) {
  try {
    const engine = getBookEngine();
    const books = await engine.getStorage().listBooks();
    return apiSuccess(books);
  } catch (err) {
    console.error('[book] GET error:', err);
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
    const body = await req.json();
    const { userIntent, chatSelections, notebookRefs, knowledgeBases } = body;

    if (!userIntent) {
      return apiError('userIntent is required', 400);
    }

    const engine = getBookEngine();
    const book = await engine.createBook(
      userIntent,
      { chatSelections, notebookRefs, knowledgeBases },
      (_event) => { /* SSE events handled by client */ },
    );

    return apiSuccess(book, 201);
  } catch (err) {
    console.error('[book] POST error:', err);
    return apiError('Failed to create book', 500);
  }
}
