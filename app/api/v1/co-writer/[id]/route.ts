import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getCoWriterStorage } from '@/lib/deeptutor/bootstrap';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/co-writer/:id — Load a single document
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const storage = getCoWriterStorage();
    const doc = await storage.loadDocument(id);

    if (!doc) {
      return apiError('Document not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(doc);
  } catch (err) {
    console.error('[co-writer] GET :id error:', err);
    return apiError('Failed to load document', 500);
  }
}

/**
 * PUT /api/v1/co-writer/:id — Update a document
 * Body: { title?: string, content?: string }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, content } = body;

    if (title === undefined && content === undefined) {
      return apiError('title or content is required', 400);
    }

    const storage = getCoWriterStorage();
    const doc = await storage.updateDocument(id, { title, content });

    if (!doc) {
      return apiError('Document not found', 404, 'NOT_FOUND');
    }

    return apiSuccess(doc);
  } catch (err) {
    console.error('[co-writer] PUT :id error:', err);
    return apiError('Failed to update document', 500);
  }
}

/**
 * DELETE /api/v1/co-writer/:id — Delete a document
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const storage = getCoWriterStorage();
    const deleted = await storage.deleteDocument(id);

    if (!deleted) {
      return apiError('Document not found', 404, 'NOT_FOUND');
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[co-writer] DELETE :id error:', err);
    return apiError('Failed to delete document', 500);
  }
}
