import { NextRequest, NextResponse } from 'next/server';
import { compileLearningGraph } from '@/lib/learning-graph/graph';
import { createLearnEventWriter } from '@/lib/deeptutor/capabilities/smartlearn/event-mapper';
import { createStreamEvent } from '@/lib/deeptutor/core/types';
import type { LearnRequest } from '@/lib/learning-graph/types';
import type { LearningStateType } from '@/lib/learning-graph/state';
import { createLogger } from '@/lib/logger';
import { validatedBody, errorToMessage, isValidationError, isSyntaxError } from '@/lib/server/validate';
import { SmartLearnRequestSchema } from '@/lib/server/schemas';

import { authenticate } from '@/lib/deeptutor/services/auth';

const log = createLogger('api:smartlearn');

export async function GET(_req: NextRequest) {
  // TODO: Implement list smartlearn sessions
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(req: NextRequest) {
  try {
    const validated = await validatedBody(SmartLearnRequestSchema, req);
    const body = validated as unknown as LearnRequest;

    const userId = await (async () => {
      try { return (await authenticate(req)).id; } catch { return 'anonymous'; }
    })();

    const sessionId = body.sessionId;
    const turnId = `turn_${Date.now()}`;

    log.info(`SmartLearn POST: sessionId=${sessionId}, action=${body.action}`);

    // Build initial learning state from the request
    const initialState: Partial<LearningStateType> = {
      action: body.action,
      sessionId,
      profile: body.profile ?? {},
      goal: body.goal,
      completedNodes: body.completedNodes ?? [],
      currentNodeId: body.currentNodeId ?? null,
      quizResults: body.quizResults ?? [],
      message: body.message ?? '',
      conversationHistory: body.conversationHistory ?? [],
      attachedResources: body.attachedResources ?? [],
      currentNodeTitle: body.currentNodeTitle ?? null,
      aiConfig: body.aiConfig ?? undefined,
      resourceFeedback: body.resourceFeedback ?? [],
      nodeDecisionOverrides: body.nodeDecisionOverrides ?? {},
      // Fields populated by graph nodes
      currentNode: null,
      learnerSnapshot: null,
      resourcePlan: null,
      generatedResources: [],
      evaluationResult: null,
      evaluationScore: null,
      evaluationFeedback: null,
      updatedProfile: null,
      pptScenes: null,
      phase: '',
    };

    // Compile graph once per request
    const graph = compileLearningGraph();

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create the LearnEvent → StreamEvent → SSE bridge
          const emit = (event: import('@/lib/deeptutor/core/types').StreamEvent) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          const learnEventWriter = createLearnEventWriter(emit, sessionId, turnId, 'smartlearn');

          // Invoke the learning graph with the writer callback
          await graph.invoke(initialState as LearningStateType, {
            configurable: {
              writer: learnEventWriter,
              sessionId,
              turnId,
              userId,
            },
          });

          // Emit final done event
          const doneEvent = createStreamEvent('done', { sessionId, turnId, source: 'smartlearn' });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

          controller.close();
          log.info(`SmartLearn stream completed: sessionId=${sessionId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.error(`SmartLearn stream error: sessionId=${sessionId}`, err);

          const errorEvent = createStreamEvent('error', {
            sessionId,
            turnId,
            source: 'smartlearn',
            content: `SmartLearn error: ${message}`,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));

          const doneEvent = createStreamEvent('done', { sessionId, turnId, source: 'smartlearn' });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    if (isValidationError(err) || isSyntaxError(err)) {
      return NextResponse.json(
        { success: false, error: errorToMessage(err) },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error('SmartLearn POST handler error:', err);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${message}` },
      { status: 500 },
    );
  }
}
