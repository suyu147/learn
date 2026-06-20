import type { LearnEvent } from '../types';
import type { LearningStateType } from '../state';
import { streamTutorResponse } from '../helpers/tutor';

function getWriter(config: { configurable?: { writer?: (event: LearnEvent) => void } }) {
  return config.configurable?.writer ?? (() => undefined);
}

export async function tutorRespondNode(
  state: LearningStateType,
  config: { configurable?: { writer?: (event: LearnEvent) => void } },
) {
  const write = getWriter(config);
  write({ type: 'phase_start', phase: 'tutor' });

  try {
    const result = streamTutorResponse(
      state.message,
      state.conversationHistory,
      state.attachedResources,
      state.currentNodeTitle ?? state.currentNode?.title,
      state.aiConfig,
    );
    for await (const chunk of result.textStream) {
      write({ type: 'tutor_response', text: chunk });
      write({ type: 'text_delta', text: chunk });
    }
    write({ type: 'phase_end', phase: 'tutor' });
    return { phase: 'tutor' };
  } catch (error) {
    write({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    write({ type: 'phase_end', phase: 'tutor' });
    return { phase: 'tutor' };
  }
}
