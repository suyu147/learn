/**
 * VisualizeCapability — Visualization code generation pipeline.
 *
 * Three-phase approach (matching DeepTutor's VisualizePipeline):
 * 1. Analyze: Determine render type and produce structured brief
 * 2. Generate: Produce visualization code (SVG/Chart.js/Mermaid/HTML)
 * 3. Review: Validate and optimize
 *
 * Render types: svg, chartjs, mermaid, html
 * (Manim excluded — requires Python subprocess)
 *
 * Migrated from: deeptutor/capabilities/visualize.py (725 lines)
 * + deeptutor/agents/visualize/pipeline.py (90 lines)
 */

import {
  PipelineCapability,
  createCapabilityManifest,
} from '@/lib/deeptutor/core/capability-protocol';
import type { StreamBus } from '@/lib/deeptutor/core/capability-protocol';
import type { UnifiedContext } from '@/lib/deeptutor/core/types';
import { generateText } from 'ai';
import { StreamBusImpl } from '@/lib/deeptutor/core/stream-bus';
import { assembleVisualizePrompt } from './prompt-assembler';

import type { ProviderId } from '@/lib/types/provider';

export class VisualizeCapability extends PipelineCapability {
  readonly manifest = createCapabilityManifest({
    name: 'visualize',
    description: 'Visualization code generation — SVG, Chart.js, Mermaid, HTML',
    stages: ['analyzing', 'generating', 'reviewing'],
    toolsUsed: [],
    cliAliases: ['visualize', 'viz', 'visualise'],
  });

  async executeStages(context: UnifiedContext, stream: StreamBus): Promise<void> {
    const bus = stream as StreamBusImpl;

    const renderMode = (context.metadata.renderMode as string) ?? 'auto';
    const quality = (context.metadata.quality as string) ?? 'medium';
    const styleHint = context.metadata.styleHint as string | undefined;

    // ------------------------------------------------------------------
    // Stage 1: Analyze — determine visualization approach
    // ------------------------------------------------------------------
    const endAnalyzing = bus.enterStage('analyzing', 'visualize');

    const systemPrompt = assembleVisualizePrompt({
      language: context.language || 'en',
      renderMode: renderMode as 'auto' | 'svg' | 'chartjs' | 'mermaid' | 'html',
      quality: quality as 'low' | 'medium' | 'high',
      styleHint,
    });

    const model = await this.resolveModel(context);

    let analysis: string;
    try {
      const analysisResult = await generateText({
        model,
        system: systemPrompt,
        prompt: `Analyze the following visualization request and determine the best approach. Respond with a brief analysis of: 1) What type of visualization to use, 2) Key elements to include, 3) Recommended format.\n\nRequest: ${context.userMessage}`,
        temperature: 0.1,
        maxOutputTokens: 1024,
      });
      analysis = analysisResult.text;
    } catch (error) {
      endAnalyzing();
      const errorMsg = error instanceof Error ? error.message : String(error);
      bus.emitError(`Visualization analysis failed: ${errorMsg}`, 'visualize');
      return;
    }

    endAnalyzing();

    // ------------------------------------------------------------------
    // Stage 2: Generate — produce visualization code
    // ------------------------------------------------------------------
    const endGenerating = bus.enterStage('generating', 'visualize');

    let code: string;
    try {
      const codeResult = await generateText({
        model,
        system: systemPrompt,
        prompt: `Based on this analysis, generate the complete visualization code.\n\nAnalysis:\n${analysis}\n\nOriginal request: ${context.userMessage}\n\nReturn ONLY the visualization code. No markdown fences, no explanation.`,
        temperature: 0.2,
        maxOutputTokens: 8192,
      });
      code = codeResult.text;
    } catch (error) {
      endGenerating();
      const errorMsg = error instanceof Error ? error.message : String(error);
      bus.emitError(`Visualization generation failed: ${errorMsg}`, 'visualize');
      return;
    }

    endGenerating();

    // ------------------------------------------------------------------
    // Stage 3: Review — validate and optimize
    // ------------------------------------------------------------------
    const endReviewing = bus.enterStage('reviewing', 'visualize');

    let reviewedCode: string;
    try {
      const reviewResult = await generateText({
        model,
        system: `You are a code reviewer specializing in data visualizations. Review the following visualization code for correctness, accessibility, and visual quality. If you find issues, return the corrected code. If the code is good, return it unchanged.\n\nReturn ONLY the code. No markdown fences, no explanation.`,
        prompt: `Review and optimize this visualization code:\n\n${code}`,
        temperature: 0.1,
        maxOutputTokens: 8192,
      });
      reviewedCode = reviewResult.text;
    } catch {
      // Review is best-effort — fall back to original code
      reviewedCode = code;
    }

    endReviewing();

    // Emit the final visualization code
    bus.emitResult({
      text: reviewedCode,
      renderMode,
      quality,
    });
  }

  private async resolveModel(context: UnifiedContext): Promise<import('ai').LanguageModel> {
    const { getModel } = await import('@/lib/ai/providers');
    const providerId = (context.metadata.providerId as string) ?? 'openai';
    const modelId = (context.metadata.modelId as string) ?? 'gpt-4o';
    const apiKey = (context.metadata.apiKey as string) ?? '';
    const baseUrl = context.metadata.baseUrl as string | undefined;
    const { model } = getModel({ providerId: providerId as ProviderId, modelId, apiKey, baseUrl });
    return model;
  }
}
