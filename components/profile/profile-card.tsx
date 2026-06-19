'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { PROFILE_DIMENSION_LABELS, DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import type { ProfileDimensions, KnowledgeBase } from '@/lib/types/profile';
import { User, Radar } from 'lucide-react';

function getDimensionScore(dimensions: ProfileDimensions): number {
  let score = 0;
  let total = 0;

  if (dimensions.knowledgeBase.subjects.length > 0) {
    score += dimensions.knowledgeBase.subjects.reduce((a, s) => a + s.mastery, 0) / dimensions.knowledgeBase.subjects.length;
    total += 100;
  }
  if (dimensions.cognitiveStyle.type) { score += 80; total += 100; }
  if (dimensions.learningGoals.shortTerm.length > 0 || dimensions.learningGoals.longTerm) { score += 70; total += 100; }
  if (dimensions.weakPoints.topics.length > 0) { score += 60; total += 100; }
  if (dimensions.timePreference.preferredDuration > 0) { score += 90; total += 100; }
  if (dimensions.interests.domains.length > 0) { score += 75; total += 100; }
  if (dimensions.learningPace.speed) { score += 80; total += 100; }
  if (dimensions.errorPatterns.commonMistakes.length > 0) { score += 65; total += 100; }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function DimensionRow({ label, value, level }: { label: string; value: string; level?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      {level !== undefined && <Progress value={level} className="h-1.5" />}
    </div>
  );
}

export function ProfileCard() {
  const { profile } = useLearningProfileStore();
  const dimensions = profile?.dimensions ?? DEFAULT_DIMENSIONS;
  const completeness = getDimensionScore(dimensions);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="h-4 w-4" />
          学习画像
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">完整度</span>
          <Progress value={completeness} className="h-2 flex-1" />
          <span className="text-xs font-medium">{completeness}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.knowledgeBase}
          value={dimensions.knowledgeBase.level === 'beginner' ? '初学者' : dimensions.knowledgeBase.level === 'intermediate' ? '中级' : '高级'}
          level={dimensions.knowledgeBase.level === 'beginner' ? 30 : dimensions.knowledgeBase.level === 'intermediate' ? 60 : 90}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.cognitiveStyle}
          value={
            dimensions.cognitiveStyle.type === 'visual' ? '视觉型' :
            dimensions.cognitiveStyle.type === 'auditory' ? '听觉型' :
            dimensions.cognitiveStyle.type === 'reading' ? '阅读型' : '实践型'
          }
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.learningGoals}
          value={dimensions.learningGoals.longTerm || '未设置'}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.weakPoints}
          value={dimensions.weakPoints.topics.length > 0 ? `${dimensions.weakPoints.topics.length}个薄弱点` : '未识别'}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.timePreference}
          value={`${dimensions.timePreference.preferredDuration}分钟/次`}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.interests}
          value={dimensions.interests.domains.length > 0 ? dimensions.interests.domains.slice(0, 2).join('、') : '未设置'}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.learningPace}
          value={dimensions.learningPace.speed === 'slow' ? '慢速' : dimensions.learningPace.speed === 'moderate' ? '适中' : '快速'}
        />
        <DimensionRow
          label={PROFILE_DIMENSION_LABELS.errorPatterns}
          value={dimensions.errorPatterns.commonMistakes.length > 0 ? `${dimensions.errorPatterns.commonMistakes.length}个模式` : '未识别'}
        />

        {dimensions.knowledgeBase.subjects.length > 0 && (
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">已掌握技能</p>
            <div className="flex flex-wrap gap-1">
              {dimensions.knowledgeBase.subjects.map((s) => (
                <Badge key={s.name} variant="secondary" className="text-xs">
                  {s.name} {s.mastery}%
                </Badge>
              ))}
            </div>
          </div>
        )}

        {dimensions.interests.preferredFormats.length > 0 && (
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">偏好资源类型</p>
            <div className="flex flex-wrap gap-1">
              {dimensions.interests.preferredFormats.map((f) => (
                <Badge key={f} variant="outline" className="text-xs">
                  {f === 'document' ? '文档' : f === 'video' ? '视频' : f === 'code' ? '代码' : f === 'quiz' ? '题目' : '思维导图'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
