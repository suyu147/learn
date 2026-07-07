import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Session {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'failed';
  // SmartLearn-specific session metadata (optional for backward compatibility)
  smartlearnProfileId?: string;
  smartlearnGoal?: string;
  smartlearnNodeCount?: number;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (s: Session) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  getSessionsByMode: (mode: string) => Session[];
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      addSession: (s) =>
        set((state) => ({
          sessions: [...state.sessions, s],
        })),

      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId:
            state.activeSessionId === id ? null : state.activeSessionId,
        })),

      setActiveSession: (id) => set({ activeSessionId: id }),

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      getSessionsByMode: (mode) =>
        get().sessions.filter((s) => s.mode === mode),
    }),
    { name: 'sl-session-storage' }
  )
);
