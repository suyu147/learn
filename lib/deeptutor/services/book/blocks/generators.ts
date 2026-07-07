/**
 * Block Generators — Core generators for Book Engine pages
 *
 * Registry-based generator pattern. Each generator produces a
 * block payload given params and context.
 *
 * Implemented generators: TEXT, SECTION, CALLOUT, CODE, CONCEPT_GRAPH, USER_NOTE
 * Stub generators: QUIZ, FIGURE, INTERACTIVE, ANIMATION, TIMELINE, FLASH_CARDS, DEEP_DIVE
 */

import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';
import type { BlockType, Block, Chapter, ConceptGraph } from '../models';
import { createBlock } from '../models';
import { generateId } from '../storage';

const log = createLogger('BlockGenerators');

// ---------------------------------------------------------------------------
// Generator context
// ---------------------------------------------------------------------------

export interface BlockGeneratorContext {
  chapter: Chapter;
  pageIndex: number;
  language: string;
  /** All blocks on the page (for cross-referencing) */
  siblingBlocks: Block[];
}

// ---------------------------------------------------------------------------
// Base generator interface
// ---------------------------------------------------------------------------

export interface BlockGenerator {
  readonly type: BlockType;
  generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }>;
}

// ---------------------------------------------------------------------------
// Shared LLM helper
// ---------------------------------------------------------------------------

class LLMHelper {
  private providerId: ProviderId;
  private modelId: string;
  private apiKey: string;
  private baseUrl?: string;

  constructor(config?: {
    providerId?: string;
    modelId?: string;
    apiKey?: string;
    baseUrl?: string;
  }) {
    this.providerId = (config?.providerId ??
      process.env.DT_DEFAULT_PROVIDER ??
      'openai') as ProviderId;
    this.modelId =
      config?.modelId ?? process.env.DT_DEFAULT_MODEL ?? 'gpt-4o-mini';
    this.apiKey =
      config?.apiKey ??
      process.env.DT_DEFAULT_API_KEY ??
      process.env.OPENAI_API_KEY ??
      '';
    this.baseUrl = config?.baseUrl;
  }

  async text(
    system: string,
    prompt: string,
    label: string = 'block-gen',
  ): Promise<string> {
    if (!this.apiKey) return '[LLM not configured]';

    const { model } = getModel({
      providerId: this.providerId,
      modelId: this.modelId,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    });

    const result = await callLLM(
      { model, system, prompt, temperature: 0.7, maxOutputTokens: 4096 },
      label,
    );

    let text = result.text.trim();
    // Strip markdown fences
    if (text.startsWith('```')) {
      const lines = text.split('\n');
      lines.shift();
      if (lines.length > 0 && lines[lines.length - 1].trim() === '```') lines.pop();
      text = lines.join('\n').trim();
    }
    return text;
  }

  async json(
    system: string,
    prompt: string,
    label: string = 'block-gen-json',
  ): Promise<Record<string, unknown>> {
    const text = await this.text(system, prompt, label);
    try {
      return JSON.parse(text);
    } catch {
      log.warn(`Failed to parse JSON from ${label}`);
      return { content: text };
    }
  }
}

// ---------------------------------------------------------------------------
// TextGenerator
// ---------------------------------------------------------------------------

class TextGenerator implements BlockGenerator {
  readonly type: BlockType = 'text';
  private llm: LLMHelper;

  constructor(config?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
    this.llm = new LLMHelper(config);
  }

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    const focus = (params.focus as string) || 'General explanation';
    const langLabel = ctx.language === 'zh' ? 'Chinese' : 'English';

    const system = `You are an educational content writer. Write clear, engaging text about the given topic.
Output ONLY the text. No markdown fences, no preamble. Language: ${langLabel}.`;

    const prompt = `Chapter: ${ctx.chapter.title}\nFocus: ${focus}\n\nWrite the text block:`;
    const content = await this.llm.text(system, prompt, 'text-block');

    return {
      payload: { content },
      metadata: { wordCount: content.length },
    };
  }
}

// ---------------------------------------------------------------------------
// SectionGenerator — Two-pass: outline + fill
// ---------------------------------------------------------------------------

class SectionGenerator implements BlockGenerator {
  readonly type: BlockType = 'section';
  private llm: LLMHelper;

  constructor(config?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
    this.llm = new LLMHelper(config);
  }

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    const focus = (params.focus as string) || 'Core concepts';
    const depth = (params.depth as string) || 'balanced';
    const langLabel = ctx.language === 'zh' ? 'Chinese' : 'English';

    // Pass 1: Outline
    const outlineSystem = `You are an educational content writer. Create a structured outline for a section.
Output ONLY a JSON object: { "sections": [{ "heading": "...", "points": ["...", "..."] }] }
Language: ${langLabel}.`;

    const outlinePrompt = `Chapter: ${ctx.chapter.title}\nFocus: ${focus}\nDepth: ${depth}\n\nCreate an outline:`;
    const outline = await this.llm.json(outlineSystem, outlinePrompt, 'section-outline');

    // Pass 2: Fill sections
    const fillSystem = `You are an educational content writer. Expand the given outline into full section text.
Use markdown headings (##, ###) for each section. Include clear explanations.
Output ONLY the text. No markdown fences. Language: ${langLabel}.`;

    const fillPrompt = `Chapter: ${ctx.chapter.title}\nFocus: ${focus}\n\nOutline:\n${JSON.stringify(outline)}\n\nExpand into full text:`;
    const content = await this.llm.text(fillSystem, fillPrompt, 'section-fill');

    return {
      payload: { content, outline },
      metadata: { wordCount: content.length, sectionCount: (outline.sections as unknown[])?.length ?? 1 },
    };
  }
}

// ---------------------------------------------------------------------------
// CalloutGenerator
// ---------------------------------------------------------------------------

class CalloutGenerator implements BlockGenerator {
  readonly type: BlockType = 'callout';
  private llm: LLMHelper;

  constructor(config?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
    this.llm = new LLMHelper(config);
  }

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    const calloutType = (params.calloutType as string) || 'key_idea';
    const focus = (params.focus as string) || 'Important concept';
    const langLabel = ctx.language === 'zh' ? 'Chinese' : 'English';

    const system = `You are an educational content writer. Write a ${calloutType} callout box.
A callout is a short, visually distinct box highlighting important information.
Types: key_idea (important concept), pitfall (common mistake), summary (chapter recap), tip (helpful trick).
Output ONLY the callout text (2-4 sentences). No preamble. Language: ${langLabel}.`;

    const prompt = `Chapter: ${ctx.chapter.title}\nCallout type: ${calloutType}\nFocus: ${focus}\n\nWrite the callout:`;
    const content = await this.llm.text(system, prompt, 'callout-block');

    return {
      payload: { content, calloutType },
      metadata: {},
    };
  }
}

// ---------------------------------------------------------------------------
// CodeGenerator
// ---------------------------------------------------------------------------

class CodeGenerator implements BlockGenerator {
  readonly type: BlockType = 'code';
  private llm: LLMHelper;

  constructor(config?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
    this.llm = new LLMHelper(config);
  }

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    const focus = (params.focus as string) || 'Implementation example';
    const langLabel = ctx.language === 'zh' ? 'Chinese' : 'English';

    const system = `You are an educational code writer. Write a clear, well-commented code example.
Output ONLY a JSON object: { "language": "python", "code": "...", "explanation": "..." }
Code should be correct and educational. Comments in ${langLabel}.`;

    const prompt = `Chapter: ${ctx.chapter.title}\nFocus: ${focus}\n\nWrite the code example:`;
    const result = await this.llm.json(system, prompt, 'code-block');

    return {
      payload: {
        language: (result.language as string) || 'python',
        code: (result.code as string) || '# Code not generated',
        explanation: (result.explanation as string) || '',
      },
      metadata: {},
    };
  }
}

// ---------------------------------------------------------------------------
// ConceptGraphGenerator — Deterministic, no LLM
// ---------------------------------------------------------------------------

class ConceptGraphGenerator implements BlockGenerator {
  readonly type: BlockType = 'concept_graph';

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    // Build Mermaid diagram from chapter concept graph
    const graph = (params.conceptGraph as ConceptGraph) ?? { nodes: [], edges: [] };

    let mermaid = 'graph TD\n';
    for (const node of graph.nodes) {
      mermaid += `  ${node.id}["${node.label}"]\n`;
    }
    for (const edge of graph.edges) {
      const arrow =
        edge.relation === 'depends_on'
          ? '-->'
          : edge.relation === 'extends'
            ? '-.->'
            : '---';
      mermaid += `  ${edge.source} ${arrow} ${edge.target}\n`;
    }

    if (graph.nodes.length === 0) {
      mermaid += '  A["No concepts defined"]\n';
    }

    return {
      payload: { mermaid, nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
      metadata: {},
    };
  }
}

// ---------------------------------------------------------------------------
// UserNoteGenerator — Passthrough, no LLM
// ---------------------------------------------------------------------------

class UserNoteGenerator implements BlockGenerator {
  readonly type: BlockType = 'user_note';

  async generate(
    params: Record<string, unknown>,
    _ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    return {
      payload: { content: (params.content as string) || '', editable: true },
      metadata: {},
    };
  }
}

// ---------------------------------------------------------------------------
// QuizGenerator — JSON-based
// ---------------------------------------------------------------------------

class QuizGenerator implements BlockGenerator {
  readonly type: BlockType = 'quiz';
  private llm: LLMHelper;

  constructor(config?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string }) {
    this.llm = new LLMHelper(config);
  }

  async generate(
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    const difficulty = (params.difficulty as string) || 'medium';
    const focus = (params.focus as string) || 'Comprehension check';
    const langLabel = ctx.language === 'zh' ? 'Chinese' : 'English';

    const system = `You are a quiz designer. Create a multiple-choice question.
Output ONLY a JSON object:
{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctIndex": <0-3>,
  "explanation": "Why the correct answer is right"
}
Language: ${langLabel}. Difficulty: ${difficulty}.`;

    const prompt = `Chapter: ${ctx.chapter.title}\nFocus: ${focus}\n\nCreate the quiz question:`;
    const result = await this.llm.json(system, prompt, 'quiz-block');

    return {
      payload: result,
      metadata: { difficulty },
    };
  }
}

// ---------------------------------------------------------------------------
// Stub generators for complex block types
// ---------------------------------------------------------------------------

class StubGenerator implements BlockGenerator {
  readonly type: BlockType;
  private message: string;

  constructor(type: BlockType) {
    this.type = type;
    this.message = `${type} block — advanced generator not yet implemented`;
  }

  async generate(): Promise<{ payload: Record<string, unknown>; metadata: Record<string, unknown> }> {
    return {
      payload: { content: this.message, status: 'stub' },
      metadata: { stub: true },
    };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface BlockGeneratorRegistryConfig {
  providerId?: string;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
}

export class BlockGeneratorRegistry {
  private generators = new Map<BlockType, BlockGenerator>();

  constructor(config?: BlockGeneratorRegistryConfig) {
    // Core generators (LLM-powered)
    this.register(new TextGenerator(config));
    this.register(new SectionGenerator(config));
    this.register(new CalloutGenerator(config));
    this.register(new CodeGenerator(config));
    this.register(new QuizGenerator(config));

    // Deterministic generators
    this.register(new ConceptGraphGenerator());
    this.register(new UserNoteGenerator());

    // Stub generators for complex types
    this.register(new StubGenerator('figure'));
    this.register(new StubGenerator('interactive'));
    this.register(new StubGenerator('animation'));
    this.register(new StubGenerator('timeline'));
    this.register(new StubGenerator('flash_cards'));
    this.register(new StubGenerator('deep_dive'));
  }

  register(gen: BlockGenerator): void {
    this.generators.set(gen.type, gen);
  }

  get(type: BlockType): BlockGenerator | undefined {
    return this.generators.get(type);
  }

  /** Generate a single block */
  async generateBlock(
    type: BlockType,
    params: Record<string, unknown>,
    ctx: BlockGeneratorContext,
  ): Promise<Block> {
    const id = generateId();
    const generator = this.get(type);

    if (!generator) {
      log.warn(`No generator for block type: ${type}`);
      return createBlock({
        id,
        type,
        status: 'error',
        params,
        payload: { content: `No generator for ${type}` },
      });
    }

    try {
      const { payload, metadata } = await generator.generate(params, ctx);
      return createBlock({
        id,
        type,
        status: 'ready',
        params,
        payload,
        metadata,
      });
    } catch (err) {
      log.error(`Block generator failed for ${type}:`, err);
      return createBlock({
        id,
        type,
        status: 'error',
        params,
        payload: { content: `Generation failed: ${err instanceof Error ? err.message : String(err)}` },
        metadata: { error: true },
      });
    }
  }
}
