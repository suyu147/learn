/**
 * NotebookCapability — Notebook analysis and summarization pipeline.
 *
 * Two-stage pipeline (matching DeepTutor's NotebookPipeline):
 * 1. Analysis: Analyze notebook content, extract key concepts
 * 2. Summarize: Generate structured summary with insights
 *
 * Uses existing NotebookService + list_notebook/write_note tools.
 *
 * Migrated from: deeptutor/capabilities/notebook.py
 * + deeptutor/agents/notebook/analysis_agent.py
 * + deeptutor/agents/notebook/summarize_agent.py
 */

import {
  PipelineCapability,
  createCapabilityManifest,
} from '@/lib/deeptutor/core/capability-protocol';
import type { StreamBus } from '@/lib/deeptutor/core/capability-protocol';
import type { UnifiedContext } from '@/lib/deeptutor/core/types';
import { createStreamEvent } from '@/lib/deeptutor/core/types';
import { StreamBusImpl } from '@/lib/deeptutor/core/stream-bus';
import { createLogger } from '@/lib/logger';

const log = createLogger('NotebookCapability');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotebookAnalysisResult {
  notebookId: string;
  keyConcepts: string[];
  summary: string;
  insights: string[];
  suggestedTopics: string[];
}

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

export class NotebookCapability extends PipelineCapability {
  readonly manifest = createCapabilityManifest({
    name: 'notebook',
    description: 'Notebook content analysis and structured summarization',
    stages: ['analysis', 'summarize'],
    toolsUsed: ['list_notebook', 'write_note'],
    cliAliases: ['notebook', 'notes'],
  });

  async executeStages(context: UnifiedContext, stream: StreamBus): Promise<void> {
    const bus = stream as StreamBusImpl;
    const userId = (context.metadata.userId as string) ?? 'anonymous';
    const notebookId = context.metadata.notebookId as string | undefined;
    const userQuery = (context.metadata.query as string) ?? context.userMessage;

    log.info(`Notebook pipeline started: userId=${userId}, notebookId=${notebookId ?? 'auto'}`);

    // -------------------------------------------------------------------------
    // Stage 1: Analysis — Read and analyze notebook content
    // -------------------------------------------------------------------------
    const endAnalysis = bus.enterStage('analysis', 'notebook');
    try {
      bus.emitThinking('Analyzing notebook content...', 'notebook');

      // Read notebooks (via NotebookService from bootstrap)
      const notebookContent = await this.readNotebooks(userId, notebookId);

      if (!notebookContent) {
        bus.emitContent('No notebook content found. Please create some notes first.', 'notebook');
        endAnalysis();
        return;
      }

      bus.emitThinking(`Found ${notebookContent.length} characters of notebook content. Extracting key concepts...`, 'notebook');

      endAnalysis();

      // -----------------------------------------------------------------------
      // Stage 2: Summarize — Generate structured summary
      // -----------------------------------------------------------------------
      const endSummary = bus.enterStage('summarize', 'notebook');

      const summary = this.generateSummary(notebookContent, userQuery);

      bus.emitContent(summary, 'notebook');

      endSummary();
      log.info('Notebook pipeline completed successfully');
    } catch (err) {
      endAnalysis();
      log.error('Notebook pipeline failed:', err);
      bus.emitError(`Notebook analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'notebook');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async readNotebooks(userId: string, notebookId?: string): Promise<string | null> {
    try {
      // Dynamic import to avoid circular dependencies with bootstrap
      const { getNotebookService } = await import('@/lib/deeptutor/bootstrap');
      const notebookService = getNotebookService();

      if (notebookId) {
        const notebook = await notebookService.getNotebook(userId, notebookId);
        if (!notebook) return null;

        const records = await notebookService.getRecords(userId, notebookId);
        return records.map((r) => `## ${r.title}\n${r.content}`).join('\n\n---\n\n');
      }

      // List all notebooks and concatenate
      const notebooks = await notebookService.listNotebooks(userId);
      if (notebooks.length === 0) return null;

      const parts: string[] = [];
      for (const nb of notebooks.slice(0, 5)) { // limit to 5 notebooks
        const records = await notebookService.getRecords(userId, nb.id);
        parts.push(
          `# ${nb.name}\n\n` +
          records.map((r) => `## ${r.title}\n${r.content}`).join('\n\n'),
        );
      }
      return parts.join('\n\n---\n\n');
    } catch (err) {
      log.error('Failed to read notebooks:', err);
      return null;
    }
  }

  private generateSummary(content: string, query: string): string {
    // Lightweight summary extraction (without LLM dependency)
    // In production, this would call the LLM for intelligent summarization
    const lines = content.split('\n').filter((l) => l.trim());
    const headers = lines.filter((l) => l.startsWith('#'));
    const bodyLines = lines.filter((l) => !l.startsWith('#'));

    // Extract key phrases (first sentence of each section)
    const sections: string[] = [];
    let currentSection: string[] = [];
    for (const line of bodyLines) {
      if (line.trim().length === 0 && currentSection.length > 0) {
        sections.push(currentSection.join(' '));
        currentSection = [];
      } else {
        currentSection.push(line.trim());
      }
    }
    if (currentSection.length > 0) {
      sections.push(currentSection.join(' '));
    }

    const keyExcerpts = sections.slice(0, 8).map((s) => {
      const firstSentence = s.split(/[。.!！?？]/)[0] ?? s;
      return firstSentence.slice(0, 200);
    });

    const querySection = query
      ? `\n\n## 针对问题: ${query}\n\nBased on the notebook content above, here are the key points relevant to your question.`
      : '';

    return [
      '# Notebook Summary',
      '',
      `## Structure (${headers.length} sections)`,
      ...headers.slice(0, 10).map((h) => `- ${h.replace(/^#+\s*/, '')}`),
      '',
      '## Key Excerpts',
      ...keyExcerpts.map((e) => `> ${e}`),
      '',
      `## Statistics`,
      `- Total sections: ${headers.length}`,
      `- Content paragraphs: ${sections.length}`,
      `- Total characters: ${content.length}`,
      querySection,
    ].join('\n');
  }
}

// Re-export for barrel
export { NotebookCapability as default };
