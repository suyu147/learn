'use client';

import {
  MessageSquare,
  GraduationCap,
  BookOpen,
  Database,
  Brain,
  Clock,
  TrendingUp,
  Zap,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSessionStore, type Session } from '@/lib/store/session-store';
import { useKnowledgeStore } from '@/lib/store/knowledge-store';
import { useMemoryStore } from '@/lib/store/memory-store';
import { useChatStore } from '@/lib/store/chat-store';

// ---------------------------------------------------------------------------
// Space (Dashboard) Page
// ---------------------------------------------------------------------------

export default function SpacePage() {
  const sessions = useSessionStore((s) => s.sessions);
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const memoryEntries = useMemoryStore((s) => s.entries);
  const chatMessages = useChatStore((s) => s.messages);

  // Compute stats
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const totalKBs = knowledgeBases.length;
  const totalDocs = knowledgeBases.reduce((acc, kb) => acc + kb.documentCount, 0);
  const totalMemories = memoryEntries.length;
  const totalMessages = chatMessages.length;

  // Recent sessions (last 5)
  const recentSessions = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);

  // Quick actions
  const quickActions = [
    {
      label: '新对话',
      description: '与 AI 开始对话',
      href: '/chat',
      icon: MessageSquare,
      color: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    },
    {
      label: '智慧学习',
      description: '构建学习画像和学习路径',
      href: '/smartlearn',
      icon: GraduationCap,
      color: 'bg-[var(--success)]/10 text-[var(--success)]',
    },
    {
      label: '知识库',
      description: '管理你的知识库',
      href: '/knowledge',
      icon: Database,
      color: 'bg-[var(--warning)]/10 text-[var(--warning)]',
    },
    {
      label: 'AI 课本',
      description: '创建 AI 生成的课本',
      href: '/book',
      icon: BookOpen,
      color: 'bg-[var(--destructive)]/10 text-[var(--destructive)]',
    },
  ];

  return (
    <div className="h-full bg-[var(--background)] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          工作台
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
          你的学习工作台和近期活动概览
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="会话"
            value={totalSessions}
            subtitle={`${activeSessions} 活跃`}
            icon={MessageSquare}
          />
          <StatCard
            label="知识库"
            value={totalKBs}
            subtitle={`${totalDocs} 文档`}
            icon={Database}
          />
          <StatCard
            label="记忆"
            value={totalMemories}
            subtitle="跨 L1/L2/L3"
            icon={Brain}
          />
          <StatCard
            label="消息"
            value={totalMessages}
            subtitle="累计交互"
            icon={Zap}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-3">
            快捷操作
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors group"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', action.color)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-1">
                    {action.label}
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    {action.description}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-[var(--primary)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    打开
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
              近期会话
            </h2>
            <Link
              href="/chat"
              className="text-[12px] text-[var(--primary)] hover:underline"
            >
              查看全部
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
              <Clock className="h-10 w-10 text-[var(--muted-foreground)] mx-auto mb-4 opacity-40" />
              <p className="text-[14px] text-[var(--foreground)] font-medium mb-1">
                暂无会话
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-4">
                开始一段对话，即可在此查看近期活动。
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                开始对话
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href="/chat"
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between hover:border-[var(--primary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--muted)]">
                      <MessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--foreground)]">
                        {session.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {session.mode} · {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium',
                      session.status === 'active'
                        ? 'bg-[var(--success)] text-white'
                        : session.status === 'completed'
                          ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                          : 'bg-[var(--destructive)] text-white',
                    )}
                  >
                    {session.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Knowledge Base Summary */}
        {knowledgeBases.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
                知识库
              </h2>
              <Link
                href="/knowledge"
                className="text-[12px] text-[var(--primary)] hover:underline"
              >
                管理
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {knowledgeBases.slice(0, 4).map((kb) => (
                <div
                  key={kb.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-medium text-[var(--foreground)]">
                      {kb.name}
                    </h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-medium',
                        kb.indexStatus === 'ready'
                          ? 'bg-[var(--success)] text-white'
                          : 'bg-[var(--warning)] text-white',
                      )}
                    >
                      {kb.indexStatus === 'ready' ? '就绪' : kb.indexStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {kb.documentCount} 文档 · {kb.blockCount} 块
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
        <TrendingUp className="h-3 w-3 text-[var(--muted-foreground)] opacity-40" />
      </div>
      <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{subtitle}</p>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}
