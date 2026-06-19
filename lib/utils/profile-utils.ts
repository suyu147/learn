import type { ProfileDimensions } from '@/lib/types/profile';

const TOTAL_DIMENSIONS = 8;

function getFilledDimensionsCount(dimensions: ProfileDimensions | null | undefined): number {
  if (!dimensions) return 0;

  let filledCount = 0;

  if (dimensions.knowledgeBase?.subjects?.length > 0) filledCount++;
  if (dimensions.cognitiveStyle?.type && dimensions.cognitiveStyle.type !== 'reading') filledCount++;
  if (dimensions.learningGoals?.shortTerm?.length > 0 || !!dimensions.learningGoals?.longTerm) filledCount++;
  if (dimensions.weakPoints?.topics?.length > 0 || dimensions.weakPoints?.errorPatterns?.length > 0) filledCount++;
  if ((dimensions.timePreference?.preferredDuration ?? 0) > 0) filledCount++;
  if (dimensions.interests?.domains?.length > 0) filledCount++;
  if (dimensions.learningPace?.speed && dimensions.learningPace.speed !== 'moderate') filledCount++;
  if (dimensions.errorPatterns?.commonMistakes?.length > 0 || dimensions.errorPatterns?.difficultAreas?.length > 0) filledCount++;

  return filledCount;
}

export function isProfileComplete(dimensions: ProfileDimensions | null | undefined): boolean {
  return getFilledDimensionsCount(dimensions) >= 6;
}

export function calculateProfileCompleteness(dimensions: ProfileDimensions | null | undefined): number {
  return Math.round((getFilledDimensionsCount(dimensions) / TOTAL_DIMENSIONS) * 100);
}
