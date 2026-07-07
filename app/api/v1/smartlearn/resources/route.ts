import { NextRequest, NextResponse } from 'next/server';
import { compileLearningGraph } from '@/lib/learning-graph/graph';
import { createLearnEventWriter } from '@/lib/deeptutor/capabilities/smartlearn/event-mapper';
import { createStreamEvent } from '@/lib/deeptutor/core/types';
import type { ProfileDimensions } from '@/lib/types/profile';
import type { LearningPathNode } from '@/lib/types/learning-path';
import type { PriorNodeFeedback } from '@/lib/generation/resource-decision';
import type { ResourceType } from '@/lib/types/resource';
import type { LearningStateType } from '@/lib/learning-graph/state';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:smartlearn:resources');

interface ResourceGenerationRequest {
  sessionId?: string;
  profile: ProfileDimensions;
  goal: string;
  completedNodes?: LearningPathNode[];
  currentNodeId?: string | null;
  currentNodeTitle?: string;
  resourceFeedback?: PriorNodeFeedback[];
  nodeDecisionOverrides?: Record<string, ResourceType[]>;
  aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResourceGenerationRequest;

    // Validate required fields
    if (!body.profile || !body.goal) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: profile, goal' },
        { status: 400 },
      );
    }

    const sessionId = body.sessionId ?? `res_${Date.now()}`;
    const turnId = `turn_res_${Date.now()}`;

    log.info(`Resources POST: sessionId=${sessionId}, goal="${body.goal.slice(0, 60)}"`);

    // Build initial state — delegate to the learning graph with action: 'start'
    // The graph's plan → analyze → resource_plan → generate flow will produce resources
    const initialState: Partial<LearningStateType> = {
      action: 'start',
      sessionId,
      profile: body.profile,
      goal: body.goal,
      completedNodes: body.completedNodes ?? [],
      currentNodeId: body.currentNodeId ?? null,
      quizResults: [],
      message: '',
      conversationHistory: [],
      attachedResources: [],
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

    const graph = compileLearningGraph();

    // Create SSE stream for resource generation results
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const emit = (event: import('@/lib/deeptutor/core/types').StreamEvent) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          const learnEventWriter = createLearnEventWriter(emit, sessionId, turnId, 'smartlearn:resources');

          await graph.invoke(initialState as LearningStateType, {
            configurable: {
              writer: learnEventWriter,
              sessionId,
              turnId,
            },
          });

          const doneEvent = createStreamEvent('done', { sessionId, turnId, source: 'smartlearn:resources' });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

          controller.close();
          log.info(`Resources stream completed: sessionId=${sessionId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.error(`Resources stream error: sessionId=${sessionId}`, err);

          const errorEvent = createStreamEvent('error', {
            sessionId,
            turnId,
            source: 'smartlearn:resources',
            content: `Resource generation error: ${message}`,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));

          const doneEvent = createStreamEvent('done', { sessionId, turnId, source: 'smartlearn:resources' });
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
    const message = err instanceof Error ? err.message : String(err);
    log.error('Resources POST handler error:', err);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${message}` },
      { status: 500 },
    );
  }
}
