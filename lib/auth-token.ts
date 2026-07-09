/**
 * Auth Token — Frontend-only JWT token storage
 *
 * Standalone module used by api-client.ts to inject Authorization headers.
 * Kept separate from auth-store.ts to avoid circular imports.
 */

let _token: string | null = null;

/** Get the current JWT token (null = no auth). */
export function getApiToken(): string | null {
  return _token;
}

/** Set the JWT token for subsequent API requests. Pass null to clear. */
export function setApiToken(token: string | null): void {
  _token = token;
}
