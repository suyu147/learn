/**
 * POST /api/v1/turns — SSE streaming turn endpoint
 *
 * Creates a new turn, opens a ReadableStream, and pipes StreamBus events
 * as Server-Sent Events back to the client.
 *
 * Phase 2a: Wires into the real ChatOrchestrator → ChatCapability → AgentLoop.
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { StreamBusImpl } from '@/lib/deeptutor/core/stream-bus';
import type { StreamEvent } from '@/lib/deeptutor/core/types';
import { createUnifiedContext } from '@/lib/deeptutor/core/types';
import {
  createTurn,
  addMessage,
  updateTurnStatus,
  ensureSession,
} from '@/lib/deeptutor/services/session';
import { getOrchestrator } from '@/lib/deeptutor/bootstrap';

const log = createLogger('TurnsRoute');

/** SSE wire format envelope */
interface SSEEnvelope {
  type: string;
  data: StreamEvent;
}

/** Encode a StreamEvent as an SSE `data:` line */
function encodeSSE(event: StreamEvent): string {
  const envelope: SSEEnvelope = { type: event.type, data: event };
  return `data: ${JSON.stringify(envelope)}\n\n`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // --- Parse & validate request body ---
  let body;
  try {
    const { validatedBody } = await import('@/lib/server/validate');
    const { TurnCreateSchema } = await import('@/lib/server/schemas');
    body = await validatedBody(TurnCreateSchema, req);
  } catch (err) {
    const { isValidationError, isSyntaxError, errorToMessage } = await import('@/lib/server/validate');
    if (isValidationError(err) || isSyntaxError(err)) {
      return new Response(
        JSON.stringify({ error: errorToMessage(err) }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    sessionId,
    message,
    capability,
    enabledTools,
    knowledgeBases,
    attachments,
    language,
    providerId,
    modelId,
    apiKey,
    baseUrl,
    conversationHistory,
  } = body;

  // --- Resolve user identity (placeholder — replace with real auth in Phase 1.2) ---
  const userId = req.headers.get('x-user-id') ?? 'anonymous';

  // --- Resolve model config (from request → DT_ env → AI_ env → defaults) ---
  const effectiveProviderId = providerId || process.env.DT_DEFAULT_PROVIDER || process.env.AI_PROVIDER || 'openai';
  const effectiveModelId = modelId || process.env.DT_DEFAULT_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
  const effectiveApiKey = apiKey || process.env.DT_DEFAULT_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const effectiveBaseUrl = baseUrl || process.env.AI_BASE_URL || undefined;

  if (!effectiveApiKey) {
    return new Response(
      JSON.stringify({
        error: 'No API key provided. Set apiKey in the request body or DT_DEFAULT_API_KEY/OPENAI_API_KEY env var.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- Ensure session exists & create turn ---
  try {
    await ensureSession(sessionId, userId);
  } catch (err) {
    log.error('Failed to ensure session:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to ensure session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const turnId = await createTurn(sessionId, { capability });
  log.info(`Turn ${turnId} created for session ${sessionId}`);

  // --- Build UnifiedContext ---
  const context = createUnifiedContext({
    sessionId,
    userMessage: message,
    conversationHistory: conversationHistory ?? [],
    enabledTools: enabledTools ?? null,
    activeCapability: capability ?? null,
    knowledgeBases: knowledgeBases ?? [],
    language: language ?? 'en',
    configOverrides: {
      providerId: effectiveProviderId,
      modelId: effectiveModelId,
      apiKey: effectiveApiKey,
      baseUrl: effectiveBaseUrl,
    },
  });

  // --- Build SSE ReadableStream ---
  let assistantContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to push an encoded SSE event
      const push = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      // Collect assistant content from content events
      const wrappedPush = (event: StreamEvent) => {
        if (event.type === 'content' && event.content) {
          assistantContent += event.content;
        }
        push(event);
      };

      try {
        // Persist user message
        await addMessage(sessionId, userId, 'user', message, {
          capability: capability ?? undefined,
          turnId,
          attachments: attachments as Record<string, unknown>[] | undefined,
          metadata: { language: language ?? 'en' },
        });

        // Execute turn via orchestrator
        const orchestrator = getOrchestrator();
        const result = await orchestrator.executeTurn(
          context,
          wrappedPush,
          sessionId,
          userId,
        );

        // Persist assistant message
        if (assistantContent) {
          await addMessage(sessionId, userId, 'assistant', assistantContent, {
            capability: capability ?? undefined,
            turnId,
          });
        }

        // Update turn status
        const status = result.status === 'failed' ? 'failed' : 'completed';
        await updateTurnStatus(turnId, status, {
          error: result.error ?? undefined,
        });
      } catch (err) {
        log.error(`Turn ${turnId} failed:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Emit error event
        const errorEvent: StreamEvent = {
          type: 'error',
          source: 'turns-route',
          stage: '',
          content: errorMessage,
          metadata: {},
          sessionId,
          turnId,
          seq: 0,
          timestamp: Date.now() / 1000,
        };
        push(errorEvent);

        // Mark turn as failed
        await updateTurnStatus(turnId, 'failed', { error: errorMessage }).catch(
          (e) => log.error('Failed to update turn status to failed:', e),
        );

        // Persist partial assistant content if any
        if (assistantContent) {
          await addMessage(sessionId, userId, 'assistant', assistantContent, {
            capability: capability ?? undefined,
            turnId,
            metadata: { partial: true, error: errorMessage },
          }).catch(() => {});
        }
      } finally {
        controller.close();
      }
    },

    cancel() {
      // Client disconnected — cancel the turn
      log.info(`Client disconnected, cancelling turn ${turnId}`);
      updateTurnStatus(turnId, 'cancelled').catch((e) =>
        log.error('Failed to cancel turn on disconnect:', e),
      );
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
