import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getCoWriterStorage } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { CoWriterCreateSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:co-writer');

/**
 * GET /api/v1/co-writer — List all documents (summary view)
 */
export async function GET(_req: NextRequest) {
  try {
    const storage = getCoWriterStorage();
    const docs = await storage.listDocuments();
    return apiSuccess(docs);
  } catch (err) {
    log.error('[co-writer] GET error:', err);
    return apiError('Failed to list documents', 500);
  }
}

/**
 * POST /api/v1/co-writer — Create a new document
 * Body: { title?: string, content?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { title, content } = await validatedBody(CoWriterCreateSchema, req);

    const storage = getCoWriterStorage();
    const doc = await storage.createDocument(title ?? '', content ?? '');
    return apiSuccess(doc, 201);
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[co-writer] POST error:', err);
    return apiError('Failed to create document', 500);
  }
}
