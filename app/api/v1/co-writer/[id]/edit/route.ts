import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getEditAgent, getOperationHistory, getCoWriterStorage } from '@/lib/deeptutor/bootstrap';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/co-writer/:id/edit — AI-powered text editing
 * Body: { text, instruction, action, source?, kbName?, language? }
 *
 * Applies an AI edit action (rewrite/shorten/expand/summarize) to the text.
 * Records the operation in history and optionally updates the document.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { text, instruction, action, source, kbName, language } = body;

    // Validate required fields
    if (!text || !action) {
      return apiError('text and action are required', 400);
    }

    const validActions = ['rewrite', 'shorten', 'expand', 'summarize'];
    if (!validActions.includes(action)) {
      return apiError(`action must be one of: ${validActions.join(', ')}`, 400);
    }

    const agent = getEditAgent();
    const result = await agent.edit({
      text,
      instruction: instruction || '',
      action,
      source,
      kbName,
      language,
    });

    // Record operation in history
    const history = getOperationHistory();
    await history.add({
      id: result.operationId,
      action,
      instruction: instruction || '',
      originalLength: text.length,
      editedLength: result.editedText.length,
      timestamp: new Date().toISOString(),
    });

    // Optionally update the document with edited text
    if (id && result.editedText && !result.editedText.startsWith('[')) {
      const storage = getCoWriterStorage();
      await storage.updateDocument(id, { content: result.editedText });
    }

    return apiSuccess({
      editedText: result.editedText,
      operationId: result.operationId,
    });
  } catch (err) {
    console.error('[co-writer] POST :id/edit error:', err);
    return apiError('Edit operation failed', 500);
  }
}
