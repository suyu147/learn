import { getModel } from '@/lib/ai/providers';
import type { ModelConfig, ProviderId } from '@/lib/types/provider';
import type { NextRequest } from 'next/server';

interface ResolveModelOptions {
  modelString?: string;
  modelId?: string;
  providerId?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: ModelConfig['providerType'];
  requiresApiKey?: boolean;
}

export function resolveModel(config?: ResolveModelOptions & Partial<ModelConfig>) {
  const modelString = config?.modelString || config?.modelId || process.env.AI_MODEL || 'deepseek-chat';
  const providerId = config?.providerId || (process.env.AI_PROVIDER as string) || 'deepseek';
  
  // 根据 providerId 获取对应的 API key
  let apiKey = config?.apiKey;
  if (!apiKey) {
    switch (providerId) {
      case 'spark':
        apiKey = process.env.SPARK_API_KEY;
        break;
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'deepseek':
        apiKey = process.env.DEEPSEEK_API_KEY;
        break;
      case 'kimi':
        apiKey = process.env.KIMI_API_KEY;
        break;
      case 'glm':
        apiKey = process.env.GLM_API_KEY;
        break;
      case 'qwen':
        apiKey = process.env.QWEN_API_KEY;
        break;
      case 'minimax':
        apiKey = process.env.MINIMAX_API_KEY;
        break;
      case 'siliconflow':
        apiKey = process.env.SILICONFLOW_API_KEY;
        break;
      case 'doubao':
        apiKey = process.env.DOUBAO_API_KEY;
        break;
      case 'grok':
        apiKey = process.env.GROK_API_KEY;
        break;
      default:
        apiKey = process.env.OPENAI_API_KEY;
    }
    apiKey = apiKey || '';
  }

  const modelConfig = providerId === 'spark'
    ? {
        providerId: 'spark' as const,
        modelId: modelString,
        apiKey,
        providerType: 'openai' as const,
        baseUrl: config?.baseUrl || process.env.SPARK_BASE_URL || 'https://spark-api-open.xf-yun.com/v1',
      }
    : {
        providerId: providerId as ProviderId,
        modelId: modelString,
        apiKey,
        ...(config?.baseUrl ? { baseUrl: config.baseUrl } : {}),
      };

  const result = getModel(modelConfig);
  return {
    ...result,
    apiKey,
  };
}

export function resolveModelFromHeaders(req: NextRequest) {
  const modelString = req.headers.get('x-model') || undefined;
  const apiKey = req.headers.get('x-api-key') || undefined;
  const baseUrl = req.headers.get('x-base-url') || undefined;
  const providerType = req.headers.get('x-provider-type') || undefined;

  return resolveModel({
    modelString,
    apiKey,
    baseUrl,
    providerType: providerType as ModelConfig['providerType'] | undefined,
  });
}
