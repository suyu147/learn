/**
 * Memory Consolidation Subscriber
 *
 * Wires the EventBus CAPABILITY_COMPLETE event to MemoryService.consolidate().
 * When a capability finishes a turn, the subscriber triggers L1→L2 rollup
 * and L2→L3 synthesis for the relevant surface.
 *
 * Registered once during bootstrap.
 */

import { createLogger } from '@/lib/logger';
import { getEventBus, EventBusEvents } from '@/lib/deeptutor/core/event-bus';
import type { MemoryServiceImpl, Surface } from '@/lib/deeptutor/services/memory';

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

/**
 * Register the memory consolidation subscriber on the global EventBus.
 * Should be called once during bootstrap after MemoryService is initialized.
 */
export function registerMemorySubscriber(memoryService: MemoryServiceImpl): void {
  const eventBus = getEventBus();

  eventBus.on(EventBusEvents.CAPABILITY_COMPLETE, (...args: unknown[]) => {
    const payload = args[0] as CapabilityCompletePayload;
    if (!payload || !payload.userId || !payload.capability) return;

    const surface = CAPABILITY_TO_SURFACE[payload.capability] ?? 'chat';

    // Fire-and-forget: consolidation is async but we don't block on it
    memoryService.consolidate(payload.userId, surface).catch((err) => {
      log.warn('Async consolidation failed:', err);
    });

    log.debug(
      `Consolidation triggered: user=${payload.userId}, capability=${payload.capability}, surface=${surface}`,
    );
  });

  log.info('Memory consolidation subscriber registered on CAPABILITY_COMPLETE');
}
