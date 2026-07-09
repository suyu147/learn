/**
 * Auth Store — Frontend authentication state management
 *
 * Zustand store that tracks the current user, auth mode, and JWT token.
 * Provides login/logout/register actions that call the backend auth endpoints.
 *
 * The JWT token is also pushed into lib/auth-token.ts so that the shared
 * api-client.ts can inject it as an Authorization header on every request.
 */

import { create } from 'zustand';
import { setApiToken } from '@/lib/auth-token';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export type AuthMode = 'disabled' | 'single' | 'multi';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  mode: AuthMode | null;
  isInitialized: boolean;

  /** Login with credentials (multi mode). Also works for disabled mode (empty creds). */
  login: (username: string, password: string) => Promise<void>;

  /** Register a new user (multi mode only). */
  register: (username: string, password: string) => Promise<void>;

  /** Clear auth state and token. */
  logout: () => void;

  /**
   * Initialize auth state on app startup.
   * Calls GET /api/v1/auth/status to discover the auth mode and obtain a token.
   * In disabled/single mode, the server returns a pre-issued token and user.
   * In multi mode, user is null — the frontend must show a login form.
   */
  initAuth: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  mode: null,
  isInitialized: false,

  login: async (username, password) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Login failed (${res.status})`);
    }

    const { data } = (await res.json()) as {
      data: { token: string; user: AuthUser };
    };

    setApiToken(data.token);
    set({ token: data.token, user: data.user });
  },

  register: async (username, password) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Registration failed (${res.status})`);
    }

    const { data } = (await res.json()) as {
      data: { token: string; user: AuthUser };
    };

    setApiToken(data.token);
    set({ token: data.token, user: data.user });
  },

  logout: () => {
    setApiToken(null);
    set({ token: null, user: null });
  },

  initAuth: async () => {
    try {
      const res = await fetch('/api/v1/auth/status');

      if (!res.ok) {
        // Server error — assume disabled mode to avoid blocking the app
        set({ mode: 'disabled', isInitialized: true });
        return;
      }

      const { data } = (await res.json()) as {
        data: {
          mode: AuthMode;
          user: AuthUser | null;
          token?: string;
        };
      };

      // In disabled/single mode, the status endpoint returns a pre-issued
      // token so the frontend can immediately use it for API calls.
      if (data.token) {
        setApiToken(data.token);
      }

      set({
        mode: data.mode,
        user: data.user,
        token: data.token ?? null,
        isInitialized: true,
      });
    } catch {
      // Network error or server unavailable — assume disabled mode
      set({ mode: 'disabled', isInitialized: true });
    }
  },
}));
