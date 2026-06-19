import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import {
  decideNodeResourcePlan,
  type DecisionInputV2,
  type ResourceDecisionResultV2,
} from '@/lib/generation/resource-decision';
import { resolveModel } from '@/lib/server/resolve-model';
import { createLogger } from '@/lib/logger';
import type { ProviderId } from '@/lib/types/provider';
import type { ResourceType } from '@/lib/types/resource';

const log = createLogger('ResourceDecisionAPI');

interface LLMDecisionPayload {
  items?: Array<{
    type: ResourceType;
    action: 'generate' | 'skip' | 'replace' | 'keep';
    reason: string;
    confidence?: number;
  }>;
}

function formatConstraintTypes(types?: ResourceType[]): string {
  return types && types.length > 0 ? types.join('、') : '无';
}

function buildPrompt(input: DecisionInputV2, basePlan: ResourceDecisionResultV2) {
  const preferredFormats = input.profile?.interests?.preferredFormats ?? [];
  const knowledgeLevel = input.profile?.knowledgeBase.level ?? 'beginner';
  const existingTypes = input.existingResources?.map((resource) => resource.type) ?? [];
  const allowedTypes = ['document', 'mindmap', 'quiz', 'video', 'code', 'reading', 'ppt'];
  const forceInclude = input.constraints?.forceInclude ?? [];
  const forceExclude = input.constraints?.forceExclude ?? [];

  return [
    '你是学习资源决策助手，只负责决定某个学习节点应该生成哪些资源，不要生成资源内容。',
    '请只输出 JSON，对每个资源类型给出 generate 或 skip，并给出简短 reason。',
    '不要输出 markdown，不要解释额外文字。',
    '必须严格遵守系统约束：forceInclude 中的类型只能是 generate，forceExclude 中的类型只能是 skip。',
    '如果某个资源类型已经被系统约束固定，就不要改写它的方向，只能补充更具体的原因。',
    '',
    `节点标题: ${input.node.nodeTitle}`,
    `知识点: ${input.node.knowledgePoints.join('、')}`,
    `节点位置: ${input.node.nodeIndex + 1}/${input.node.totalNodes}`,
    `用户知识水平: ${knowledgeLevel}`,
    `用户偏好格式: ${preferredFormats.join('、') || '无'}`,
    `已存在资源: ${existingTypes.join('、') || '无'}`,
    `系统强制包含: ${formatConstraintTypes(forceInclude)}`,
    `系统强制排除: ${formatConstraintTypes(forceExclude)}`,
    `规则层建议生成: ${basePlan.execution.resourceTypes.join('、') || '无'}`,
    `规则层建议 PPT: ${basePlan.execution.shouldGeneratePPT ? '是' : '否'}`,
    `允许的资源类型: ${allowedTypes.join('、')}`,
    '',
    '输出格式示例:',
    '{',
    '  "items": [',
    '    { "type": "document", "action": "generate", "reason": "适合系统讲解", "confidence": 0.9 },',
    '    { "type": "video", "action": "skip", "reason": "当前节点不需要演示", "confidence": 0.6 }',
    '  ]',
    '}',
  ].join('\n');
}

function mergeLLMDecision(
  input: DecisionInputV2,
  basePlan: ResourceDecisionResultV2,
  payload: LLMDecisionPayload | null,
): ResourceDecisionResultV2 {
  if (!payload?.items?.length) {
    return {
      ...basePlan,
      trace: {
        ...basePlan.trace,
        llmUsed: true,
      },
    };
  }

  const forceInclude = new Set(input.constraints?.forceInclude ?? []);
  const forceExclude = new Set(input.constraints?.forceExclude ?? []);
  const mergedItems = new Map(basePlan.items.map((item) => [item.type, { ...item }]));

  for (const item of payload.items) {
    const existing = mergedItems.get(item.type);
    if (!existing) continue;
    mergedItems.set(item.type, {
      ...existing,
      action: item.action,
      reason: item.reason || existing.reason,
      confidence: item.confidence ?? existing.confidence,
      sourceLayer: 'llm',
    });
  }

  const orderedItems = basePlan.items.map((item) => {
    const merged = mergedItems.get(item.type) ?? item;

    if (forceInclude.has(item.type)) {
      return {
        ...merged,
        action: 'generate' as const,
        reason: merged.reason || item.reason,
        confidence: 1,
      };
    }

    if (forceExclude.has(item.type)) {
      return {
        ...merged,
        action: 'skip' as const,
        reason: merged.reason || item.reason,
      };
    }

    return merged;
  });

  const executionResourceTypes = orderedItems
    .filter((item) => item.type !== 'ppt' && item.action === 'generate')
    .map((item) => item.type);
  const shouldGeneratePPT = orderedItems.some((item) => item.type === 'ppt' && item.action === 'generate');

  return {
    ...basePlan,
    items: orderedItems,
    execution: {
      resourceTypes: executionResourceTypes,
      shouldGeneratePPT,
    },
    summary: {
      reasoning: orderedItems.map((item) => {
        const prefix = item.action === 'generate' ? item.type : `跳过 ${item.type}`;
        return `[${prefix}] ${item.reason}`;
      }),
      skipped: orderedItems
        .filter((item) => item.action !== 'generate')
        .map((item) => ({ type: item.type, reason: item.reason })),
    },
    trace: {
      ...basePlan.trace,
      llmUsed: true,
    },
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const { decisionInput, aiConfig } = body as {
      decisionInput: DecisionInputV2;
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
    };

    const basePlan = decideNodeResourcePlan({
      ...decisionInput,
      constraints: {
        ...decisionInput.constraints,
        allowLLM: false,
      },
    });

    if (!decisionInput.constraints?.allowLLM) {
      return Response.json(basePlan);
    }

    const { model } = resolveModel({
      providerId: aiConfig?.providerId as ProviderId | undefined,
      modelString: aiConfig?.modelId,
      apiKey: aiConfig?.apiKey,
      baseUrl: aiConfig?.baseUrl,
    });

    const requestedBudgetMs = decisionInput.constraints?.latencyBudgetMs ?? 2000;
    const requestedTimeoutMs =
      decisionInput.constraints?.llmTimeoutMs ?? Math.max(requestedBudgetMs * 4, 8000);
    const timeoutMs = Math.min(Math.max(requestedTimeoutMs, 8000), 25000);
    const llmStartedAt = Date.now();
    const llmPromise = callLLM(
      {
        model,
        system: '你是一个严格输出 JSON 的资源决策器。',
        prompt: buildPrompt(decisionInput, basePlan),
        maxOutputTokens: 800,
      },
      'resource-decision',
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`resource decision llm timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      const llmResult = await Promise.race([llmPromise, timeoutPromise]);
      const parsed = parseJsonResponse<LLMDecisionPayload>(String(llmResult.text ?? ''));
      const merged = mergeLLMDecision(decisionInput, basePlan, parsed);

      return Response.json({
        ...merged,
        trace: {
          ...merged.trace,
          durationMs: {
            ...merged.trace.durationMs,
            llm: Date.now() - llmStartedAt,
            total: Date.now() - startedAt,
          },
        },
      });
    } catch (error) {
      log.warn('LLM decision failed, fallback to rules', {
        error: error instanceof Error ? error.message : String(error),
        timeoutMs,
        elapsedMs: Date.now() - llmStartedAt,
      });
      return Response.json({
        ...basePlan,
        trace: {
          ...basePlan.trace,
          llmUsed: true,
          llmFallbackReason: error instanceof Error ? error.message : String(error),
          durationMs: {
            ...basePlan.trace.durationMs,
            llm: Date.now() - llmStartedAt,
            total: Date.now() - startedAt,
          },
        },
      });
    }
  } catch (error) {
    log.error('Resource decision route failed', error);
    return new Response(JSON.stringify({ error: { message: String(error) } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
