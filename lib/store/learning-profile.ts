import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LearningProfile, ProfileDimensions, ConversationMessage } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import { fetchProfile, saveProfile } from '@/lib/api/learning-profile-api';
import { createLogger } from '@/lib/logger';
import { getApiToken } from '@/lib/auth-token';
import { useAuthStore } from './auth-store';

const log = createLogger('LearningProfileStore');

/** 获取当前登录用户的真实 ID，兜底 'anonymous' */
function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id ?? 'anonymous';
}

interface LearningProfileState {
  profile: LearningProfile | null;
  /** 归档的旧画像（key=profileId），用于保存聊天记录 */
  archivedProfiles: Record<string, LearningProfile>;
  profileHistory: Array<{ version: number; dimensions: ProfileDimensions; updatedAt: string }>;
  isChatOpen: boolean;
  isGenerating: boolean;
  synced: boolean;
  /** 上次同步时的用户 ID，用于检测用户切换 */
  lastSyncedUserId: string | null;
  saveError: string | null;
  setProfile: (profile: LearningProfile | null) => void;
  restoreArchivedProfile: (profileId: string) => LearningProfile | null;
  updateDimensions: (dimensions: Partial<ProfileDimensions>) => void;
  setChatOpen: (open: boolean) => void;
  setGenerating: (generating: boolean) => void;
  addConversationMessage: (message: ConversationMessage) => void;
  /** 将当前画像归档，返回归档ID（用于会话关联） */
  archiveCurrentProfile: () => string | null;
  /** 删除单个归档画像 */
  clearArchivedProfile: (profileId: string) => void;
  /** 删除全部归档画像 */
  clearAllArchivedProfiles: () => void;
  reset: () => void;
  /** Fetch profile from server and update local state */
  syncFromServer: (userId: string) => Promise<void>;
  /** Push local profile to server */
  syncToServer: (userId: string) => Promise<void>;
  /** Reset for a new user (called on logout/new login) */
  resetForNewUser: () => void;
}

export const useLearningProfileStore = create<LearningProfileState>()(
  persist(
    immer((set, get) => ({
      profile: null,
      archivedProfiles: {},
      profileHistory: [],
      isChatOpen: false,
      isGenerating: false,
      synced: false,
      lastSyncedUserId: null,
      saveError: null,

      setProfile: (profile) => {
        console.log('Setting profile:', profile);
        set({ profile });
      },

      updateDimensions: (dimensions) => {
        console.log('Updating dimensions with:', dimensions);

        // 先通过 get() 读取当前状态，在 set() 外部计算 mergedDimensions
        const currentState = get();
        const currentDimensions = currentState.profile?.dimensions ?? { ...DEFAULT_DIMENSIONS };

        /**
         * 判断某个维度是否已收集到有效数据（与 profile-utils.ts 的进度计算标准一致）。
         * 已填维度锁死，后续无论 LLM 返回什么数据都不覆盖。
         */
        function isFilled(key: keyof ProfileDimensions, dims: ProfileDimensions): boolean {
          switch (key) {
            case 'knowledgeBase': return dims.knowledgeBase.subjects.length > 0;
            case 'cognitiveStyle': return dims.cognitiveStyle.preference.length > 0;
            case 'learningGoals': return dims.learningGoals.shortTerm.length > 0 || dims.learningGoals.longTerm.length > 0;
            case 'weakPoints': return dims.weakPoints.topics.length > 0 || dims.weakPoints.errorPatterns.length > 0;
            case 'timePreference': return dims.timePreference.preferredDuration > 0 || dims.timePreference.preferredTimeSlot.length > 0;
            case 'interests': return dims.interests.domains.length > 0;
            case 'learningPace': return dims.learningPace.depthPreference.length > 0;
            case 'errorPatterns': return dims.errorPatterns.commonMistakes.length > 0 || dims.errorPatterns.difficultAreas.length > 0;
            default: return false;
          }
        }

        const DIM_KEYS: (keyof ProfileDimensions)[] = [
          'knowledgeBase', 'cognitiveStyle', 'learningGoals', 'weakPoints',
          'timePreference', 'interests', 'learningPace', 'errorPatterns',
        ];

        // 以当前维度为基准，只对未填维度合并 incoming 数据
        const mergedDimensions = { ...currentDimensions } as Record<string, unknown>;

        for (const key of DIM_KEYS) {
          const incomingVal = (dimensions as Record<string, unknown>)[key];
          if (!incomingVal || typeof incomingVal !== 'object') continue;

          if (isFilled(key, currentDimensions)) {
            // 已填 → 锁死，不覆盖
            continue;
          }

          // 未填 → 合并
          const currentVal = (currentDimensions as unknown as Record<string, unknown>)[key];
          mergedDimensions[key] = { ...(currentVal as object), ...incomingVal };
        }

        const result = mergedDimensions as unknown as ProfileDimensions;

        // 直接 mutate draft（immer 推荐模式），不要 return partial state
        // return + draft mutation 混用会导致 immer 行为不一致
        set((state) => {
          if (state.profile) {
            state.profileHistory.push({
              version: state.profile.version,
              dimensions: state.profile.dimensions,
              updatedAt: state.profile.updatedAt,
            });
          }

          state.profile = {
            id: state.profile?.id ?? crypto.randomUUID(),
            userId: getCurrentUserId(),
            updatedAt: new Date().toISOString(),
            version: (state.profile?.version ?? 0) + 1,
            dimensions: result,
            conversationHistory: state.profile?.conversationHistory ?? [],
          };
        });

        // 数据库写入（仅客户端，静默失败不影响本地使用）
        if (typeof window !== 'undefined') {
          const userId = getCurrentUserId();
          const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-user-id': userId };
          const token = getApiToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
          fetch('/api/v1/smartlearn/profile', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ dimensions: result }),
          }).then((response) => {
            if (!response.ok) throw new Error(`Profile save failed (${response.status})`);
            set({ saveError: null });
          }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Profile save failed';
            log.error(message);
            set({ saveError: message });
          });
        }
      },

      setChatOpen: (isChatOpen) => set({ isChatOpen }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      /** 恢复某个归档画像为当前画像 */
      restoreArchivedProfile: (profileId: string) => {
        const archivedProfile = get().archivedProfiles[profileId];
        if (!archivedProfile) return null;
        set({
          profile: { ...archivedProfile },
          isChatOpen: true,
        });
        return archivedProfile;
      },

      addConversationMessage: (message) =>
        set((state) => {
          const currentProfile = state.profile;
          state.profile = currentProfile ? {
            ...currentProfile,
            conversationHistory: [...currentProfile.conversationHistory, message],
            updatedAt: new Date().toISOString(),
          } : {
            id: crypto.randomUUID(),
            userId: getCurrentUserId(),
            updatedAt: new Date().toISOString(),
            version: 1,
            dimensions: { ...DEFAULT_DIMENSIONS },
            conversationHistory: [message],
          };
        }),

      /** 将当前画像归档（保留聊天记录），返回归档的 profileId */
      archiveCurrentProfile: () => {
        const state = get();
        if (!state.profile) return null;
        const profileId = state.profile.id;
        set((draft) => {
          draft.archivedProfiles[profileId] = { ...state.profile! };
        });
        return profileId;
      },

      /** 删除单个归档画像（彻底清除聊天记录） */
      clearArchivedProfile: (profileId: string) => {
        set((draft) => {
          delete draft.archivedProfiles[profileId];
        });
      },

      /** 删除全部归档画像 */
      clearAllArchivedProfiles: () => {
        set((draft) => {
          draft.archivedProfiles = {};
        });
      },

      reset: () => set({ profile: null, profileHistory: [], isChatOpen: false, isGenerating: false }),

      resetForNewUser: () => {
        set({ profile: null, profileHistory: [], archivedProfiles: {}, isChatOpen: false, isGenerating: false, synced: false, lastSyncedUserId: null, saveError: null });
      },

      syncFromServer: async (userId: string) => {
        // 检测用户切换：如果上次同步的用户与当前用户不同，清除旧数据并强制重新同步
        const lastUserId = get().lastSyncedUserId;
        if (lastUserId && lastUserId !== userId) {
          log.info(`User changed (${lastUserId} → ${userId}), clearing old profile data`);
          set({ profile: null, profileHistory: [], archivedProfiles: {}, synced: false });
        }

        if (get().synced) return;
        try {
          const response = await fetchProfile(userId);
          const serverProfile = response?.profile;
          if (serverProfile?.dimensions) {
            set((state) => {
              state.profile = {
                id: serverProfile.id ?? crypto.randomUUID(),
                userId: serverProfile.userId ?? userId,
                version: serverProfile.version ?? 1,
                dimensions: serverProfile.dimensions!,
                updatedAt: serverProfile.updatedAt ?? new Date().toISOString(),
                conversationHistory: state.profile?.conversationHistory ?? [],
              };
              state.synced = true;
              state.lastSyncedUserId = userId;
            });
          } else {
            set((state) => {
              state.synced = true;
              state.lastSyncedUserId = userId;
            });
          }
        } catch (err) {
          log.error('syncFromServer failed:', err);
          set((state) => {
            state.synced = true;
            state.lastSyncedUserId = userId;
          });
        }
      },

      syncToServer: async (userId: string) => {
        const { profile } = get();
        if (!profile) return;
        try {
          await saveProfile(userId, profile.dimensions);
        } catch (err) {
          log.error('syncToServer failed:', err);
        }
      },
    })),
    {
      name: 'learning-profile-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // v0→v1: Reset old defaults that caused inflated completeness
          // (preferredDuration 30→0, preferredTimeSlot 'evening'→'',
          //  depthPreference 'broad'→'', preferredFormats ['document']→[])
          const profile = state.profile as Record<string, unknown> | null;
          if (profile?.dimensions) {
            const dims = profile.dimensions as Record<string, unknown>;
            const tp = dims.timePreference as Record<string, unknown> | undefined;
            if (tp?.preferredDuration === 30) tp.preferredDuration = 0;
            if (tp?.preferredTimeSlot === 'evening') tp.preferredTimeSlot = '';
            const lp = dims.learningPace as Record<string, unknown> | undefined;
            if (lp?.depthPreference === 'broad') lp.depthPreference = '';
            const ints = dims.interests as Record<string, unknown> | undefined;
            const pf = ints?.preferredFormats as unknown[] | undefined;
            if (pf?.length === 1 && pf[0] === 'document') ints!.preferredFormats = [];
          }
        }
        // v1→v2: Clear stale 'current' userId and add lastSyncedUserId
        {
          const profile = state.profile as Record<string, unknown> | null;
          if (profile?.userId === 'current') {
            // userId='current' 无法确定属于哪个用户，强制清空让 syncFromServer 重新拉取
            state.profile = null;
          }
          state.lastSyncedUserId = null;
        }
        return state;
      },
      partialize: (state) => ({
        profile: state.profile,
        archivedProfiles: state.archivedProfiles,
        profileHistory: state.profileHistory,
        lastSyncedUserId: state.lastSyncedUserId,
      }),
    },
  ),
);
