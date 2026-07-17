/**
 * Memory Consolidation Subscriber
 *
 * Wires the EventBus CAPABILITY_COMPLETE event to:
 * 1. Snapshot refresh → auto-emit L1 trace
 * 2. Memory consolidation (L1→L2→L3)
 *
 * Includes a per-user lock to prevent concurrent consolidate runs
 * from writing the same files simultaneously.
 *
 * Registered once during bootstrap.
 */

import { createLogger } from '@/lib/logger';
import { getEventBus, EventBusEvents } from '@/lib/deeptutor/core/event-bus';
import type { MemoryServiceImpl, Surface } from '@/lib/deeptutor/services/memory';
import { refreshSnapshot, SnapshotStore } from '@/lib/deeptutor/services/memory/snapshot';

const log = createLogger('MemorySubscriber');

/** Capability name → Memory surface mapping */
const CAPABILITY_TO_SURFACE: Record<string, Surface> = {
  chat: 'chat',
  deep_solve: 'quiz',
  mastery_path: 'quiz',
  deep_research: 'chat',
  deep_question: 'quiz',
  visualize: 'chat',
  smartlearn: 'quiz',
  book: 'book',
  co_writer: 'cowriter',
  notebook: 'notebook',
  explore_context: 'chat',
};

interface CapabilityCompletePayload {
  turnId: string;
  sessionId: string;
  userId: string;
  capability: string;
}

// ---------------------------------------------------------------------------
// Per-user consolidation lock
// ---------------------------------------------------------------------------

/** Tracks which user+surface combos are currently consolidating */
const consolidatingKeys = new Set<string>();

// ---------------------------------------------------------------------------
// Subscriber registration
// ---------------------------------------------------------------------------

/**
 * Register the memory consolidation subscriber on the global EventBus.
 * Should be called once during bootstrap after MemoryService is initialized.
 */
export function registerMemorySubscriber(memoryService: MemoryServiceImpl): void {
  const eventBus = getEventBus();
  const snapshotStore = new SnapshotStore();

  eventBus.on(EventBusEvents.CAPABILITY_COMPLETE, (...args: unknown[]) => {
    const payload = args[0] as CapabilityCompletePayload;
    if (!payload || !payload.userId || !payload.capability) return;

    const surface = CAPABILITY_TO_SURFACE[payload.capability] ?? 'chat';
    const lockKey = `${payload.userId}:${surface}`;

    // Skip if a consolidation is already running for this user+surface
    if (consolidatingKeys.has(lockKey)) {
      log.debug(`Consolidation already in progress for ${lockKey}, skipping`);
      return;
    }

    consolidatingKeys.add(lockKey);

    // Fire-and-forget: snapshot + consolidation is async but we don't block on it
    (async () => {
      try {
        // Step 1: Snapshot refresh → auto-detect changes → emit L1 traces
        const changes = await refreshSnapshot(
          payload.userId,
          surface,
          snapshotStore,
        );

        // Emit L1 trace for each snapshot change
        for (const change of changes) {
          try {
            await memoryService.emitTrace(payload.userId, {
              surface,
              kind: `snapshot_${change.kind}`,
              payload: {
                entityId: change.entityId,
                label: change.label,
                prevFingerprint: change.prevFingerprint,
                newFingerprint: change.newFingerprint,
              },
              sessionId: change.entityId,
              turnId: payload.turnId,
            });
          } catch (err) {
            log.warn('emitTrace failed for snapshot change:', err);
          }
        }

        // Step 2: Consolidation (L1→L2→L3)
        // Only run consolidate if there are new changes
        if (changes.length > 0) {
          await memoryService.consolidate(payload.userId, surface);
        }

        log.debug(
          `Memory pipeline completed: user=${payload.userId}, ` +
          `capability=${payload.capability}, surface=${surface}, ` +
          `changes=${changes.length}`,
        );
      } catch (err) {
        log.warn('Memory pipeline failed:', err);
      } finally {
        consolidatingKeys.delete(lockKey);
      }
    })();
  });

  log.info('Memory consolidation subscriber registered on CAPABILITY_COMPLETE (with Snapshot + lock)');
}
