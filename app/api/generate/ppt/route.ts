import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import { resolveImageGenApiKey, resolveImageGenProvider } from '@/lib/server/provider-config';
import type { ProviderId } from '@/lib/types/provider';
import type { UserRequirements, ImageMapping } from '@/lib/types/generation';
import type { Scene } from '@/lib/types/stage';
import { generateSceneOutlinesFromRequirements } from '@/lib/generation/outline-generator';
import { buildSceneFromOutline } from '@/lib/generation/scene-builder';
import { batchGenerateImages } from '@/lib/generation/image-generator';
import { createLogger } from '@/lib/logger';
const log = createLogger('PPTGenerateAPI');

function createAICallFn(
  providerId?: string,
  modelId?: string,
  apiKey?: string,
  baseUrl?: string,
) {
  return async (
    systemPrompt: string,
    userPrompt: string,
    _images?: Array<{ id: string; src: string }>,
  ): Promise<string> => {
    const { model } = resolveModel({
      providerId: providerId as ProviderId | undefined,
      modelString: modelId,
      apiKey,
      baseUrl,
    });

    const result = await streamLLM(
      {
        model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 8192,
      },
      'ppt-generation',
    );

    return result.text;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      requirement,
      language,
      aiConfig,
      enableImageGeneration,
      imageGenApiKey,
      includeInteractive,
    } = body as {
      requirement: string;
      language?: string;
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
      enableImageGeneration?: boolean;
      imageGenApiKey?: string;
      includeInteractive?: boolean;
    };

    if (!requirement) {
      return new Response(
        JSON.stringify({ error: { message: 'requirement is required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const aiCall = createAICallFn(
      aiConfig?.providerId,
      aiConfig?.modelId,
      aiConfig?.apiKey,
      aiConfig?.baseUrl,
    );

    const imageGenProvider = resolveImageGenProvider();
    const imageGenAvailable = enableImageGeneration && !!resolveImageGenApiKey(imageGenProvider, imageGenApiKey);

    const requirements: UserRequirements = {
      requirement,
      language: language || 'zh-CN',
    };

    const stageId = `stage_${Date.now()}`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'progress', stage: 1, message: '正在分析需求，生成场景大纲...' });

          const outlineResult = await generateSceneOutlinesFromRequirements(
            requirements,
            undefined,
            undefined,
            aiCall,
            {
              onProgress: (p) => send({ type: 'progress', ...p }),
            },
            {
              imageGenerationEnabled: imageGenAvailable,
              videoGenerationEnabled: false,
              includeInteractive: includeInteractive !== false,
            },
          );

          if (!outlineResult.success || !outlineResult.data) {
            send({ type: 'error', message: outlineResult.error || 'Failed to generate outlines' });
            controller.close();
            return;
          }

          const outlines = outlineResult.data;
          send({
            type: 'outlines_ready',
            outlines: outlines.map((o) => ({
              id: o.id,
              title: o.title,
              type: o.type,
              order: o.order,
              hasMedia: (o.mediaGenerations?.length ?? 0) > 0,
            })),
          });

          // Stage 2: Generate images in parallel if enabled
          let generatedMediaMapping: ImageMapping = {};
          if (imageGenAvailable) {
            const allMediaGens = outlines
              .filter((o) => o.mediaGenerations && o.mediaGenerations.length > 0)
              .flatMap((o) => o.mediaGenerations!);

            if (allMediaGens.length > 0) {
              send({
                type: 'progress',
                stage: 2,
                message: `正在生成 ${allMediaGens.filter((m) => m.type === 'image').length} 张配图...`,
              });

              generatedMediaMapping = Object.fromEntries(await batchGenerateImages(allMediaGens));

              send({
                type: 'images_ready',
                count: Object.keys(generatedMediaMapping).length,
                ids: Object.keys(generatedMediaMapping),
              });
            }
          }

          // Stage 3: Generate scene content
          send({
            type: 'progress',
            stage: 3,
            overallProgress: 50,
            message: `正在生成 ${outlines.length} 个场景内容...`,
          });

          let completedCount = 0;
          const scenes: Scene[] = [];

          for (const outline of outlines) {
            try {
              send({
                type: 'scene_start',
                sceneId: outline.id,
                title: outline.title,
                order: outline.order,
                sceneType: outline.type,
              });

              const scene = await buildSceneFromOutline(
                outline,
                aiCall,
                stageId,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                generatedMediaMapping,
              );

              // Backfill generated images into the scene
              if (scene && Object.keys(generatedMediaMapping).length > 0) {
                backfillGeneratedImages(scene, generatedMediaMapping);
              }

              completedCount++;

              if (scene) {
                scenes.push(scene);
                send({ type: 'scene_ready', scene });
              } else {
                send({ type: 'scene_error', sceneId: outline.id, title: outline.title });
              }

              send({
                type: 'progress',
                stage: 3,
                overallProgress: 50 + Math.floor((completedCount / outlines.length) * 50),
                scenesGenerated: completedCount,
                totalScenes: outlines.length,
              });
            } catch (error) {
              completedCount++;
              log.error(`Error generating scene ${outline.title}:`, error);
              send({ type: 'scene_error', sceneId: outline.id, title: outline.title, message: String(error) });
            }
          }

          send({
            type: 'generation_complete',
            stageId,
            scenes: scenes.sort((a, b) => a.order - b.order),
            imageGenUsed: imageGenAvailable,
            imagesGenerated: Object.keys(generatedMediaMapping).length,
          });
        } catch (error) {
          log.error('PPT generation error:', error);
          send({ type: 'error', message: String(error) });
        }

        controller.close();
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
    log.error('PPT generation request error:', error);
    return new Response(
      JSON.stringify({ error: { message: String(error) } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

function backfillGeneratedImages(scene: Scene, mapping: ImageMapping): void {
  if (scene.type !== 'slide') return;
  const content = scene.content as { type: string; canvas?: import('@/lib/types/slides').Slide };
  if (!content?.canvas?.elements) return;

  for (const element of content.canvas.elements) {
    if (element.type === 'image') {
      const src = (element as Record<string, unknown>).src as string;
      if (src && mapping[src]) {
        (element as Record<string, unknown>).src = mapping[src];
        log.debug(`Backfilled image ${src} with generated URL`);
      }
    }
  }
}
