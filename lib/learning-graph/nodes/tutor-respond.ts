import type { LearnEvent } from '../types';
import type { LearningStateType } from '../state';
import { streamTutorResponse, streamProfileBuildResponse, extractProfileDimensions } from '../helpers/tutor';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import type { ProfileDimensions } from '@/lib/types/profile';
import { addMessage } from '@/lib/deeptutor/services/session';
import { getLearnerProfileService } from '@/lib/deeptutor/services/learner-profile';
import { createLogger } from '@/lib/logger';

const log = createLogger('TutorRespondNode');
const learnerProfileService = getLearnerProfileService();

function getWriter(config: { configurable?: { writer?: (event: LearnEvent) => void } }) {
  return config.configurable?.writer ?? (() => undefined);
}

function getUserId(config: { configurable?: { userId?: string } }): string {
  return config.configurable?.userId ?? 'anonymous';
}

function mergeProfileDimensions(
  current: ProfileDimensions,
  partial: Partial<ProfileDimensions>,
): ProfileDimensions {
  return {
    ...DEFAULT_DIMENSIONS,
    ...current,
    ...partial,
    knowledgeBase: { ...DEFAULT_DIMENSIONS.knowledgeBase, ...current.knowledgeBase, ...partial.knowledgeBase },
    cognitiveStyle: { ...DEFAULT_DIMENSIONS.cognitiveStyle, ...current.cognitiveStyle, ...partial.cognitiveStyle },
    learningGoals: { ...DEFAULT_DIMENSIONS.learningGoals, ...current.learningGoals, ...partial.learningGoals },
    weakPoints: { ...DEFAULT_DIMENSIONS.weakPoints, ...current.weakPoints, ...partial.weakPoints },
    timePreference: { ...DEFAULT_DIMENSIONS.timePreference, ...current.timePreference, ...partial.timePreference },
    interests: { ...DEFAULT_DIMENSIONS.interests, ...current.interests, ...partial.interests },
    learningPace: { ...DEFAULT_DIMENSIONS.learningPace, ...current.learningPace, ...partial.learningPace },
    errorPatterns: { ...DEFAULT_DIMENSIONS.errorPatterns, ...current.errorPatterns, ...partial.errorPatterns },
  };
}


function getSessionId(
  config: { configurable?: { sessionId?: string } },
  state: LearningStateType,
): string | undefined {
  return config.configurable?.sessionId ?? state.sessionId;
}

function isProfileChat(
  config: { configurable?: { profileChat?: boolean; sessionId?: string } },
  sessionId: string | undefined,
): boolean {
  return config.configurable?.profileChat === true || (typeof sessionId === 'string' && sessionId.startsWith('profile-'));
}

export async function tutorRespondNode(
  state: LearningStateType,
  config: { configurable?: { writer?: (event: LearnEvent) => void; userId?: string; sessionId?: string; profileChat?: boolean } },
) {
  const write = getWriter(config);
  const userId = getUserId(config);
  const persistedSessionId = getSessionId(config, state);
  const profileChat = isProfileChat(config, persistedSessionId);

  write({ type: 'phase_start', phase: 'tutor' });

  try {
    // Collect streamed text for profile extraction
    let fullText = '';

    if (profileChat) {
      // Profile-building conversation: use specialized prompt
      const result = streamProfileBuildResponse(
        state.message,
        state.conversationHistory,
        state.aiConfig,
      );
      for await (const chunk of result.textStream) {
        fullText += chunk;
        write({ type: 'tutor_response', text: chunk });
      }
    } else {
      // Regular tutor chat: use general tutor prompt
      const result = streamTutorResponse(
        state.message,
        state.conversationHistory,
        state.attachedResources,
        state.currentNodeTitle ?? state.currentNode?.title,
        state.aiConfig,
      );
      for await (const chunk of result.textStream) {
        fullText += chunk;
        write({ type: 'tutor_response', text: chunk });
      }
    }

    write({ type: 'phase_end', phase: 'tutor' });

    // After streaming, extract profile dimensions for profile chats
    if (profileChat && fullText) {
      try {
        write({ type: 'phase_start', phase: 'update_profile' });

        // Build updated conversation including the latest exchange
        const updatedHistory = [
          ...(state.conversationHistory ?? []),
          { role: 'user', content: state.message },
          { role: 'assistant', content: fullText },
        ];

        const currentDimensions = state.profile ?? DEFAULT_DIMENSIONS;
        const extracted = await extractProfileDimensions(updatedHistory, currentDimensions, state.aiConfig);

        if (extracted && Object.keys(extracted).length > 0) {
          const mergedDimensions = mergeProfileDimensions(currentDimensions, extracted);
          write({ type: 'profile_update', dimensions: mergedDimensions });
          log.info(`Profile dimensions extracted and emitted (${Object.keys(extracted).length} fields updated)`);

          await learnerProfileService.updateProfileDimensions(userId, mergedDimensions, 'profile_chat');
          await learnerProfileService.markProfileCompleted(userId, 'profile_chat');
        }

        if (persistedSessionId) {
          await addMessage(persistedSessionId, userId, 'assistant', fullText, {
            capability: 'profile_build',
            metadata: { source: 'profile-chat', profileUpdate: true },
          });
        }

        write({ type: 'phase_end', phase: 'update_profile' });
      } catch (extractError) {
        log.warn('Profile extraction failed, continuing without update:', extractError);
        write({ type: 'phase_end', phase: 'update_profile' });
      }
    }

    return { phase: 'tutor' };
  } catch (error) {
    write({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    write({ type: 'phase_end', phase: 'tutor' });
    return { phase: 'tutor' };
  }
}

