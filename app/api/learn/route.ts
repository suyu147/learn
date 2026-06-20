import { NextRequest } from 'next/server';
import { compileLearningGraph } from '@/lib/learning-graph';
import type { LearnEvent, LearnRequest } from '@/lib/learning-graph';

export async function POST(request: NextRequest) {
  const body = await request.json() as LearnRequest;
  const graph = compileLearningGraph();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: LearnEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
        }
      };

      try {
        const eventStream = await graph.stream({
          action: body.action,
          sessionId: body.sessionId,
          profile: body.profile,
          goal: body.goal,
          completedNodes: body.completedNodes,
          currentNodeId: body.currentNodeId,
          quizResults: body.quizResults ?? [],
          message: body.message ?? '',
          conversationHistory: body.conversationHistory ?? [],
          attachedResources: body.attachedResources ?? [],
          currentNodeTitle: body.currentNodeTitle ?? null,
          aiConfig: {
            providerId: body.aiConfig?.providerId || process.env.AI_PROVIDER || undefined,
            modelId: body.aiConfig?.modelId || process.env.AI_MODEL_ID || process.env.AI_MODEL || undefined,
            apiKey: process.env.AI_API_KEY || body.aiConfig?.apiKey,
            baseUrl: process.env.AI_BASE_URL || body.aiConfig?.baseUrl,
          },
          resourceFeedback: body.resourceFeedback ?? [],
          nodeDecisionOverrides: body.nodeDecisionOverrides ?? {},
          currentNode: null,
          learnerSnapshot: null,
          resourcePlan: null,
          generatedResources: [],
          evaluationResult: null,
          evaluationScore: null,
          updatedProfile: null,
          pptScenes: null,
          phase: 'init',
        }, { configurable: { writer: write } });

        for await (const _event of eventStream) {
        }
      } catch (error) {
        write({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      } finally {
        write({ type: 'done' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
