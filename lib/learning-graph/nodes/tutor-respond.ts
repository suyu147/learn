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

/**
 * 判断某个维度是否已收集到有效数据（与 profile-utils.ts 的进度计算标准一致）。
 * 注意：只判断用户实际填写的内容，不判默认值。
 */
function isDimensionFilled(key: keyof ProfileDimensions, dims: ProfileDimensions): boolean {
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

const DIMENSION_KEYS: (keyof ProfileDimensions)[] = [
  'knowledgeBase', 'cognitiveStyle', 'learningGoals', 'weakPoints',
  'timePreference', 'interests', 'learningPace', 'errorPatterns',
];

/**
 * 合并画像维度：已填维度锁死不覆盖，只允许未填维度写入 partial 数据。
 */
function mergeProfileDimensions(
  current: ProfileDimensions,
  partial: Partial<ProfileDimensions>,
): ProfileDimensions {
  // 以 current 为基准（已带 DEFAULT_DIMENSIONS 兜底），只对未填维度应用 partial
  const merged = { ...current } as Record<string, unknown>;

  for (const key of DIMENSION_KEYS) {
    const partialVal = (partial as Record<string, unknown>)[key];
    if (!partialVal || typeof partialVal !== 'object') continue;

    if (isDimensionFilled(key, current)) {
      // 该维度已有有效数据 → 锁死，不覆盖
      continue;
    }

    // 该维度未填写 → 允许写入 partial
    const currentVal = (current as unknown as Record<string, unknown>)[key];
    merged[key] = { ...(currentVal as object), ...partialVal };
  }

  return merged as unknown as ProfileDimensions;
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
      const currentProfileDims = (state.profile as ProfileDimensions | undefined) ?? DEFAULT_DIMENSIONS;
      const result = streamProfileBuildResponse(
        state.message,
        state.conversationHistory,
        currentProfileDims,
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

