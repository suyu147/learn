import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import tutorChatPrompt from '@/lib/prompts/tutor-chat-prompt.json';
import type { ProviderId } from '@/lib/types/provider';
import type { ResourceType } from '@/lib/types/resource';

const TUTOR_SYSTEM_PROMPT = tutorChatPrompt.systemPrompt;

interface AttachedResourcePayload {
  id: string;
  type: ResourceType;
  title: string;
  content: string;
}

function buildAttachedContext(attachedResources: AttachedResourcePayload[] | undefined, currentNodeTitle?: string) {
  if (!attachedResources || attachedResources.length === 0) return '';
  return ['以下是用户本轮主动附加给你的学习上下文，请优先结合这些材料回答：', currentNodeTitle ? `当前学习节点: ${currentNodeTitle}` : '', ...attachedResources.map((resource, index) => [`资源 ${index + 1}: ${resource.title}`, `类型: ${resource.type}`, '内容摘录:', resource.content].join('\n'))].filter(Boolean).join('\n\n');
}

export function streamTutorResponse(message: string, conversationHistory: { role: string; content: string }[], attachedResources: AttachedResourcePayload[] | undefined, currentNodeTitle: string | undefined, aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
  const { model } = resolveModel({
    providerId: aiConfig?.providerId as ProviderId | undefined,
    modelId: aiConfig?.modelId,
    apiKey: aiConfig?.apiKey,
    baseUrl: aiConfig?.baseUrl,
  });
  const attachedContext = buildAttachedContext(attachedResources, currentNodeTitle);
  const messages = [...conversationHistory.slice(-10).map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content })), { role: 'user' as const, content: attachedContext ? `${attachedContext}\n\n用户问题: ${message}` : message }];
  return streamLLM({ model, system: TUTOR_SYSTEM_PROMPT, messages, maxOutputTokens: 2048 }, 'learn-tutor');
}
