﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import type { ProviderId } from '@/lib/types/provider';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ProfileDimensions, ConversationMessage } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import profileChatPrompt from '@/lib/prompts/profile-chat-prompt.json';

const PROFILE_SYSTEM_PROMPT = profileChatPrompt.systemPrompt;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, profile, conversationHistory, aiConfig } = body as {
      message: string;
      profile: { dimensions: ProfileDimensions } | null;
      conversationHistory: ConversationMessage[];
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
    };

    const { model } = resolveModel({
      providerId: aiConfig?.providerId as ProviderId | undefined,
      modelString: aiConfig?.modelId,
      apiKey: aiConfig?.apiKey,
      baseUrl: aiConfig?.baseUrl,
    });

    const currentDimensions = profile?.dimensions || DEFAULT_DIMENSIONS;

    const chatMessages = [
      ...conversationHistory.slice(-10).map((m: ConversationMessage) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const result = streamLLM(
      {
        model,
        system: PROFILE_SYSTEM_PROMPT + `\n\n${JSON.stringify(currentDimensions, null, 2)}`,
        messages: chatMessages,
        maxOutputTokens: 2048,
      },
      'profile-chat',
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullContent = '';

        try {
          for await (const chunk of result.textStream) {
            fullContent += chunk;
          }

          const displayContent = fullContent;
          let inJsonBlock = false;
          let resultText = '';
          let i = 0;

          while (i < displayContent.length) {
            if (!inJsonBlock) {
              const jsonStart = displayContent.indexOf('```json', i);
              if (jsonStart === -1) {
                resultText += displayContent.slice(i);
                break;
              } else {
                resultText += displayContent.slice(i, jsonStart);
                i = jsonStart;
                inJsonBlock = true;
              }
            } else {
              const jsonEnd = displayContent.indexOf('```', i + 7);
              if (jsonEnd === -1) {
                break;
              } else {
                i = jsonEnd + 3;
                inJsonBlock = false;
              }
            }
          }

          const chunkSize = 20;
          for (let j = 0; j < resultText.length; j += chunkSize) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: resultText.slice(j, j + chunkSize) })}\n\n`),
            );
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // 尝试解析 JSON，支持两种格式：直接是 dimensions 或者包裹在 { dimensions: ... } 中
          let profileUpdate: ProfileDimensions | null = null;
          
          // 首先尝试直接解析
          const parsed = parseJsonResponse<Record<string, unknown>>(fullContent);
          
          if (parsed) {
            if (parsed.dimensions && typeof parsed.dimensions === 'object') {
              profileUpdate = parsed.dimensions as ProfileDimensions;
            } else if (parsed.knowledgeBase) {
              profileUpdate = parsed as unknown as ProfileDimensions;
            }
          }
          
          if (!profileUpdate) {
            const jsonMatch = fullContent.match(/\{[\s\S]*"knowledgeBase"[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
                if (extracted.dimensions && typeof extracted.dimensions === 'object') {
                  profileUpdate = extracted.dimensions as ProfileDimensions;
                } else if (extracted.knowledgeBase) {
                  profileUpdate = extracted as unknown as ProfileDimensions;
                }
              } catch (e) {
                console.error('Failed to parse extracted JSON:', e);
              }
            }
          }
          
          if (profileUpdate) {
            console.log('Profile updated successfully:', profileUpdate);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'profile_update', dimensions: profileUpdate })}\n\n`,
              ),
            );
          } else {
            console.log('No profile update found in response');
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
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
