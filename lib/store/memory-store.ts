import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MemoryEntry {
  id: string;
  layer: 'L1' | 'L2' | 'L3';
  content: string;
  tags: string[];
  timestamp: string;
  source?: string;
}

interface MemoryState {
  entries: MemoryEntry[];
  activeLayer: 'L1' | 'L2' | 'L3';
  setActiveLayer: (l: 'L1' | 'L2' | 'L3') => void;
  addEntry: (e: MemoryEntry) => void;
  removeEntry: (id: string) => void;
  consolidate: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set) => ({
      entries: [],
      activeLayer: 'L1',

      setActiveLayer: (l) => set({ activeLayer: l }),

      addEntry: (e) =>
        set((state) => ({
          entries: [...state.entries, e],
        })),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      consolidate: () => {
        // TODO: Implement memory consolidation logic
        // Move L1 entries to L2 based on age/relevance, merge L2 into L3
      },
    }),
    { name: 'sl-memory-storage' }
  )
);
