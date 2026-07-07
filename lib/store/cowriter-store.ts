import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CowriterDoc {
  id: string;
  title: string;
  content: string;
  version: number;
  lastEdited: string;
  status: 'saved' | 'editing' | 'ai-generating';
}

interface CowriterState {
  documents: CowriterDoc[];
  activeDocId: string | null;
  addDoc: (d: CowriterDoc) => void;
  removeDoc: (id: string) => void;
  setActiveDoc: (id: string) => void;
  updateDocContent: (id: string, content: string) => void;
}

export const useCowriterStore = create<CowriterState>()(
  persist(
    (set) => ({
      documents: [],
      activeDocId: null,

      addDoc: (d) =>
        set((state) => ({
          documents: [...state.documents, d],
        })),

      removeDoc: (id) =>
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
          activeDocId:
            state.activeDocId === id ? null : state.activeDocId,
        })),

      setActiveDoc: (id) => set({ activeDocId: id }),

      updateDocContent: (id, content) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id
              ? {
                  ...d,
                  content,
                  version: d.version + 1,
                  lastEdited: new Date().toISOString(),
                  status: 'editing' as const,
                }
              : d
          ),
        })),
    }),
    { name: 'sl-cowriter-storage' }
  )
);
