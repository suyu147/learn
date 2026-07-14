/**
 * MemoryService — Three-layer memory system
 *
 * L1 (Trace): Append-only event log per surface (JSONL).
 * L2 (Summary): Per-surface markdown summaries.
 * L3 (Synthesis): Cross-surface knowledge in 4 slots:
 *   - recent: Recent important events
 *   - profile: User identity and learning style
 *   - scope: Current knowledge level and topics
 *   - preferences: User preferences and habits
 *
 * Storage layout:
 *   data/memory/{userId}/
 *     L1/{surface}.jsonl
 *     L2/{surface}.md
 *     L3/{slot}.md
 *
 * Phase 2c: Simplified memory without full consolidator pipeline.
 */

import { createLogger } from '@/lib/logger';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const log = createLogger('MemoryService');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryLayer = 'L1' | 'L2' | 'L3';
export type L3Slot = 'recent' | 'profile' | 'scope' | 'preferences';
export type Surface = 'chat' | 'notebook' | 'quiz' | 'kb' | 'book' | 'cowriter';

export interface TraceEvent {
  id: string;
  ts: string;
  surface: Surface;
  kind: string;
  payload: Record<string, unknown>;
  sessionId?: string;
  turnId?: string;
}

export interface MemoryOverview {
  l1Events: number;
  l2Surfaces: string[];
  l3Slots: { slot: L3Slot; charCount: number }[];
  totalChars: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const L3_SLOTS: L3Slot[] = ['recent', 'profile', 'scope', 'preferences'];
const MEMORY_BASE_DIR = 'data/memory';
const MAX_TEXT_LEN = 240;        // Max chars per memory entry
const MAX_READ_CHARS = 16_000;   // Max chars returned per read

// ---------------------------------------------------------------------------
// MemoryService
// ---------------------------------------------------------------------------

export class MemoryServiceImpl {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(process.cwd(), MEMORY_BASE_DIR);
  }

  // -------------------------------------------------------------------------
  // L1 — Trace (append-only events)
  // -------------------------------------------------------------------------

  async emitTrace(userId: string, event: Omit<TraceEvent, 'id' | 'ts'>): Promise<TraceEvent> {
    const fullEvent: TraceEvent = {
      ...event,
      id: `${event.surface}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
    };

    const dir = this.userDir(userId, 'L1');
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${event.surface}.jsonl`);
    
    const line = JSON.stringify(fullEvent) + '\n';
    await writeFile(filePath, line, { flag: 'a', encoding: 'utf-8' });
    
    return fullEvent;
  }

  async readTrace(userId: string, surface: Surface, limit: number = 50): Promise<TraceEvent[]> {
    const filePath = join(this.userDir(userId, 'L1'), `${surface}.jsonl`);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const events = lines.map((l) => JSON.parse(l) as TraceEvent);
      return events.slice(-limit);
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // L2 — Surface Summaries (markdown)
  // -------------------------------------------------------------------------

  async readL2(userId: string, surface: string): Promise<string> {
    return this.readMarkdown(this.userDir(userId, 'L2'), surface);
  }

  async writeL2(userId: string, surface: string, content: string): Promise<void> {
    const dir = this.userDir(userId, 'L2');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${surface}.md`), content, 'utf-8');
  }

  // -------------------------------------------------------------------------
  // L3 — Cross-surface Synthesis (4 slots)
  // -------------------------------------------------------------------------

  async readL3(userId: string, slot: L3Slot): Promise<string> {
    return this.readMarkdown(this.userDir(userId, 'L3'), slot);
  }

  async writeL3(userId: string, slot: L3Slot, content: string): Promise<void> {
    const dir = this.userDir(userId, 'L3');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${slot}.md`), content, 'utf-8');
  }

  /**
   * Read all L3 slots concatenated. Used by read_memory tool.
   */
  async readAllL3(userId: string): Promise<string> {
    const parts: string[] = [];

    for (const slot of L3_SLOTS) {
      const content = await this.readL3(userId, slot);
      if (content.trim()) {
        parts.push(`## ${slot.charAt(0).toUpperCase() + slot.slice(1)}\n\n${content}`);
      }
    }

    if (parts.length === 0) {
      return '';
    }

    let result = parts.join('\n\n---\n\n');
    if (result.length > MAX_READ_CHARS) {
      result = result.slice(0, MAX_READ_CHARS) + '\n\n[... truncated]';
    }

    return result;
  }

  /**
   * Add or edit an entry in L3/preferences.
   * Used by write_memory tool.
   */
  async writePreference(
    userId: string,
    op: 'add' | 'edit',
    text: string,
    targetId?: string,
  ): Promise<{ success: boolean; entryId: string; message: string }> {
    if (text.length > MAX_TEXT_LEN) {
      text = text.slice(0, MAX_TEXT_LEN);
    }

    const dir = this.userDir(userId, 'L3');
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'preferences.md');

    let content = '';
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    const entryId = `m_${Date.now().toString(36)}`;

    if (op === 'add') {
      const newLine = `- ${text} <!--${entryId}-->`;
      content = content.trim()
        ? content.trim() + '\n' + newLine
        : '# Preferences\n\n' + newLine;
    } else if (op === 'edit') {
      if (!targetId) {
        return { success: false, entryId: '', message: 'target_id required for edit op' };
      }
      // Find and replace the line with the target ID
      const lines = content.split('\n');
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`<!--${targetId}-->`)) {
          lines[i] = `- ${text} <!--${targetId}-->`;
          found = true;
          break;
        }
      }
      if (!found) {
        return { success: false, entryId: targetId, message: `Entry ${targetId} not found` };
      }
      content = lines.join('\n');
    } else {
      return { success: false, entryId: '', message: `Unknown op: ${op}` };
    }

    await writeFile(filePath, content, 'utf-8');
    return { success: true, entryId, message: `${op === 'add' ? 'Added' : 'Updated'} preference` };
  }

  // -------------------------------------------------------------------------
  // Consolidation — L1→L2 rollup + L2→L3 synthesis
  // -------------------------------------------------------------------------

  /**
   * Consolidate memory for a user after a capability completes.
   * 1. Roll up recent L1 traces into L2 surface summary
   * 2. Merge L2 summaries into L3/recent slot
   *
   * Called by EventBus subscriber on CAPABILITY_COMPLETE.
   */
  async consolidate(userId: string, surface: Surface): Promise<void> {
    try {
      // Step 1: L1 → L2 rollup
      await this.rollupL1ToL2(userId, surface);

      // Step 2: L2 → L3 synthesis
      await this.synthesizeL3Recent(userId);

      log.info(`Memory consolidated for user ${userId}, surface: ${surface}`);
    } catch (err) {
      log.warn(`Memory consolidation failed for ${userId}/${surface}:`, err);
    }
  }

  /**
   * Roll up L1 traces into L2 surface summary.
   * Extracts key events from L1 and appends a summary to L2.
   */
  private async rollupL1ToL2(userId: string, surface: Surface): Promise<void> {
    const events = await this.readTrace(userId, surface, 50);
    if (events.length === 0) return;

    // Only rollup if there are new events since last consolidation
    const existingL2 = await this.readL2(userId, surface);
    const lastConsolidation = this.extractLastConsolidationTs(existingL2);
    const newEvents = events.filter((e) => new Date(e.ts).getTime() > lastConsolidation);

    if (newEvents.length < 3) return; // Not enough new events to warrant rollup

    // Build summary from new events
    const summaryLines: string[] = [];
    const ts = new Date().toISOString();
    summaryLines.push(`## Consolidation ${ts}\n`);

    for (const event of newEvents.slice(-20)) {
      const kind = event.kind || 'event';
      const payload = event.payload;
      const summary = payload.summary as string || payload.message as string || JSON.stringify(payload).slice(0, 120);
      summaryLines.push(`- [${kind}] ${summary}`);
    }

    // Append to L2
    const newContent = existingL2.trim()
      ? existingL2.trim() + '\n\n' + summaryLines.join('\n')
      : `# ${surface.charAt(0).toUpperCase() + surface.slice(1)} Memory\n\n` + summaryLines.join('\n');

    // Cap L2 at 4000 chars (keep last portion)
    const capped = newContent.length > 4000
      ? newContent.slice(newContent.length - 4000)
      : newContent;

    await this.writeL2(userId, surface, capped);
  }

  /**
   * Synthesize L2 surface summaries into L3/recent slot.
   */
  private async synthesizeL3Recent(userId: string): Promise<void> {
    const surfaces: Surface[] = ['chat', 'notebook', 'quiz', 'kb', 'book', 'cowriter'];
    const sections: string[] = [];

    for (const surface of surfaces) {
      const content = await this.readL2(userId, surface);
      if (content.trim()) {
        // Take last 800 chars of each L2 as the "recent" summary
        const recent = content.length > 800 ? content.slice(-800) : content;
        sections.push(`### ${surface.charAt(0).toUpperCase() + surface.slice(1)}\n\n${recent.trim()}`);
      }
    }

    if (sections.length === 0) return;

    const ts = new Date().toISOString();
    const header = `# Recent Memory (updated ${ts})\n`;
    let combined = header + '\n' + sections.join('\n\n---\n\n');

    // Cap L3/recent at 4000 chars
    if (combined.length > 4000) {
      combined = combined.slice(0, 4000) + '\n\n[... truncated]';
    }

    await this.writeL3(userId, 'recent', combined);
  }

  /**
   * Extract the timestamp of the last consolidation from L2 content.
   */
  private extractLastConsolidationTs(l2Content: string): number {
    const match = l2Content.match(/## Consolidation (.+?)$/m);
    if (match) {
      const ts = new Date(match[1]).getTime();
      if (!isNaN(ts)) return ts;
    }
    return 0;
  }

  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------

  async overview(userId: string): Promise<MemoryOverview> {
    let l1Events = 0;
    const l2Surfaces: string[] = [];
    const l3Slots: { slot: L3Slot; charCount: number }[] = [];
    let totalChars = 0;

    // Count L1 events
    const l1Dir = this.userDir(userId, 'L1');
    if (existsSync(l1Dir)) {
      for (const surface of ['chat', 'notebook', 'quiz', 'kb', 'book', 'cowriter']) {
        const events = await this.readTrace(userId, surface as Surface, 10000);
        l1Events += events.length;
      }
    }

    // Check L2 surfaces
    for (const surface of ['chat', 'notebook', 'quiz', 'kb', 'book', 'cowriter']) {
      const content = await this.readL2(userId, surface);
      if (content.trim()) {
        l2Surfaces.push(surface);
        totalChars += content.length;
      }
    }

    // Check L3 slots
    for (const slot of L3_SLOTS) {
      const content = await this.readL3(userId, slot);
      const charCount = content.length;
      l3Slots.push({ slot, charCount });
      totalChars += charCount;
    }

    return { l1Events, l2Surfaces, l3Slots, totalChars };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private userDir(userId: string, layer: string): string {
    return join(this.baseDir, userId, layer);
  }

  private async readMarkdown(dir: string, name: string): Promise<string> {
    try {
      return await readFile(join(dir, `${name}.md`), 'utf-8');
    } catch {
      return '';
    }
  }
}

// Re-export for backward compat
export interface MemoryService {
  read(userId: string, layer: 'L1' | 'L2' | 'L3'): Promise<string>;
  write(userId: string, layer: 'L1' | 'L2' | 'L3', content: string): Promise<void>;
}
