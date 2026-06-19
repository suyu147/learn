import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import type { ProviderId } from '@/lib/types/provider';
import type { ResourceType } from '@/lib/types/resource';
import tutorChatPrompt from '@/lib/prompts/tutor-chat-prompt.json';

const TUTOR_SYSTEM_PROMPT = tutorChatPrompt.systemPrompt;

interface AttachedResourcePayload {
  id: string;
  type: ResourceType;
  title: string;
  content: string;
}

function buildAttachedContext(
  attachedResources: AttachedResourcePayload[] | undefined,
  currentNodeTitle?: string,
) {
  if (!attachedResources || attachedResources.length === 0) {
    return '';
  }

  return [
    '以下是用户本轮主动附加给你的学习上下文，请优先结合这些材料回答：',
    currentNodeTitle ? `当前学习节点: ${currentNodeTitle}` : '',
    ...attachedResources.map((resource, index) => [
      `资源 ${index + 1}: ${resource.title}`,
      `类型: ${resource.type}`,
      '内容摘录:',
      resource.content,
    ].filter(Boolean).join('\n')),
  ].filter(Boolean).join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, attachedResources, currentNodeTitle, aiConfig } = body as {
      message: string;
      conversationHistory: { role: string; content: string; attachedResourceIds?: string[] }[];
      attachedResources?: AttachedResourcePayload[];
      currentNodeTitle?: string;
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
    };

    const { model } = resolveModel({
      providerId: aiConfig?.providerId as ProviderId | undefined,
      modelString: aiConfig?.modelId,
      apiKey: aiConfig?.apiKey,
      baseUrl: aiConfig?.baseUrl,
    });

    const attachedContext = buildAttachedContext(attachedResources, currentNodeTitle);
    const chatMessages = [
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: attachedContext ? `${attachedContext}\n\n用户问题: ${message}` : message,
      },
    ];

    const result = streamLLM(
      {
        model,
        system: TUTOR_SYSTEM_PROMPT,
        messages: chatMessages,
        maxOutputTokens: 2048,
      },
      'tutor-chat',
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_start', agent: 'tutor' })}\n\n`,
            ),
          );

          for await (const chunk of result.textStream) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text_delta', text: chunk })}\n\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_end', agent: 'tutor' })}\n\n`,
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
