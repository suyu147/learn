import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getCoWriterStorage } from '@/lib/deeptutor/bootstrap';

/**
 * GET /api/v1/co-writer — List all documents (summary view)
 */
export async function GET(_req: NextRequest) {
  try {
    const storage = getCoWriterStorage();
    const docs = await storage.listDocuments();
    return apiSuccess(docs);
  } catch (err) {
    console.error('[co-writer] GET error:', err);
    return apiError('Failed to list documents', 500);
  }
}

/**
 * POST /api/v1/co-writer — Create a new document
 * Body: { title?: string, content?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title = '', content = '' } = body;

    if (!title && !content) {
      return apiError('title or content is required', 400);
    }

    const storage = getCoWriterStorage();
    const doc = await storage.createDocument(title, content);
    return apiSuccess(doc, 201);
  } catch (err) {
    console.error('[co-writer] POST error:', err);
    return apiError('Failed to create document', 500);
  }
}
