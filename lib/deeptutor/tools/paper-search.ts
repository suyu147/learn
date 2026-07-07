/**
 * PaperSearchTool — Search for academic papers
 *
 * Phase 2c: Placeholder implementation.
 * Real providers (Semantic Scholar, arXiv, CrossRef) deferred to Phase 5.
 */

import {
  BaseTool,
  type ToolDefinition,
  type ToolResult,
  type ToolPromptHints,
  createToolResult,
  createToolParameter,
  createToolPromptHints,
} from '@/lib/deeptutor/core/tool-protocol';
import { createLogger } from '@/lib/logger';

const log = createLogger('PaperSearchTool');

export class PaperSearchTool extends BaseTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'paper_search',
      description: 'Search for academic papers and research publications. Currently in preview — full search providers will be available in a future update.',
      parameters: [
        createToolParameter({
          name: 'query',
          type: 'string',
          description: 'Search query for academic papers.',
          required: true,
        }),
      ],
    };
  }

  getPromptHints(_language: string = 'en'): ToolPromptHints {
    return createToolPromptHints({
      shortDescription: 'Search academic papers.',
      whenToUse: 'When the user asks for research papers, academic references, or scientific literature.',
      inputFormat: 'query: academic search terms',
      note: 'Full paper search (Semantic Scholar, arXiv) will be available in Phase 5.',
      phase: 'retrieval',
    });
  }

  async execute(kwargs: Record<string, unknown>): Promise<ToolResult> {
    const query = kwargs.query as string;

    if (!query) {
      return createToolResult({ content: 'Error: query is required.', success: false });
    }

    // Phase 2c placeholder — suggest using web_search instead
    return createToolResult({
      content: `Paper search for "${query}" is not yet available. Full academic search providers (Semantic Scholar, arXiv, CrossRef) will be integrated in a future update.\n\nFor now, try using the web_search tool to find relevant papers, or search Google Scholar directly.`,
      metadata: { query, status: 'preview' },
    });
  }
}
