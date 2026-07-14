import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LearningProfile, ProfileDimensions, ConversationMessage } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import { fetchProfile, saveProfile } from '@/lib/api/learning-profile-api';
import { createLogger } from '@/lib/logger';
import { getApiToken } from '@/lib/auth-token';

const log = createLogger('LearningProfileStore');

interface LearningProfileState {
  profile: LearningProfile | null;
  /** 归档的旧画像（key=profileId），用于保存聊天记录 */
  archivedProfiles: Record<string, LearningProfile>;
  profileHistory: Array<{ version: number; dimensions: ProfileDimensions; updatedAt: string }>;
  isChatOpen: boolean;
  isGenerating: boolean;
  synced: boolean;
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

        const mergedDimensions: ProfileDimensions = {
          knowledgeBase: {
            ...currentDimensions.knowledgeBase,
            ...dimensions.knowledgeBase,
            subjects: dimensions.knowledgeBase?.subjects ?? currentDimensions.knowledgeBase.subjects,
          },
          cognitiveStyle: {
            ...currentDimensions.cognitiveStyle,
            ...dimensions.cognitiveStyle,
          },
          learningGoals: {
            ...currentDimensions.learningGoals,
            ...dimensions.learningGoals,
            shortTerm: dimensions.learningGoals?.shortTerm ?? currentDimensions.learningGoals.shortTerm,
          },
          weakPoints: {
            ...currentDimensions.weakPoints,
            ...dimensions.weakPoints,
            topics: dimensions.weakPoints?.topics ?? currentDimensions.weakPoints.topics,
            errorPatterns: dimensions.weakPoints?.errorPatterns ?? currentDimensions.weakPoints.errorPatterns,
          },
          timePreference: {
            ...currentDimensions.timePreference,
            ...dimensions.timePreference,
          },
          interests: {
            ...currentDimensions.interests,
            ...dimensions.interests,
            domains: dimensions.interests?.domains ?? currentDimensions.interests.domains,
            preferredFormats: dimensions.interests?.preferredFormats ?? currentDimensions.interests.preferredFormats,
          },
          learningPace: {
            ...currentDimensions.learningPace,
            ...dimensions.learningPace,
          },
          errorPatterns: {
            ...currentDimensions.errorPatterns,
            ...dimensions.errorPatterns,
            commonMistakes: dimensions.errorPatterns?.commonMistakes ?? currentDimensions.errorPatterns.commonMistakes,
            difficultAreas: dimensions.errorPatterns?.difficultAreas ?? currentDimensions.errorPatterns.difficultAreas,
          },
        };

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
            userId: 'current',
            updatedAt: new Date().toISOString(),
            version: (state.profile?.version ?? 0) + 1,
            dimensions: mergedDimensions,
            conversationHistory: state.profile?.conversationHistory ?? [],
          };
        });

        // 数据库写入（仅客户端，静默失败不影响本地使用）
        if (typeof window !== 'undefined') {
          const userId = get().profile?.userId ?? 'anonymous';
          const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-user-id': userId };
          const token = getApiToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
          fetch('/api/v1/smartlearn/profile', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ dimensions: mergedDimensions }),
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
            userId: 'current',
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
        set({ profile: null, profileHistory: [], archivedProfiles: {}, isChatOpen: false, isGenerating: false, synced: false, saveError: null });
      },

      syncFromServer: async (userId: string) => {
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
            });
          } else {
            set((state) => {
              state.synced = true;
            });
          }
        } catch (err) {
          log.error('syncFromServer failed:', err);
          set((state) => {
            state.synced = true;
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
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // v0→v1: Reset old defaults that caused inflated completeness
          // (preferredDuration 30→0, preferredTimeSlot 'evening'→'',
          //  depthPreference 'broad'→'', preferredFormats ['document']→[])
          const state = persistedState as Record<string, unknown>;
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
          return state;
        }
        return persistedState;
      },
      partialize: (state) => ({ profile: state.profile, archivedProfiles: state.archivedProfiles, profileHistory: state.profileHistory }),
    },
  ),
);
