import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LearningProfile, ProfileDimensions, ConversationMessage } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import { fetchProfile, saveProfile } from '@/lib/api/learning-profile-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('LearningProfileStore');

interface LearningProfileState {
  profile: LearningProfile | null;
  /** 归档的旧画像（key=profileId），用于保存聊天记录 */
  archivedProfiles: Record<string, LearningProfile>;
  profileHistory: Array<{ version: number; dimensions: ProfileDimensions; updatedAt: string }>;
  isChatOpen: boolean;
  isGenerating: boolean;
  synced: boolean;
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

        set((state) => {
          if (state.profile) {
            state.profileHistory.push({
              version: state.profile.version,
              dimensions: state.profile.dimensions,
              updatedAt: state.profile.updatedAt,
            });
          }

          const newProfile: LearningProfile = {
            id: state.profile?.id ?? crypto.randomUUID(),
            userId: 'current',
            updatedAt: new Date().toISOString(),
            version: (state.profile?.version ?? 0) + 1,
            dimensions: mergedDimensions,
            conversationHistory: state.profile?.conversationHistory ?? [],
          };

          console.log('New profile created:', newProfile);
          return { profile: newProfile };
        });

        // 数据库写入（仅客户端，静默失败不影响本地使用）
        if (typeof window !== 'undefined') {
          fetch('/api/v1/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dimensions: mergedDimensions }),
          }).catch(() => {});
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
          const newProfile: LearningProfile = currentProfile ? {
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
          return { profile: newProfile };
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

      syncFromServer: async (userId: string) => {
        if (get().synced) return;
        try {
          const serverDimensions = await fetchProfile(userId);
          if (serverDimensions) {
            set((state) => {
              // Only apply server data if no local profile exists yet
              if (!state.profile) {
                state.profile = {
                  id: crypto.randomUUID(),
                  userId,
                  version: 1,
                  dimensions: serverDimensions,
                  updatedAt: new Date().toISOString(),
                  conversationHistory: [],
                };
              }
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
    { name: 'learning-profile-storage', partialize: (state) => ({ profile: state.profile, archivedProfiles: state.archivedProfiles, profileHistory: state.profileHistory }) },
  ),
);
