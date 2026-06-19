import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import type { ProviderId } from '@/lib/types/provider';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ProfileDimensions } from '@/lib/types/profile';
import type { LearningPath, LearningPathNode } from '@/lib/types/learning-path';
import type { Resource, ResourceType } from '@/lib/types/resource';
import pathPlanPrompt from '@/lib/prompts/path-plan-prompt.json';

const PATH_SYSTEM_PROMPT = pathPlanPrompt.systemPrompt;

interface AvailableResource {
  id: string;
  type: ResourceType;
  title: string;
  knowledgePoints?: string[];
}

function buildResourcePrompt(resources: AvailableResource[]): string {
  if (!resources || resources.length === 0) return '';

  const lines = resources.map((r) => {
    const kpStr = r.knowledgePoints && r.knowledgePoints.length > 0
      ? ` (知识点: ${r.knowledgePoints.join(', ')})`
      : '';
    return `- [${r.type}] ${r.title} (id: ${r.id})${kpStr}`;
  });

  return `\n\n可用学习资源：\n${lines.join('\n')}\n请在规划路径时，将相关资源关联到对应的知识节点中。对于quiz类型的资源，请将其id填入对应节点的quizId字段。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goal, profile, aiConfig, resources } = body as {
      goal: string;
      profile: ProfileDimensions | null;
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
      resources?: AvailableResource[];
    };

    const { model } = resolveModel({
      providerId: aiConfig?.providerId as ProviderId | undefined,
      modelString: aiConfig?.modelId,
      apiKey: aiConfig?.apiKey,
      baseUrl: aiConfig?.baseUrl,
    });

    const profileContext = profile
      ? `\n\n${JSON.stringify(profile, null, 2)}`
      : '\n\nNo profile available, plan for beginner level';

    const resourcePrompt = buildResourcePrompt(resources || []);

    const result = streamLLM(
      {
        model,
        system: PATH_SYSTEM_PROMPT,
        prompt: `${goal}${profileContext}${resourcePrompt}`,
        maxOutputTokens: 4096,
      },
      'path-plan',
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullContent = '';

        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_start', agent: 'path' })}\n\n`,
            ),
          );

          for await (const chunk of result.textStream) {
            fullContent += chunk;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text_delta', text: chunk })}\n\n`,
              ),
            );
          }

          const pathData = parseJsonResponse<{
            goal: string;
            estimatedDays: number;
            nodes: LearningPathNode[];
            edges: { from: string; to: string }[];
          }>(fullContent);

          if (pathData) {
            const learningPath: LearningPath = {
              id: crypto.randomUUID(),
              userId: 'current',
              goal: pathData.goal || goal,
              nodes: pathData.nodes || [],
              edges: pathData.edges || [],
              estimatedDays: pathData.estimatedDays || 30,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'path_update', path: learningPath })}\n\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_end', agent: 'path' })}\n\n`,
            ),
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`,
            ),
          );
        } finally {
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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: String(error) } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
