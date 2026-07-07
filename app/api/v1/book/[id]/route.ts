import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getBookEngine } from '@/lib/deeptutor/bootstrap';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:book');

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/book/:id — Load a full book (manifest + spine + pages + progress)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const engine = getBookEngine();
    const result = await engine.getStorage().loadFullBook(id);

    if (!result) {
      return apiError('Book not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(result);
  } catch (err) {
    log.error('[book] GET :id error:', err);
    return apiError('Failed to load book', 500);
  }
}

/**
 * DELETE /api/v1/book/:id — Delete a book
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const engine = getBookEngine();
    const deleted = await engine.getStorage().deleteBook(id);

    if (!deleted) {
      return apiError('Book not found', 404, 'NOT_FOUND');
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    log.error('[book] DELETE :id error:', err);
    return apiError('Failed to delete book', 500);
  }
}
