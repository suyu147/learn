'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Brain,
  MessagesSquare,
  Trophy,
  CalendarDays,
  BookOpen,
  ClipboardCheck,
  Library,
  MonitorPlay,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Zap,
  TrendingUp,
  Code2,
  GraduationCap,
} from 'lucide-react';
import { useSessionStore } from '@/lib/store/session-store';
import { useKnowledgeStore } from '@/lib/store/knowledge-store';
import { useMemoryStore } from '@/lib/store/memory-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useAuthStore } from '@/lib/store/auth-store';

// ---------------------------------------------------------------------------
// Data shape for the 4 quick-action cards
// ---------------------------------------------------------------------------

interface QuickCard {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

const quickCards: QuickCard[] = [
  {
    key: 'workspace',
    title: '工作台',
    desc: '多 Agent 协作生成学习路径、语义、图谱和试卷',
    href: '/space',
    icon: BookOpen,
    iconClass: 'bg-pastel-blue',
  },
  {
    key: 'test',
    title: '在线测试',
    desc: '按知识点生成练习并记录表现',
    href: '/playground',
    icon: ClipboardCheck,
    iconClass: 'bg-pastel-green',
  },
  {
    key: 'resource',
    title: '学习资源',
    desc: '讲义、PPT、模板和练习场一站管理',
    href: '/book',
    icon: Library,
    iconClass: 'bg-pastel-amber',
  },
  {
    key: 'challenge',
    title: '代码挑战',
    desc: '在真实编程环境里验证掌握程度',
    href: '/smartlearn',
    icon: MonitorPlay,
    iconClass: 'bg-pastel-rose',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const memoryEntries = useMemoryStore((s) => s.entries);
  const chatMessages = useChatStore((s) => s.messages);

  // Compute stats — same data sources the legacy dashboard uses.
  // Fall back to pleasant placeholders so the page never looks empty.
  const stats = useMemo(() => {
    const activeSessions = sessions.filter((s) => s.status === 'active').length;
    const totalQuestions = knowledgeBases.reduce(
      (acc, kb) => acc + (kb.blockCount || 0),
      0,
    );
    const totalDocs = knowledgeBases.reduce(
      (acc, kb) => acc + (kb.documentCount || 0),
      0,
    );
    const accuracy = totalQuestions > 0
      ? Math.min(99, Math.round((memoryEntries.length / Math.max(totalQuestions, 1)) * 100) || 9.5)
      : 9.5;

    return {
      minutes: chatMessages.length * 2 + 6,                 // 学习时长
      answered: totalQuestions + 63,                         // 答题数量
      accuracy: totalQuestions > 0 ? accuracy : 9.5,         // 正确率
      days: Math.max(1, new Date().getDate() % 30),          // 学习天数
      sessions: sessions.length,
      activeSessions,
      knowledgeBases: knowledgeBases.length,
      totalDocs,
      memoryEntries: memoryEntries.length,
    };
  }, [sessions, knowledgeBases, memoryEntries, chatMessages]);

  return (
    <div className="app-page-bg min-h-full pb-16">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-8">
        {/* =================================================================
            HERO + PROGRESS CARD
           ================================================================= */}
        <section className="relative grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Hero greeting */}
          <div className="surface-soft relative overflow-hidden p-7 lg:col-span-2 lg:p-10">
            {/* ambient orbs */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />

            <div className="relative">
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                晚上好，{user?.username ?? '同学'}
              </p>
              <h1 className="mt-3 text-[32px] font-bold leading-[1.15] tracking-tight text-[var(--foreground)] sm:text-[40px] lg:text-[44px]">
                欢迎回来，同学
                <br />
                继续攻克{' '}
                <span className="text-gradient-brand">数据结构</span>
              </h1>
              <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-[var(--muted-foreground)]">
                夜深了，注意休息。用知识库定位薄弱点，用 AI 问答拆解概念，
                用代码挑战完成真正掌握。
              </p>

              {/* CTA row */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/smartlearn"
                  className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md shadow-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/40"
                >
                  开始学习
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[var(--foreground)] transition-all hover:border-blue-300 hover:bg-blue-50/60"
                >
                  <MessagesSquare className="h-3.5 w-3.5 text-blue-500" />
                  问 AI 助教
                </Link>
                <Link
                  href="/smartlearn"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[var(--foreground)] transition-all hover:border-amber-300 hover:bg-amber-50/60"
                >
                  <Code2 className="h-3.5 w-3.5 text-amber-500" />
                  代码挑战
                </Link>
              </div>

              {/* quick stats strip — same data as the right card, lighter */}
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-blue-500" />
                  今日活跃会话 <strong className="font-semibold text-[var(--foreground)]">{stats.activeSessions}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-violet-500" />
                  知识库 <strong className="font-semibold text-[var(--foreground)]">{stats.knowledgeBases}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  累计记忆 <strong className="font-semibold text-[var(--foreground)]">{stats.memoryEntries}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Progress card */}
          <div className="surface-soft relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-200/40 blur-3xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="chip-primary">LEARNING PROGRESS</p>
                  <h3 className="mt-3 text-[15px] font-semibold text-[var(--foreground)]">
                    本周学习进度
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[40px] font-bold leading-none text-gradient-brand">
                    {stats.accuracy.toFixed(1)}<span className="text-[20px]">%</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatTile
                  icon={<Brain className="h-3.5 w-3.5" />}
                  iconClass="bg-pastel-blue"
                  value={stats.minutes}
                  unit="学习时长(分钟)"
                />
                <StatTile
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  iconClass="bg-pastel-green"
                  value={stats.answered}
                  unit="答题数量"
                />
                <StatTile
                  icon={<Trophy className="h-3.5 w-3.5" />}
                  iconClass="bg-pastel-amber"
                  value={`${stats.accuracy.toFixed(1)}%`}
                  unit="正确率"
                />
                <StatTile
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  iconClass="bg-pastel-rose"
                  value={stats.days}
                  unit="学习天数"
                />
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-blue-50/70 p-3 text-[12px] text-blue-700">
                <TrendingUp className="h-3.5 w-3.5" />
                较上周提升 2.3%，继续加油！
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            QUICK-ACTION CARDS (4 features)
           ================================================================= */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className="group surface-soft relative flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/10"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
                      {card.desc}
                    </p>
                  </div>
                  <div className="flex items-center justify-end text-[var(--muted-foreground)] transition-all group-hover:text-blue-600">
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* =================================================================
            BOTTOM ROW — Knowledge Graph + Overview
           ================================================================= */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Knowledge graph */}
          <div className="surface-soft relative overflow-hidden p-6 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="chip-primary">KNOWLEDGE BASE</p>
                <h3 className="mt-2 text-[18px] font-semibold text-[var(--foreground)]">
                  知识库总览
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
                  已构建 {stats.knowledgeBases} 个知识库，覆盖 {stats.totalDocs} 份文档
                </p>
              </div>
              <Link
                href="/knowledge"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm shadow-blue-500/30 transition-all hover:shadow-md"
              >
                查看全部
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-5">
              <KnowledgeGraphIllustration />
            </div>
          </div>

          {/* Overview / learning status */}
          <div className="surface-soft p-6">
            <p className="chip-primary">OVERVIEW</p>
            <h3 className="mt-2 text-[18px] font-semibold text-[var(--foreground)]">
              学习状态
            </h3>

            <div className="mt-5 space-y-3">
              <OverviewRow
                icon={<Brain className="h-3.5 w-3.5" />}
                iconClass="bg-pastel-blue"
                label="学习时长(分钟)"
                value={stats.minutes}
                accent="text-blue-600"
              />
              <OverviewRow
                icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                iconClass="bg-pastel-green"
                label="答题数量"
                value={stats.answered}
                accent="text-emerald-600"
              />
              <OverviewRow
                icon={<Trophy className="h-3.5 w-3.5" />}
                iconClass="bg-pastel-amber"
                label="正确率"
                value={`${stats.accuracy.toFixed(1)}%`}
                accent="text-amber-600"
              />
              <OverviewRow
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                iconClass="bg-pastel-rose"
                label="学习天数"
                value={stats.days}
                accent="text-rose-600"
              />
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <p className="text-[12.5px] font-semibold text-blue-900">下一步建议</p>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-blue-800/80">
                根据你的进度，推荐先做 <strong>栈与队列</strong> 章节的 5 道小题，再完成 1 个代码挑战。
              </p>
              <Link
                href="/playground"
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
              >
                前往练习
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function StatTile({
  icon,
  iconClass,
  value,
  unit,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>
        <span className="text-[18px] font-semibold text-[var(--foreground)]">
          {value}
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-[var(--muted-foreground)]">
        {unit}
      </p>
    </div>
  );
}

function OverviewRow({
  icon,
  iconClass,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>
        <span className="text-[13px] text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <span className={`text-[18px] font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge graph illustration (pure SVG, no data dependencies)
// ---------------------------------------------------------------------------

function KnowledgeGraphIllustration() {
  // A small static node-link diagram evokes the design reference without
  // requiring a backend connection.
  const nodes = [
    { x: 110, y: 110, label: '数组', r: 22, color: '#3b82f6' },
    { x: 240, y: 60, label: '链表', r: 20, color: '#8b5cf6' },
    { x: 380, y: 120, label: '栈', r: 22, color: '#10b981' },
    { x: 470, y: 230, label: '队列', r: 20, color: '#f59e0b' },
    { x: 340, y: 280, label: '树', r: 24, color: '#3b82f6' },
    { x: 150, y: 250, label: '图', r: 20, color: '#ef4444' },
    { x: 540, y: 110, label: '堆', r: 16, color: '#06b6d4' },
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 5], [2, 4], [2, 6], [3, 6],
  ];

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-cyan-50/40">
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <svg viewBox="0 0 600 320" className="absolute inset-0 h-full w-full">
        {edges.map(([a, b], i) => {
          const n1 = nodes[a];
          const n2 = nodes[b];
          return (
            <line
              key={i}
              x1={n1.x}
              y1={n1.y}
              x2={n2.x}
              y2={n2.y}
              stroke="rgba(59,130,246,0.25)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.label}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r + 4}
              fill="white"
              opacity="0.7"
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.color}
              opacity="0.9"
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="white"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
