/**
 * Snapshot Layer — Auto-collect user interaction data from PostgreSQL
 *
 * Replaces the broken "wait for LLM to call write_memory" pattern with
 * deterministic data collection. Inspired by DeepTutor Python's snapshot/adapters.py.
 *
 * Currently implements only the `chat` surface (DtMessage).
 * Additional surfaces (quiz, notebook, kb, book, cowriter) will be added later.
 */

import { createLogger } from '@/lib/logger';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import type { Surface } from '@/lib/deeptutor/services/memory';

const log = createLogger('Snapshot');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Entity {
  /** Unique ID (sessionId for chat surface) */
  id: string;
  /** Human-readable label (session title) */
  label: string;
  /** ISO timestamp of last modification */
  ts: string;
  /** Concatenated content of the entity */
  content: string;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
  /** SHA-1 content fingerprint for change detection */
  fingerprint: string;
}

export interface ChangeEntry {
  ts: string;
  kind: 'added' | 'modified' | 'removed';
  entityId: string;
  label: string;
  prevFingerprint: string | null;
  newFingerprint: string | null;
}

export interface SnapshotState {
  /** Entity ID → fingerprint */
  fingerprints: Record<string, string>;
  /** Entity ID → label */
  labels: Record<string, string>;
  /** ISO timestamp of last successful refresh */
  lastRefresh: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SNAPSHOT_PAGE_SIZE = 50;
const MAX_MESSAGES_PER_SESSION = 500;
const MEMORY_BASE_DIR = 'data/memory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Chat Snapshot Adapter
// ---------------------------------------------------------------------------

/**
 * Read chat entities from PostgreSQL via Prisma.
 * Uses batch query (not N+1) for efficiency.
 */
export async function readChatEntities(userId: string): Promise<Entity[]> {
  const prisma = (await import('@/lib/db/client')).default;

  // 1. Query sessions for this user (paginated)
  const sessions = await prisma.dtSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: SNAPSHOT_PAGE_SIZE,
  });

  if (sessions.length === 0) return [];

  // 2. Batch query all messages for these sessions (N+1 fix)
  const sessionIds = sessions.map((s) => s.id);
  const allMessages = await prisma.dtMessage.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: 'asc' },
  });

  // 3. Group messages by sessionId in memory
  const messagesBySession = new Map<string, typeof allMessages>();
  for (const msg of allMessages) {
    const arr = messagesBySession.get(msg.sessionId) ?? [];
    // Respect per-session message limit
    if (arr.length < MAX_MESSAGES_PER_SESSION) {
      arr.push(msg);
    }
    messagesBySession.set(msg.sessionId, arr);
  }

  // 4. Build Entity for each session
  const entities: Entity[] = [];
  for (const session of sessions) {
    const messages = messagesBySession.get(session.id) ?? [];
    const blocks: string[] = [];
    let lastMessageId: number | null = null;

    for (const msg of messages) {
      const body = (msg.content as string)?.trim();
      if (!body) continue;
      blocks.push(`### ${msg.role}\n${body}`);
      lastMessageId = msg.id;
    }

    if (blocks.length === 0) continue;

    const fingerprintInput = `${lastMessageId ?? 'none'}:${session.updatedAt.toISOString()}`;
    const fingerprint = sha1(fingerprintInput);

    entities.push({
      id: session.id,
      label: session.title || session.id,
      ts: session.updatedAt.toISOString(),
      content: blocks.join('\n\n'),
      metadata: {
        sessionId: session.id,
        messageCount: messages.length,
        lastMessageId,
      },
      fingerprint,
    });
  }

  return entities;
}

/**
 * Incremental variant: only query sessions updated since lastRefresh.
 */
export async function readChatEntitiesIncremental(
  userId: string,
  lastRefresh: Date,
): Promise<Entity[]> {
  const prisma = (await import('@/lib/db/client')).default;

  const sessions = await prisma.dtSession.findMany({
    where: {
      userId,
      updatedAt: { gt: lastRefresh },
    },
    orderBy: { updatedAt: 'desc' },
    take: SNAPSHOT_PAGE_SIZE,
  });

  if (sessions.length === 0) return [];

  // Batch query messages
  const sessionIds = sessions.map((s) => s.id);
  const allMessages = await prisma.dtMessage.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: 'asc' },
  });

  const messagesBySession = new Map<string, typeof allMessages>();
  for (const msg of allMessages) {
    const arr = messagesBySession.get(msg.sessionId) ?? [];
    if (arr.length < MAX_MESSAGES_PER_SESSION) {
      arr.push(msg);
    }
    messagesBySession.set(msg.sessionId, arr);
  }

  const entities: Entity[] = [];
  for (const session of sessions) {
    const messages = messagesBySession.get(session.id) ?? [];
    const blocks: string[] = [];
    let lastMessageId: number | null = null;

    for (const msg of messages) {
      const body = (msg.content as string)?.trim();
      if (!body) continue;
      blocks.push(`### ${msg.role}\n${body}`);
      lastMessageId = msg.id;
    }

    if (blocks.length === 0) continue;

    const fingerprintInput = `${lastMessageId ?? 'none'}:${session.updatedAt.toISOString()}`;
    const fingerprint = sha1(fingerprintInput);

    entities.push({
      id: session.id,
      label: session.title || session.id,
      ts: session.updatedAt.toISOString(),
      content: blocks.join('\n\n'),
      metadata: {
        sessionId: session.id,
        messageCount: messages.length,
        lastMessageId,
      },
      fingerprint,
    });
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * Compare current entities against a previous SnapshotState.
 * Returns a list of changes (added, modified, removed).
 */
export function diffSnapshots(
  currentEntities: Entity[],
  prevState: SnapshotState,
): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  const now = new Date().toISOString();
  const currentIds = new Set(currentEntities.map((e) => e.id));

  // Detect added and modified
  for (const entity of currentEntities) {
    const prevFp = prevState.fingerprints[entity.id];
    if (!prevFp) {
      // New entity
      changes.push({
        ts: now,
        kind: 'added',
        entityId: entity.id,
        label: entity.label,
        prevFingerprint: null,
        newFingerprint: entity.fingerprint,
      });
    } else if (prevFp !== entity.fingerprint) {
      // Modified entity
      changes.push({
        ts: now,
        kind: 'modified',
        entityId: entity.id,
        label: entity.label,
        prevFingerprint: prevFp,
        newFingerprint: entity.fingerprint,
      });
    }
  }

  // Detect removed
  for (const prevId of Object.keys(prevState.fingerprints)) {
    if (!currentIds.has(prevId)) {
      changes.push({
        ts: now,
        kind: 'removed',
        entityId: prevId,
        label: prevState.labels[prevId] || prevId,
        prevFingerprint: prevState.fingerprints[prevId],
        newFingerprint: null,
      });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Snapshot Store (state.json + changes.jsonl)
// ---------------------------------------------------------------------------

export class SnapshotStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(process.cwd(), MEMORY_BASE_DIR);
  }

  /**
   * Read the snapshot state for a user+surface.
   * Returns null if no state exists (first-time snapshot).
   */
  async readState(userId: string, surface: Surface): Promise<SnapshotState | null> {
    const filePath = join(this.baseDir, userId, 'snapshot', surface, 'state.json');
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as SnapshotState;
    } catch {
      return null;
    }
  }

  /**
   * Write the snapshot state.
   */
  async writeState(userId: string, surface: Surface, state: SnapshotState): Promise<void> {
    const dir = join(this.baseDir, userId, 'snapshot', surface);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'state.json');
    await writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Append a change entry to the changes log.
   */
  async appendChange(userId: string, surface: Surface, change: ChangeEntry): Promise<void> {
    const dir = join(this.baseDir, userId, 'snapshot', surface);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'changes.jsonl');
    const line = JSON.stringify(change) + '\n';
    await writeFile(filePath, line, { flag: 'a', encoding: 'utf-8' });
  }

  /**
   * Append multiple change entries.
   */
  async appendChanges(userId: string, surface: Surface, changes: ChangeEntry[]): Promise<void> {
    for (const change of changes) {
      await this.appendChange(userId, surface, change);
    }
  }
}

// ---------------------------------------------------------------------------
// Refresh (top-level operation)
// ---------------------------------------------------------------------------

/**
 * Refresh the snapshot for a user+surface.
 * 1. Read current entities (incremental if state exists)
 * 2. Diff against previous state
 * 3. Update state.json + changes.jsonl
 * 4. Return the changes
 *
 * This is a "safe" operation — errors are caught and logged, never thrown.
 */
export async function refreshSnapshot(
  userId: string,
  surface: Surface,
  store: SnapshotStore,
): Promise<ChangeEntry[]> {
  try {
    // 1. Read previous state
    const prevState = await store.readState(userId, surface);

    // 2. Read current entities (full or incremental)
    let entities: Entity[];
    if (surface === 'chat') {
      if (prevState) {
        entities = await readChatEntitiesIncremental(
          userId,
          new Date(prevState.lastRefresh),
        );
      } else {
        entities = await readChatEntities(userId);
      }
    } else {
      // Only chat surface is implemented for now
      log.debug(`Snapshot for surface "${surface}" not yet implemented, skipping`);
      return [];
    }

    // 3. Diff
    const emptyState: SnapshotState = {
      fingerprints: {},
      labels: {},
      lastRefresh: '',
    };
    const changes = diffSnapshots(entities, prevState ?? emptyState);

    if (changes.length === 0) {
      log.debug(`No snapshot changes for user=${userId} surface=${surface}`);
      return [];
    }

    // 4. Update state
    const newState: SnapshotState = prevState
      ? { ...prevState }
      : { fingerprints: {}, labels: {}, lastRefresh: '' };

    for (const entity of entities) {
      newState.fingerprints[entity.id] = entity.fingerprint;
      newState.labels[entity.id] = entity.label;
    }

    // Remove fingerprints for removed entities
    for (const change of changes) {
      if (change.kind === 'removed') {
        delete newState.fingerprints[change.entityId];
        delete newState.labels[change.entityId];
      }
    }

    newState.lastRefresh = new Date().toISOString();

    await store.writeState(userId, surface, newState);
    await store.appendChanges(userId, surface, changes);

    log.info(
      `Snapshot refreshed: user=${userId} surface=${surface} changes=${changes.length} ` +
      `(added=${changes.filter(c => c.kind === 'added').length} ` +
      `modified=${changes.filter(c => c.kind === 'modified').length} ` +
      `removed=${changes.filter(c => c.kind === 'removed').length})`,
    );

    return changes;
  } catch (err) {
    log.error(`Snapshot refresh failed: user=${userId} surface=${surface}:`, err);
    return [];
  }
}
