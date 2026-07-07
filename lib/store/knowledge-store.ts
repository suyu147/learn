import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  blockCount: number;
  indexStatus: 'ready' | 'indexing' | 'pending' | 'error';
  createdAt: string;
}

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  addKB: (kb: KnowledgeBase) => void;
  removeKB: (id: string) => void;
  updateKB: (id: string, updates: Partial<KnowledgeBase>) => void;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set) => ({
      knowledgeBases: [],

      addKB: (kb) =>
        set((state) => ({
          knowledgeBases: [...state.knowledgeBases, kb],
        })),

      removeKB: (id) =>
        set((state) => ({
          knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== id),
        })),

      updateKB: (id, updates) =>
        set((state) => ({
          knowledgeBases: state.knowledgeBases.map((kb) =>
            kb.id === id ? { ...kb, ...updates } : kb
          ),
        })),
    }),
    { name: 'sl-knowledge-storage' }
  )
);
