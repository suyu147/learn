import type { LearnEvent } from '../types';
import type { LearningStateType } from '../state';
import { evaluateQuizResults } from '../helpers/evaluate';

function getWriter(config: { configurable?: { writer?: (event: LearnEvent) => void } }) {
  return config.configurable?.writer ?? (() => undefined);
}

export async function evaluateNode(
  state: LearningStateType,
  config: { configurable?: { writer?: (event: LearnEvent) => void } },
) {
  const write = getWriter(config);
  write({ type: 'phase_start', phase: 'evaluate' });

  try {
    if (state.quizResults.length === 0) {
      const fallback = { weakPoints: [], strongPoints: state.currentNode?.knowledgePoints ?? [], suggestedFocus: [], profileUpdate: null, feedback: '已完成当前节点，未提供测验结果。' };
      write({ type: 'evaluation_result', evaluation: fallback, score: 100 });
      write({ type: 'phase_end', phase: 'evaluate' });
      return { evaluationResult: fallback, evaluationScore: 100, evaluationFeedback: null, phase: 'evaluate' };
    }

    const { evaluation, score, text } = await evaluateQuizResults(state.quizResults, state.profile, state.aiConfig);
    for (const chunk of text.match(/.{1,80}/g) ?? []) write({ type: 'text_delta', text: chunk });
    if (evaluation) write({ type: 'evaluation_result', evaluation, score });
    write({ type: 'phase_end', phase: 'evaluate' });
    return { evaluationResult: evaluation, evaluationScore: score, evaluationFeedback: evaluation ? { weakPoints: evaluation.weakPoints, strongPoints: evaluation.strongPoints, suggestedFocus: evaluation.suggestedFocus } : null, phase: 'evaluate' };
  } catch (error) {
    write({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    write({ type: 'phase_end', phase: 'evaluate' });
    return { phase: 'evaluate', evaluationFeedback: null };
  }
}
