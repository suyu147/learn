/**
 * Prompt Assembler — Build the chat system prompt from structured blocks.
 *
 * Based on DeepTutor's 13-block prompt structure in
 * deeptutor/services/prompt/blocks.py. Each block is an independent
 * string that is conditionally included based on the PromptContext.
 */

// ---------------------------------------------------------------------------
// PromptContext — Inputs to prompt assembly
// ---------------------------------------------------------------------------

export interface PromptContext {
  /** UI / response language (e.g. "en", "zh", "ja") */
  language: string;
  /** Names of tools available to the model */
  enabledTools: string[];
  /** Knowledge base names attached for RAG */
  knowledgeBases?: string[];
  /** Memory snapshot text injected into the system prompt */
  memoryContext?: string;
  /** Active skill instructions injected into the system prompt */
  skillsContext?: string;
  /** Plain-text manifest of attached sources */
  sourceManifest?: string;
}

// ---------------------------------------------------------------------------
// Static blocks
// ---------------------------------------------------------------------------

const PERSONA_BLOCK = `You are a helpful AI assistant with access to various tools. You engage in thoughtful, educational conversations and use tools when they can provide better answers.`;

const TOOL_USAGE_BLOCK = `When a tool can help answer the user's question better, use it. Available tools are listed below. Always use the exact tool name and provide all required parameters.`;

const BEHAVIOR_BLOCK = `Guidelines:
- Be concise but thorough
- Use tools when they add value, not for simple questions
- If you're unsure, say so rather than guessing
- Cite sources when using web_fetch or web_search results
- Think step by step for complex problems`;

const FORMAT_BLOCK = `Response format:
- Use Markdown for formatting when helpful
- Use code blocks for code examples
- Keep responses focused and well-structured`;

// ---------------------------------------------------------------------------
// Dynamic block builders
// ---------------------------------------------------------------------------

function buildToolListBlock(tools: string[]): string {
  if (tools.length === 0) return '';
  return `Available tools:\n${tools.map((t) => `- ${t}`).join('\n')}`;
}

function buildKBBlock(knowledgeBases?: string[]): string {
  if (!knowledgeBases || knowledgeBases.length === 0) return '';
  return `Knowledge bases attached: ${knowledgeBases.join(', ')}. Use the rag tool to search these knowledge bases for relevant information.`;
}

function buildLanguageBlock(language: string): string {
  if (language === 'en') return '';
  return `Please respond in ${language}.`;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const BLOCK_SEPARATOR = '\n\n---\n\n';

/**
 * Assemble the complete system prompt from context.
 * Empty blocks are filtered out before joining.
 */
export function assembleSystemPrompt(context: PromptContext): string {
  const blocks: string[] = [
    PERSONA_BLOCK,
    BEHAVIOR_BLOCK,
    FORMAT_BLOCK,
    buildToolListBlock(context.enabledTools),
    TOOL_USAGE_BLOCK,
    buildKBBlock(context.knowledgeBases),
  ];

  if (context.memoryContext) {
    blocks.push(`User memory context:\n${context.memoryContext}`);
  }

  if (context.skillsContext) {
    blocks.push(`Active skills:\n${context.skillsContext}`);
  }

  if (context.sourceManifest) {
    blocks.push(`Attached sources:\n${context.sourceManifest}`);
  }

  blocks.push(buildLanguageBlock(context.language));

  return blocks.filter((b) => b.length > 0).join(BLOCK_SEPARATOR);
}
