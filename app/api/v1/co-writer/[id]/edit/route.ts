import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getEditAgent, getOperationHistory, getCoWriterStorage } from '@/lib/deeptutor/bootstrap';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { CoWriterEditSchema } from '@/lib/server/schemas';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:co-writer');

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
    const { text, instruction, action, source, kbName, language } =
      await validatedBody(CoWriterEditSchema, req);

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
    if (isValidationError(err) || isSyntaxError(err)) {
      return apiError(errorToMessage(err), 400);
    }
    log.error('[co-writer] POST :id/edit error:', err);
    return apiError('Edit operation failed', 500);
  }
}
