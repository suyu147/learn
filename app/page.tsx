'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  User,
  FolderOpen,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useLearningPathStore } from '@/lib/store/learning-path';
import { useResourcesStore } from '@/lib/store/resources';
import { useAgentActivityStore } from '@/lib/store/agent-activity';
import { calculateProfileCompleteness } from '@/lib/utils/profile-utils';
import { cn } from '@/lib/utils';

const AGENTS = [
  { id: 'profile', name: '画像分析师' },
  { id: 'planner', name: '路径规划师' },
  { id: 'evaluation', name: '学情分析师' },
  { id: 'document', name: '文档专家' },
  { id: 'mindmap', name: '思维导图专家' },
  { id: 'quiz', name: '题库专家' },
  { id: 'code', name: '代码专家' },
  { id: 'reading', name: '阅读策展人' },
  { id: 'video', name: '视频推荐官' },
  { id: 'ppt', name: '课件设计师' },
] as const;

const STATUS_STYLES = {
  idle: 'bg-gray-200',
  running: 'bg-yellow-400 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
} as const;

const STATUS_LABELS = {
  idle: '等待',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
} as const;

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: '文档',
  mindmap: '思维导图',
  quiz: '测验',
  video: '视频',
  code: '代码',
  reading: '阅读',
  ppt: '课件',
};

export default function HomePage() {
  const router = useRouter();
  const { profile } = useLearningProfileStore();
  const { path } = useLearningPathStore();
  const { resources } = useResourcesStore();
  const { agentStatuses } = useAgentActivityStore();

  const completeness = calculateProfileCompleteness(profile?.dimensions ?? null);
  const isProfileReady = completeness >= 75;

  const currentNode = path?.nodes.find((n) => n.status === 'in_progress') ?? null;
  const completedNodes = path?.nodes.filter((n) => n.status === 'completed') ?? [];
  const totalNodes = path?.nodes.length ?? 0;
  const progressPercent = totalNodes > 0 ? Math.round((completedNodes.length / totalNodes) * 100) : 0;

  const resourceTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of resources) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  }, [resources]);

  const weakTopics = profile?.dimensions.weakPoints.topics ?? [];

  function handleContinue() {
    router.push(isProfileReady ? '/workspace' : '/profile');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <div className="container flex-1 py-6">
        {/* Hero */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">欢迎回来</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile ? `画像完整度 ${completeness}%` : '开始构建你的学习画像'}
            </p>
            <Progress value={completeness} className="mt-2 h-2 w-64" />
          </div>
          <Button onClick={handleContinue} className="gap-2">
            {isProfileReady ? '继续学习' : '完善画像'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 4 核心卡片 */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 画像完整度 */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              画像完整度
            </div>
            <p className="mt-2 text-3xl font-bold">{completeness}%</p>
            <Progress value={completeness} className="mt-2 h-1.5" />
          </div>

          {/* 当前学习节点 */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              当前节点
            </div>
            <p className="mt-2 text-lg font-semibold truncate">
              {currentNode?.title ?? '暂无'}
            </p>
            {currentNode && (
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {currentNode.knowledgePoints.join('、')}
              </p>
            )}
          </div>

          {/* 已生成资源数 */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              已生成资源
            </div>
            <p className="mt-2 text-3xl font-bold">{resources.length}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(resourceTypeCounts).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-[10px] px-1.5 py-0">
                  {RESOURCE_TYPE_LABELS[type] ?? type} {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* 学习进度 */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              学习进度
            </div>
            <p className="mt-2 text-3xl font-bold">
              {completedNodes.length}<span className="text-base font-normal text-muted-foreground"> / {totalNodes || '—'}</span>
            </p>
            <Progress value={progressPercent} className="mt-2 h-1.5" />
          </div>
        </div>

        {/* 学习路径横向时间轴 */}
        <section className="mb-8 rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">学习路径</h2>
          {path && path.nodes.length > 0 ? (
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {path.nodes.map((node, idx) => {
                const isCompleted = node.status === 'completed';
                const isCurrent = node.status === 'in_progress';
                return (
                  <div key={node.id} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : isCurrent ? (
                        <Circle className="h-5 w-5 text-primary fill-primary/20" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300" />
                      )}
                      <span
                        className={cn(
                          'text-[11px] text-center max-w-[80px] truncate',
                          isCurrent && 'font-semibold text-primary',
                          isCompleted && 'text-green-600',
                          !isCompleted && !isCurrent && 'text-muted-foreground',
                        )}
                      >
                        {node.title}
                      </span>
                    </div>
                    {idx < path.nodes.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 w-8 shrink-0 mx-1',
                          isCompleted ? 'bg-green-400' : 'bg-gray-200',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无学习路径，开始学习后将自动生成
            </p>
          )}
        </section>

        {/* Agent 状态总览 */}
        <section className="mb-8 rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Agent 状态总览</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {AGENTS.map((agent) => {
              const entry = agentStatuses[agent.id];
              const status = entry?.status ?? 'idle';
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_STYLES[status as keyof typeof STATUS_STYLES])} />
                  <span className="text-xs font-medium truncate">{agent.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 智能推荐提示 */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            智能建议
          </h2>
          <div className="space-y-2">
            {completeness < 100 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                完善画像以获得更精准的学习资源推荐
                <Link href="/profile" className="ml-1 text-primary underline underline-offset-2 text-xs">
                  去完善
                </Link>
              </div>
            )}
            {weakTopics.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                建议复习：{weakTopics.slice(0, 3).join('、')}
              </div>
            )}
            {completeness >= 100 && weakTopics.length === 0 && (
              <p className="text-sm text-muted-foreground">
                画像已完善，暂无特别建议，继续保持学习！
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
