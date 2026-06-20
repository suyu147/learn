'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppNav } from '@/components/layout/app-nav';
import { useAgentActivityStore, type AgentActivityEntry } from '@/lib/store/agent-activity';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const AGENTS = [
  { id: 'profile', name: '画像分析师', role: '构建和更新学习者画像' },
  { id: 'planner', name: '路径规划师', role: '规划个性化学习路径' },
  { id: 'evaluation', name: '学情分析师', role: '评估学习效果与知识掌握度' },
  { id: 'document', name: '文档专家', role: '生成结构化学习文档' },
  { id: 'mindmap', name: '思维导图专家', role: '生成知识点思维导图' },
  { id: 'quiz', name: '题库专家', role: '生成自适应测验题目' },
  { id: 'code', name: '代码专家', role: '生成编程案例与练习' },
  { id: 'reading', name: '拓展阅读策展人', role: '策展拓展阅读材料' },
  { id: 'video', name: '视频推荐官', role: '搜索和推荐教学视频' },
  { id: 'ppt', name: '课件设计师', role: '生成动态交互课件' },
] as const;

const STATUS_KEYS = {
  idle: 'agentOrchestration.status.idle',
  running: 'agentOrchestration.status.running',
  completed: 'agentOrchestration.status.completed',
  failed: 'agentOrchestration.status.failed',
} as const;

const STATUS_DOTS = {
  idle: { dot: 'bg-gray-300', ring: '', emoji: '⚪' },
  running: { dot: 'bg-yellow-400', ring: 'ring-2 ring-yellow-400/50 animate-pulse', emoji: '🟡' },
  completed: { dot: 'bg-green-500', ring: '', emoji: '🟢' },
  failed: { dot: 'bg-red-500', ring: '', emoji: '🔴' },
} as const;

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6'];

type StatusKey = keyof typeof STATUS_DOTS;

function resolveStatus(entry: AgentActivityEntry | undefined): StatusKey {
  if (!entry) return 'idle';
  return entry.status as StatusKey;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export default function AgentOrchestrationPage() {
  const { t } = useI18n();
  const agentStatuses = useAgentActivityStore((state) => state.agentStatuses);
  const activityLog = useAgentActivityStore((state) => state.activityLog);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新记录（列表末尾为最新）
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog.length]);

  const completedCount = useMemo(
    () => Object.values(agentStatuses).filter((e) => e.status === 'completed').length,
    [agentStatuses],
  );
  const failedCount = useMemo(
    () => Object.values(agentStatuses).filter((e) => e.status === 'failed').length,
    [agentStatuses],
  );

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of activityLog) {
      if (entry.status === 'completed') {
        counts[entry.resourceType] = (counts[entry.resourceType] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activityLog]);

  function toggleAgent(agentId: string) {
    setExpandedAgent((prev) => (prev === agentId ? null : agentId));
  }

  function getAgentLog(agentId: string) {
    return activityLog.filter((e) => e.agentId === agentId);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <div className="container flex-1 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('agentOrchestration.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agentOrchestration.subtitle')}</p>
        </div>

        <div className="flex gap-6">
          {/* 左侧：Agent 节点图 (2/3) */}
          <div className="flex-[2]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((agent) => {
                const status = resolveStatus(agentStatuses[agent.id]);
                const dots = STATUS_DOTS[status];
                const entry = agentStatuses[agent.id];
                const isExpanded = expandedAgent === agent.id;
                const agentLog = isExpanded ? getAgentLog(agent.id) : [];

                return (
                  <div key={agent.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleAgent(agent.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleAgent(agent.id); }}
                      className={cn(
                        'rounded-lg border p-4 transition-all cursor-pointer select-none',
                        status === 'running' && 'border-yellow-400 bg-yellow-50/40 shadow-sm animate-pulse',
                        status === 'completed' && 'border-green-500/70 bg-green-50/20',
                        status === 'failed' && 'border-red-500/70 bg-red-50/20',
                        status === 'idle' && 'border-border bg-card hover:border-muted-foreground/30',
                        isExpanded && 'ring-2 ring-primary/30',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{dots.emoji}</span>
                            <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{agent.role}</p>
                        </div>
                        <span
                          className={cn(
                            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                            dots.dot,
                            dots.ring,
                          )}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{t(STATUS_KEYS[status])}</span>
                        <div className="flex items-center gap-2 truncate ml-2">
                          {entry && <span className="truncate">{entry.resourceType}</span>}
                          <span className={cn('transition-transform', isExpanded && 'rotate-180')}>▾</span>
                        </div>
                      </div>
                    </div>

                    {/* 展开区域：该 Agent 的活动记录 */}
                    {isExpanded && (
                      <div className="mt-1 rounded-lg border bg-card/80 p-3">
                        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                          {agent.name} — {t('agentOrchestration.activityLog')} ({agentLog.length})
                        </p>
                        {agentLog.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('agentOrchestration.noActivityLog')}</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {[...agentLog].reverse().map((log, i) => {
                              const sc = STATUS_DOTS[log.status as StatusKey];
                              return (
                                <div key={`${log.timestamp}-${i}`} className="flex items-center gap-2 text-[11px]">
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', sc.dot)} />
                                  <span className="text-muted-foreground tabular-nums">{formatTime(log.timestamp)}</span>
                                  <span>{t(STATUS_KEYS[log.status as StatusKey])}</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span>{log.resourceType}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 统计区域 */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-2xl font-bold">{completedCount}<span className="text-base font-normal text-muted-foreground"> / {AGENTS.length}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{t('agentOrchestration.completedAgents')}</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className={cn('text-2xl font-bold', failedCount > 0 && 'text-red-500')}>{failedCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('agentOrchestration.failedAgents')}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-2 text-xs text-muted-foreground text-center">{t('agentOrchestration.resourceDistribution')}</p>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={50}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => [`${value} ${t('agentOrchestration.times')}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                    {t('agentOrchestration.noCompletedData')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：协作日志面板 (1/3) */}
          <div className="flex-1">
            <div className="sticky top-20 rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">{t('agentOrchestration.collaborationLog')}</h2>
                <p className="text-[11px] text-muted-foreground">{t('agentOrchestration.recentActivities', { count: activityLog.length })}</p>
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {activityLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <p className="text-sm">{t('agentOrchestration.noActivities')}</p>
                    <p className="mt-1 text-xs">{t('agentOrchestration.noActivitiesHint')}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {activityLog.map((entry, index) => {
                      const statusCfg = STATUS_DOTS[entry.status as StatusKey];
                      return (
                        <div key={`${entry.agentId}-${entry.timestamp}-${index}`} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusCfg.dot)} />
                            <span className="text-xs font-medium truncate">{entry.agentName}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 pl-4 text-[11px] text-muted-foreground">
                            <span>{t(STATUS_KEYS[entry.status as StatusKey])}</span>
                            <span>·</span>
                            <span>{entry.resourceType}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
