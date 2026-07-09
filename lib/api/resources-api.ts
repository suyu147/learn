import { createLogger } from '@/lib/logger';
import type { Resource } from '@/lib/types/resource';

const log = createLogger('ResourcesAPI');

/**
 * Fetch resources for a learning session from the server.
 *
 * Resources are currently generated via the smartlearn/resources SSE endpoint
 * and stored client-side only. This is a placeholder for future DB sync.
 */
export async function fetchResources(_sessionId: string): Promise<Resource[]> {
  try {
    // Future: GET from a resources endpoint
    return [];
  } catch (err) {
    log.error('fetchResources failed:', err);
    return [];
  }
}

/**
 * Save resources to the server.
 *
 * Placeholder for future DB sync — currently a no-op.
 */
export async function saveResources(
  _sessionId: string,
  _resources: Resource[],
): Promise<boolean> {
  try {
    // Future: POST to a resources endpoint
    return false;
  } catch (err) {
    log.error('saveResources failed:', err);
    return false;
  }
}
