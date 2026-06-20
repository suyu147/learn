'use client';

import { useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AppNav } from '@/components/layout/app-nav';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useAgentActivityStore } from '@/lib/store/agent-activity';
import { useResourceDecisionsStore } from '@/lib/store/resource-decisions';
import { useSessionsStore } from '@/lib/store/sessions';
import { useI18n } from '@/lib/hooks/use-i18n';
import { calculateDimensionScores } from '@/lib/utils/profile-utils';
import { Badge } from '@/components/ui/badge';
import {
  PROFILE_DIMENSION_LABELS,
  DEFAULT_DIMENSIONS,
} from '@/lib/types/profile';

export default function EvaluationPage() {
  const { profile, profileHistory } = useLearningProfileStore();
  const { activityLog } = useAgentActivityStore();
  const { currentSessionId } = useSessionsStore();
  const getDecisionLogsForSession = useResourceDecisionsStore(
    (s) => s.getDecisionLogsForSession,
  );
  const { t } = useI18n();

  // 当前画像得分
  const currentScores = useMemo(
    () => (profile ? calculateDimensionScores(profile.dimensions) : null),
    [profile],
  );

  // 初始画像得分（取历史第一条）
  const initialScores = useMemo(() => {
    if (profileHistory.length === 0) return null;
    return calculateDimensionScores(profileHistory[0].dimensions);
  }, [profileHistory]);

  // 雷达图数据
  const radarData = useMemo(() => {
    const keys = Object.keys(PROFILE_DIMENSION_LABELS) as Array<
      keyof typeof PROFILE_DIMENSION_LABELS
    >;
    return keys.map((key) => ({
      dimension: PROFILE_DIMENSION_LABELS[key],
      initial: initialScores?.[key] ?? 0,
      current: currentScores?.[key] ?? 0,
    }));
  }, [currentScores, initialScores]);

  // 失败记录
  const failedEntries = useMemo(
    () => activityLog.filter((e) => e.status === 'failed'),
    [activityLog],
  );

  // 画像薄弱点
  const weakTopics = profile?.dimensions.weakPoints.topics ?? [];
  const errorPatterns = profile?.dimensions.errorPatterns.commonMistakes ?? [];
  const difficultAreas = profile?.dimensions.errorPatterns.difficultAreas ?? [];

  // 画像变更时间线
  const timeline = useMemo(() => {
    if (profileHistory.length === 0 && !profile) return [];

    const entries: Array<{
      version: number;
      updatedAt: string;
      changes: string[];
    }> = [];

    // 初始版本
    if (profileHistory.length > 0) {
      entries.push({
        version: profileHistory[0].version,
        updatedAt: profileHistory[0].updatedAt,
        changes: [t('evaluation.initialProfileCreated')],
      });
    }

    // 后续版本对比
    for (let i = 1; i < profileHistory.length; i++) {
      const prev = profileHistory[i - 1];
      const curr = profileHistory[i];
      const changes = computeDimensionChanges(prev.dimensions, curr.dimensions);
      entries.push({
        version: curr.version,
        updatedAt: curr.updatedAt,
        changes: changes.length > 0 ? changes : [t('evaluation.minorUpdate')],
      });
    }

    // 当前版本
    if (profile && (profileHistory.length === 0 || profile.version !== profileHistory[profileHistory.length - 1].version)) {
      const prev =
        profileHistory.length > 0
          ? profileHistory[profileHistory.length - 1].dimensions
          : DEFAULT_DIMENSIONS;
      const changes = computeDimensionChanges(prev, profile.dimensions);
      entries.push({
        version: profile.version,
        updatedAt: profile.updatedAt,
        changes: changes.length > 0 ? changes : [t('evaluation.currentVersionNoChange')],
      });
    }

    return entries;
  }, [profileHistory, profile, t]);

  // 推荐解释
  const decisionLogs = useMemo(
    () => (currentSessionId ? getDecisionLogsForSession(currentSessionId) : []),
    [currentSessionId, getDecisionLogsForSession],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <div className="container flex-1 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('evaluation.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('evaluation.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. 雷达图 */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('evaluation.radarChart')}</h2>
            {profile ? (
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {initialScores && (
                    <Radar
                      name={t('evaluation.initialProfile')}
                      dataKey="initial"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.15}
                      strokeDasharray="4 4"
                    />
                  )}
                  <Radar
                    name={t('evaluation.currentProfile')}
                    dataKey="current"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                  />
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t('evaluation.noProfileData')}
              </p>
            )}
          </section>

          {/* 2. 薄弱点追踪 */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('evaluation.weakPointsTitle')}</h2>

            <div className="space-y-4">
              {/* 画像薄弱点 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('evaluation.weakTopics')}
                </h3>
                {weakTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {weakTopics.map((topic, i) => (
                      <Badge key={i} variant="destructive">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('evaluation.noWeakTopics')}</p>
                )}
              </div>

              {/* 常见错误 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('evaluation.errorPatterns')}
                </h3>
                {errorPatterns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {errorPatterns.map((pattern, i) => (
                      <Badge key={i} variant="outline" className="text-orange-600 border-orange-300">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('evaluation.noErrorPatterns')}</p>
                )}
              </div>

              {/* 困难领域 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('evaluation.difficultAreas')}
                </h3>
                {difficultAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {difficultAreas.map((area, i) => (
                      <Badge key={i} variant="outline" className="text-amber-600 border-amber-300">
                        {area}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('evaluation.noDifficultAreas')}</p>
                )}
              </div>

              {/* Agent 失败记录 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('evaluation.agentFailures')}
                </h3>
                {failedEntries.length > 0 ? (
                  <div className="space-y-1">
                    {failedEntries.slice(-5).map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span className="font-medium">{e.agentName}</span>
                        <span className="text-muted-foreground">
                          {e.resourceType} — {new Date(e.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('evaluation.noAgentFailures')}</p>
                )}
              </div>
            </div>
          </section>

          {/* 3. 画像增量更新时间线 */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('evaluation.timeline')}</h2>
            {timeline.length > 0 ? (
              <div className="relative border-l-2 border-primary/20 pl-5 space-y-5">
                {timeline.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center">
                      <span className="h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">v{entry.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.updatedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {entry.changes.map((c, ci) => (
                        <li key={ci} className="text-xs text-muted-foreground">
                          • {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('evaluation.noTimeline')}
              </p>
            )}
          </section>

          {/* 4. 推荐解释面板 */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">{t('evaluation.resourceReasoning')}</h2>
            {decisionLogs.length > 0 ? (
              <div className="space-y-4">
                {decisionLogs.map((log, idx) => (
                  <div key={idx} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-primary">
                        {t('evaluation.nodePrefix')} {log.nodeId.slice(0, 8)}…
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {log.result.summary.reasoning.map((r, ri) => (
                        <p key={ri} className="text-xs text-muted-foreground">
                          • {r}
                        </p>
                      ))}
                    </div>
                    {log.result.summary.skipped.length > 0 && (
                      <div className="mt-2 border-t pt-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">
                          {t('evaluation.skippedResources')}
                        </p>
                        {log.result.summary.skipped.map((s, si) => (
                          <p key={si} className="text-[11px] text-muted-foreground">
                            <span className="font-medium">{s.type}</span>：{s.reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('evaluation.noReasoning')}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─── helper: 对比两个 ProfileDimensions 的变化 ─── */
function computeDimensionChanges(
  prev: import('@/lib/types/profile').ProfileDimensions,
  curr: import('@/lib/types/profile').ProfileDimensions,
): string[] {
  const changes: string[] = [];
  const labels = PROFILE_DIMENSION_LABELS;

  const prevScores = calculateDimensionScores(prev);
  const currScores = calculateDimensionScores(curr);

  for (const key of Object.keys(labels) as Array<keyof typeof labels>) {
    const diff = currScores[key] - prevScores[key];
    if (diff !== 0) {
      const arrow = diff > 0 ? '↑' : '↓';
      changes.push(`${labels[key]} ${arrow} ${Math.abs(diff)} 分（${prevScores[key]} → ${currScores[key]}）`);
    }
  }

  return changes;
}
