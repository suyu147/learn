import { resolveImageGenApiKey, resolveImageGenProvider } from '@/lib/server/provider-config';
import { resolveModel } from '@/lib/server/resolve-model';
import { streamLLM } from '@/lib/ai/llm';
import { generateSceneOutlinesFromRequirements } from '@/lib/generation/outline-generator';
import { buildSceneFromOutline } from '@/lib/generation/scene-builder';
import { batchGenerateImages } from '@/lib/generation/image-generator';
import type { Scene } from '@/lib/types/stage';
import type { ProviderId } from '@/lib/types/provider';
import type { ImageMapping, UserRequirements } from '@/lib/types/generation';

function createAICallFn(providerId?: string, modelId?: string, apiKey?: string, baseUrl?: string) {
  return async (systemPrompt: string, userPrompt: string) => {
    const { model } = resolveModel({ providerId: providerId as ProviderId | undefined, modelId, apiKey, baseUrl });
    const result = await streamLLM({ model, system: systemPrompt, prompt: userPrompt, maxOutputTokens: 8192 }, 'ppt-generation');
    return result.text;
  };
}

function backfillGeneratedImages(scene: Scene, mapping: ImageMapping) {
  if (scene.type !== 'slide') return;
  const content = scene.content as { canvas?: { elements?: Array<Record<string, unknown>> } };
  for (const element of content.canvas?.elements ?? []) {
    if (element.type === 'image' && typeof element.src === 'string' && mapping[element.src]) element.src = mapping[element.src];
  }
}

export async function generatePptScenes(requirement: string, aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }, enableImageGeneration?: boolean, includeInteractive?: boolean) {
  const aiCall = createAICallFn(aiConfig?.providerId, aiConfig?.modelId, aiConfig?.apiKey, aiConfig?.baseUrl);
  const imageGenProvider = resolveImageGenProvider();
  const imageGenAvailable = enableImageGeneration && !!resolveImageGenApiKey(imageGenProvider, undefined);
  const requirements: UserRequirements = { requirement, language: 'zh-CN' };
  const outlineResult = await generateSceneOutlinesFromRequirements(requirements, undefined, undefined, aiCall, undefined, { imageGenerationEnabled: imageGenAvailable, videoGenerationEnabled: false, includeInteractive: includeInteractive !== false });
  if (!outlineResult.success || !outlineResult.data) return [];
  let generatedMediaMapping: ImageMapping = {};
  if (imageGenAvailable) {
    const allMediaGens = outlineResult.data.filter((o) => o.mediaGenerations?.length).flatMap((o) => o.mediaGenerations!);
    if (allMediaGens.length > 0) generatedMediaMapping = Object.fromEntries(await batchGenerateImages(allMediaGens));
  }
  const stageId = `stage_${Date.now()}`;
  const scenes: Scene[] = [];
  for (const outline of outlineResult.data) {
    const scene = await buildSceneFromOutline(outline, aiCall, stageId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, generatedMediaMapping);
    if (scene) {
      backfillGeneratedImages(scene, generatedMediaMapping);
      scenes.push(scene);
    }
  }
  return scenes.sort((a, b) => a.order - b.order);
}
