import type { Scene } from '@/lib/types/stage';
import type { GenerationResult } from '@/lib/generation/pipeline-types';

export interface StageStore {
  getState: () => {
    stage: import('@/lib/types/stage').Stage | null;
    scenes: Scene[];
    currentSceneId: string | null;
  };
  subscribe: (listener: (state: unknown) => void) => () => void;
}

export interface WhiteboardAPI {
  get: () => { success: boolean; data: WhiteboardData | null };
  addElement: (element: Record<string, unknown>, whiteboardId: string) => void;
  deleteElement: (elementId: string, whiteboardId: string) => void;
  update: (updates: Record<string, unknown>, whiteboardId: string) => void;
}

export interface WhiteboardData {
  id: string;
  elements?: Array<Record<string, unknown>>;
}

export interface SceneAPI {
  get: (sceneId: string) => Scene | null;
  update: (sceneId: string, updates: Partial<Scene>) => void;
  create: (scene: Partial<Scene> & { type: string; title: string; order: number; content: unknown }) => GenerationResult<Scene>;
}

export interface StageAPI {
  whiteboard: WhiteboardAPI;
  scene: SceneAPI;
}

export function createStageAPI(_store: StageStore): StageAPI {
  return {
    whiteboard: {
      get: () => ({ success: false, data: null }),
      addElement: () => {},
      deleteElement: () => {},
      update: () => {},
    },
    scene: {
      get: () => null,
      update: () => {},
      create: (sceneData) => ({
        success: true,
        data: {
          ...sceneData,
          id: `scene_${Date.now()}`,
          stageId: sceneData.stageId || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as Scene,
      }),
    },
  };
}
