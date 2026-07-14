/**
 * Clear all user-specific persisted store data from localStorage
 * Called on logout to prevent cross-user data contamination
 */

// List of all localStorage keys used by Zustand stores that need to be cleared on logout
const PERSISTED_STORE_KEYS = [
  'auth-jwt',
  'user-profile-storage',
  'learning-profile-storage',
  'chat-storage',
  'session-storage',
  'settings-storage',
  'book-store',
  'knowledge-store',
  'memory-store',
  'cowriter-store',
  'resources-storage',
  'learning-path-storage',
  'ui-store',
  'settings',
  'agent-activity',
  'resource-decisions',
  'sessions-storage',
] as const;

export function clearAllUserData(): void {
  if (typeof window === 'undefined') return;

  PERSISTED_STORE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to clear localStorage key ${key}:`, e);
    }
  });
}
