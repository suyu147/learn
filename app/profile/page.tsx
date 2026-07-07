'use client'

import {
  Brain,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  Clock,
  Award,
  BookOpen,
  Lightbulb,
  Zap,
  Eye,
  Code,
  FileText,
  Video,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Mock Data (replace with API calls later) ───

const userProfile = {
  name: '陈思远',
  level: '大三 · 计算机科学',
  learningDays: 47,
  totalSessions: 128,
  totalHours: 86,
  currentStreak: 12,
  avgSessionMin: 35,
  accuracy: 78,
  rank: '前 15%',
}

const dimensions = [
  { label: '抽象思维', value: 85, desc: '概念理解与推理' },
  { label: '计算能力', value: 72, desc: '数值运算与推导' },
  { label: '应用理解', value: 68, desc: '实际问题建模' },
  { label: '证明能力', value: 55, desc: '逻辑论证与严谨性' },
  { label: '编程实现', value: 78, desc: '代码落地能力' },
  { label: '知识迁移', value: 62, desc: '跨领域关联' },
]

const subjectMastery = [
  { name: '线性代数', mastery: 78, icon: BookOpen, topics: 12, completed: 8, trend: 'up' as const },
  { name: '概率统计', mastery: 65, icon: Target, topics: 10, completed: 5, trend: 'up' as const },
  { name: '数据结构', mastery: 72, icon: Code, topics: 15, completed: 11, trend: 'up' as const },
  { name: '机器学习', mastery: 45, icon: Brain, topics: 8, completed: 2, trend: 'down' as const },
  { name: '离散数学', mastery: 58, icon: FileText, topics: 9, completed: 4, trend: 'down' as const },
  { name: '计算机视觉', mastery: 35, icon: Eye, topics: 6, completed: 1, trend: 'down' as const },
]

const weakPoints = [
  {
    topic: '矩阵分解 (SVD)',
    subject: '线性代数',
    errorRate: 42,
    attempts: 15,
    hint: '对奇异值的几何意义理解不足，建议回顾特征值分解的直观解释',
    severity: 'high' as const,
  },
  {
    topic: '贝叶斯推断',
    subject: '概率统计',
    errorRate: 38,
    attempts: 12,
    hint: '先验概率的选取和似然函数的构建容易混淆',
    severity: 'high' as const,
  },
  {
    topic: '图论 · 最短路径',
    subject: '离散数学',
    errorRate: 35,
    attempts: 8,
    hint: 'Dijkstra 与 Floyd 算法的适用场景区分不清',
    severity: 'medium' as const,
  },
  {
    topic: '梯度下降优化',
    subject: '机器学习',
    errorRate: 33,
    attempts: 10,
    hint: '学习率选择与收敛性分析需要加强',
    severity: 'medium' as const,
  },
  {
    topic: 'CNN 反向传播',
    subject: '计算机视觉',
    errorRate: 55,
    attempts: 6,
    hint: '池化层梯度回传的索引计算频繁出错',
    severity: 'high' as const,
  },
]

const mistakeTypes = [
  { type: '概念混淆', count: 23, desc: '相似概念区分不清', icon: AlertTriangle },
  { type: '计算失误', count: 18, desc: '中间步骤出错', icon: Zap },
  { type: '条件遗漏', count: 14, desc: '未考虑边界或前提', icon: Eye },
  { type: '推理跳步', count: 11, desc: '证明过程不严谨', icon: TrendingDown },
  { type: '代码 Bug', count: 9, desc: '实现逻辑有误', icon: Code },
]

const recentErrors = [
  { q: '证明矩阵 A 的秩等于其非零奇异值的个数', topic: '线性代数', time: '2 小时前', correct: false },
  { q: '计算朴素贝叶斯分类器的后验概率', topic: '概率统计', time: '昨天', correct: false },
  { q: '手写 Dijkstra 算法求最短路径', topic: '离散数学', time: '昨天', correct: true },
  { q: '推导反向传播中卷积层的梯度', topic: '计算机视觉', time: '2 天前', correct: false },
  { q: '分析 SGD 与 Adam 的收敛性差异', topic: '机器学习', time: '3 天前', correct: false },
]

const learningStyles = [
  { label: '视觉学习', icon: Eye, active: true },
  { label: '动手实践', icon: Code, active: true },
  { label: '晨间高效', icon: Flame, active: true },
  { label: '短时专注', icon: Clock, active: true },
  { label: '思维导图', icon: Brain, active: true },
  { label: '视频学习', icon: Video, active: false },
]

const weeklyActivity = [
  { day: '一', hours: 2.5 },
  { day: '二', hours: 1.8 },
  { day: '三', hours: 3.2 },
  { day: '四', hours: 0.5 },
  { day: '五', hours: 2.0 },
  { day: '六', hours: 4.1 },
  { day: '日', hours: 1.2 },
]

// ─── Radar Chart (SVG) ───

function RadarChart({ data, size = 220 }: { data: typeof dimensions; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 30
  const levels = 4
  const angleStep = (2 * Math.PI) / data.length

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2
    const dist = (value / 100) * r
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) }
  }

  const polygonPoints = data
    .map((d, i) => {
      const p = getPoint(i, d.value)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid */}
      {Array.from({ length: levels }).map((_, li) => {
        const lvl = ((li + 1) / levels) * r
        const pts = data
          .map((_, i) => {
            const angle = angleStep * i - Math.PI / 2
            return `${cx + lvl * Math.cos(angle)},${cy + lvl * Math.sin(angle)}`
          })
          .join(' ')
        return (
          <polygon
            key={li}
            points={pts}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.8}
            opacity={0.6}
          />
        )
      })}

      {/* Axes */}
      {data.map((_, i) => {
        const p = getPoint(i, 100)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--border)"
            strokeWidth={0.5}
            opacity={0.5}
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="var(--primary)"
        fillOpacity={0.15}
        stroke="var(--primary)"
        strokeWidth={1.5}
      />

      {/* Data points + labels */}
      {data.map((d, i) => {
        const p = getPoint(i, d.value)
        const labelP = getPoint(i, 115)
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="var(--primary)" />
            <text
              x={labelP.x}
              y={labelP.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px]"
              fill="var(--muted-foreground)"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Mastery Bar ───

function MasteryBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full bg-[var(--muted)] rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function getMasteryColor(v: number): string {
  if (v >= 75) return 'bg-[var(--success)]'
  if (v >= 60) return 'bg-[var(--info)]'
  if (v >= 45) return 'bg-[var(--warning)]'
  return 'bg-[var(--destructive)]'
}

function getSeverityStyle(s: 'high' | 'medium' | 'low') {
  return s === 'high'
    ? 'bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/20'
    : s === 'medium'
      ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20'
      : 'bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/20'
}

// ─── Main Page ───

export default function ProfilePage() {
  const maxActivity = Math.max(...weeklyActivity.map((d) => d.hours))

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      {/* ── Header ── */}
      <div className="border-b border-[var(--border)] px-8 py-6">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-white font-bold text-2xl shrink-0">
            陈
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{userProfile.name}</h1>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">{userProfile.level}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatBadge icon={Flame} label="连续学习" value={`${userProfile.currentStreak} 天`} color="var(--warning)" />
              <StatBadge icon={Calendar} label="学习天数" value={`${userProfile.learningDays} 天`} color="var(--info)" />
              <StatBadge icon={Clock} label="总时长" value={`${userProfile.totalHours}h`} color="var(--primary)" />
              <StatBadge icon={Target} label="正确率" value={`${userProfile.accuracy}%`} color="var(--success)" />
              <StatBadge icon={Award} label="排名" value={userProfile.rank} color="var(--primary)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid Content ── */}
      <div className="px-8 py-6 space-y-6">

        {/* Row 1: Radar + Learning Style + Weekly Activity */}
        <div className="grid grid-cols-3 gap-4">

          {/* Radar Chart */}
          <Card title="学习能力画像" icon={Brain}>
            <RadarChart data={dimensions} size={220} />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {dimensions.map((d) => (
                <div key={d.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--muted-foreground)]">{d.label}</span>
                  <span className="font-medium text-[var(--foreground)]">{d.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Learning Style */}
          <Card title="学习风格" icon={Lightbulb}>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {learningStyles.map((s) => {
                const Icon = s.icon
                return (
                  <div
                    key={s.label}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 border text-[12.5px] font-medium transition-colors',
                      s.active
                        ? 'bg-[var(--primary)]/8 border-[var(--primary)]/20 text-[var(--foreground)]'
                        : 'bg-[var(--muted)]/50 border-[var(--border)] text-[var(--muted-foreground)]'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', s.active ? 'text-[var(--primary)]' : '')} />
                    {s.label}
                  </div>
                )
              })}
            </div>
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">学习偏好</h4>
              <div className="text-[12.5px] text-[var(--foreground)] leading-relaxed space-y-1.5">
                <p>• 偏好<strong>可视化</strong>学习方式（图表、动画、思维导图）</p>
                <p>• <strong>晨间 8-11 点</strong>为高效时段，平均专注度 85%</p>
                <p>• 适合 <strong>25-35 分钟</strong>短时专注，长时段效率递减</p>
                <p>• 编程实践类资源完成率最高（92%）</p>
              </div>
            </div>
          </Card>

          {/* Weekly Activity */}
          <Card title="本周学习活跃" icon={Calendar}>
            <div className="flex items-end gap-2 h-[140px] mb-3">
              {weeklyActivity.map((d) => {
                const h = (d.hours / maxActivity) * 120
                const isToday = d.day === '日'
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-[var(--muted-foreground)]">{d.hours}h</span>
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all',
                        isToday ? 'bg-[var(--primary)]' : 'bg-[var(--primary)]/30'
                      )}
                      style={{ height: `${h}px` }}
                    />
                    <span className={cn(
                      'text-[11px] font-medium',
                      isToday ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
                    )}>
                      {d.day}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[var(--border)] pt-3 mt-1">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--muted-foreground)]">本周总计</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {weeklyActivity.reduce((a, b) => a + b.hours, 0).toFixed(1)} 小时
                </span>
              </div>
              <div className="flex justify-between text-[12px] mt-1">
                <span className="text-[var(--muted-foreground)]">日均</span>
                <span className="font-medium text-[var(--foreground)]">
                  {(weeklyActivity.reduce((a, b) => a + b.hours, 0) / 7).toFixed(1)} 小时
                </span>
              </div>
              <div className="flex justify-between text-[12px] mt-1">
                <span className="text-[var(--muted-foreground)]">平均会话</span>
                <span className="font-medium text-[var(--foreground)]">{userProfile.avgSessionMin} 分钟</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Row 2: Subject Mastery + Error Analysis */}
        <div className="grid grid-cols-5 gap-4">

          {/* Subject Mastery — 3 cols */}
          <div className="col-span-3">
            <Card title="学科掌握度" icon={BookOpen}>
              <div className="space-y-3.5">
                {subjectMastery
                  .sort((a, b) => a.mastery - b.mastery)
                  .map((s) => {
                    const Icon = s.icon
                    const color = getMasteryColor(s.mastery)
                    return (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] font-medium text-[var(--foreground)]">{s.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[var(--muted-foreground)]">
                                {s.completed}/{s.topics} 知识点
                              </span>
                              {s.trend === 'up' ? (
                                <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-[var(--destructive)]" />
                              )}
                              <span className={cn('text-[13px] font-bold', s.mastery >= 70 ? 'text-[var(--success)]' : s.mastery >= 50 ? 'text-[var(--warning)]' : 'text-[var(--destructive)]')}>
                                {s.mastery}%
                              </span>
                            </div>
                          </div>
                          <MasteryBar value={s.mastery} color={color} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </Card>
          </div>

          {/* Error Type Distribution — 2 cols */}
          <div className="col-span-2">
            <Card title="错误类型分布" icon={AlertTriangle}>
              <div className="space-y-3">
                {mistakeTypes.map((m) => {
                  const Icon = m.icon
                  const total = mistakeTypes.reduce((a, b) => a + b.count, 0)
                  const pct = Math.round((m.count / total) * 100)
                  return (
                    <div key={m.type} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-[var(--warning)]" />
                          <span className="text-[12.5px] font-medium text-[var(--foreground)]">{m.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--muted-foreground)]">{m.desc}</span>
                          <span className="text-[12px] font-bold text-[var(--foreground)]">{m.count}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--warning)] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                  <Lightbulb className="h-3.5 w-3.5 text-[var(--warning)]" />
                  <span>建议：重点区分相似概念，练习时注重完整推导过程</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Row 3: Weak Points + Recent Errors */}
        <div className="grid grid-cols-5 gap-4">

          {/* Weak Points — 3 cols */}
          <div className="col-span-3">
            <Card title="薄弱知识点" icon={Target}>
              <div className="space-y-3">
                {weakPoints.map((w) => (
                  <div
                    key={w.topic}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13.5px] font-semibold text-[var(--foreground)]">{w.topic}</h4>
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                            getSeverityStyle(w.severity)
                          )}>
                            {w.severity === 'high' ? '重点关注' : '需要加强'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--muted-foreground)]">{w.subject}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[18px] font-bold text-[var(--destructive)]">{w.errorRate}%</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">错误率 ({w.attempts} 题)</div>
                      </div>
                    </div>
                    <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed bg-[var(--muted)]/50 rounded-lg px-3 py-2">
                      {w.hint}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Errors — 2 cols */}
          <div className="col-span-2">
            <Card title="最近答题记录" icon={XCircle}>
              <div className="space-y-2.5">
                {recentErrors.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-[var(--background)] border border-[var(--border)] p-3"
                  >
                    <div className="shrink-0 mt-0.5">
                      {e.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[var(--destructive)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[var(--foreground)] leading-relaxed line-clamp-2">{e.q}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
                          {e.topic}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">{e.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-4 text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                    <span className="text-[var(--muted-foreground)]">正确 {recentErrors.filter((e) => e.correct).length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-[var(--destructive)]" />
                    <span className="text-[var(--muted-foreground)]">错误 {recentErrors.filter((e) => !e.correct).length}</span>
                  </div>
                </div>
                <button className="text-[12px] text-[var(--primary)] font-medium hover:underline">
                  查看全部 →
                </button>
              </div>
            </Card>
          </div>
        </div>

        {/* Row 4: Recommendations */}
        <Card title="AI 学习建议" icon={Lightbulb}>
          <div className="grid grid-cols-3 gap-4">
            <RecommendCard
              title="强化矩阵分解"
              desc="建议用 3Blue1Brown 的 SVD 可视化视频配合习题集，每天 25 分钟专注练习 3 天。"
              tag="线性代数"
              priority="high"
            />
            <RecommendCard
              title="补全贝叶斯基础"
              desc="先回顾条件概率与全概率公式，再通过 5 道经典贝叶斯推断题巩固先验/似然的区分。"
              tag="概率统计"
              priority="high"
            />
            <RecommendCard
              title="算法对比练习"
              desc="制作 Dijkstra vs Floyd vs Bellman-Ford 的对比表格，明确各自的适用场景和时间复杂度。"
              tag="离散数学"
              priority="medium"
            />
          </div>
        </Card>

      </div>
    </div>
  )
}

// ─── Sub-components ───

function StatBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1">
      <Icon className="h-3.5 w-3.5" style={{ color: `var(${color})` }} />
      <span className="text-[11px] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-[12px] font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-[var(--primary)]" />
        <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function RecommendCard({
  title,
  desc,
  tag,
  priority,
}: {
  title: string
  desc: string
  tag: string
  priority: 'high' | 'medium' | 'low'
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:border-[var(--primary)]/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'h-2 w-2 rounded-full',
          priority === 'high' ? 'bg-[var(--destructive)]' : priority === 'medium' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'
        )} />
        <h4 className="text-[13px] font-semibold text-[var(--foreground)]">{title}</h4>
      </div>
      <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mb-3">{desc}</p>
      <span className="text-[10px] font-medium text-[var(--primary)] bg-[var(--primary)]/8 px-2 py-0.5 rounded-full">
        {tag}
      </span>
    </div>
  )
}
