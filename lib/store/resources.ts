import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resource, ResourceType } from '@/lib/types/resource';
import { useSessionsStore } from './sessions';

interface StoredResourcesData {
  [sessionId: string]: Resource[];
}

interface ResourcesState {
  storedResources: StoredResourcesData;
  resources: Resource[];
  generatingTypes: ResourceType[];

  addResource: (resource: Resource) => void;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  removeResource: (id: string) => void;
  setGeneratingTypes: (types: ResourceType[]) => void;
  getResourcesByType: (type: ResourceType) => Resource[];
  loadResourcesForSession: (sessionId: string) => void;
  getResourcesForSession: (sessionId: string) => Resource[];
  reset: () => void;
  /** 彻底删除指定会话的资源数据 */
  deleteSessionData: (sessionId: string) => void;
}

export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set, get) => ({
      storedResources: {},
      resources: [],
      generatingTypes: [],

      addResource: (resource) => {
        const sessionId = useSessionsStore.getState().currentSessionId;
        set((state) => {
          const updated = [...state.resources, resource];
          if (!sessionId) return { resources: updated };
          return {
            resources: updated,
            storedResources: { ...state.storedResources, [sessionId]: updated },
          };
        });
      },

      updateResource: (id, updates) => {
        const sessionId = useSessionsStore.getState().currentSessionId;
        set((state) => {
          const updated = state.resources.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          );
          if (!sessionId) return { resources: updated };
          return {
            resources: updated,
            storedResources: { ...state.storedResources, [sessionId]: updated },
          };
        });
      },

      removeResource: (id) => {
        const sessionId = useSessionsStore.getState().currentSessionId;
        set((state) => {
          const updated = state.resources.filter((r) => r.id !== id);
          if (!sessionId) return { resources: updated };
          return {
            resources: updated,
            storedResources: { ...state.storedResources, [sessionId]: updated },
          };
        });
      },

      setGeneratingTypes: (generatingTypes) => set({ generatingTypes }),

      getResourcesByType: (type) => get().resources.filter((r) => r.type === type),

      loadResourcesForSession: (sessionId) => {
        set((state) => ({
          resources: state.storedResources[sessionId] ?? [],
        }));
      },

      getResourcesForSession: (sessionId: string) => {
        return get().storedResources[sessionId] ?? [];
      },

      deleteSessionData: (sessionId: string) => {
        set((state) => {
          const { [sessionId]: _, ...rest } = state.storedResources;
          return { storedResources: rest, resources: state.resources, generatingTypes: state.generatingTypes };
        });
      },

      reset: () => {
        const sessionId = useSessionsStore.getState().currentSessionId;
        if (!sessionId) return set({ resources: [], generatingTypes: [] });
        set((state) => {
          const { [sessionId]: _, ...rest } = state.storedResources;
          return { storedResources: rest, resources: [], generatingTypes: [] };
        });
      },
    }),
    {
      name: 'resources-storage',
      version: 2,
      partialize: (state) => ({ storedResources: state.storedResources }),
      migrate: () => ({ storedResources: {} }),
    },
  ),
);