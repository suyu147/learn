import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LearningProfile, ProfileDimensions, ConversationMessage } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';

interface LearningProfileState {
  profile: LearningProfile | null;
  /** 归档的旧画像（key=profileId），用于保存聊天记录 */
  archivedProfiles: Record<string, LearningProfile>;
  isChatOpen: boolean;
  isGenerating: boolean;
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
}

export const useLearningProfileStore = create<LearningProfileState>()(
  persist(
    immer((set, get) => ({
      profile: null,
      archivedProfiles: {},
      isChatOpen: false,
      isGenerating: false,

      setProfile: (profile) => {
        console.log('Setting profile:', profile);
        set({ profile });
      },

      updateDimensions: (dimensions) => {
        console.log('Updating dimensions with:', dimensions);
        set((state) => {
          const currentDimensions = state.profile?.dimensions ?? { ...DEFAULT_DIMENSIONS };
          
          // 深度合并 dimensions
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

      reset: () => set({ profile: null, isChatOpen: false, isGenerating: false }),
    })),
    { name: 'learning-profile-storage', partialize: (state) => ({ profile: state.profile, archivedProfiles: state.archivedProfiles }) },
  ),
);
