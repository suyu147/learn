'use client'

import { useState } from 'react'
import { CheckCircle2, Lock, Play, RotateCcw, FileText, Brain, Video, Code, Presentation } from 'lucide-react'
import { cn } from '@/lib/utils'

type NodeStatus = 'completed' | 'active' | 'locked'

interface LearningNode {
  id: string
  title: string
  status: NodeStatus
}

interface Resource {
  id: string
  title: string
  type: string
  icon: React.ComponentType<{ className?: string }>
}

export default function SmartLearnPage() {
  const [_selectedNode, setSelectedNode] = useState('svd')

  const nodes: LearningNode[] = [
    { id: 'vector', title: '向量空间基础', status: 'completed' },
    { id: 'transform', title: '线性变换', status: 'completed' },
    { id: 'eigen', title: '特征值与特征向量', status: 'completed' },
    { id: 'svd', title: 'SVD 分解', status: 'active' },
    { id: 'pca', title: 'PCA 主成分分析', status: 'locked' },
    { id: 'assess', title: '综合评估', status: 'locked' },
  ]

  const resources: Resource[] = [
    { id: '1', title: 'SVD 分解原理详解', type: '文档', icon: FileText },
    { id: '2', title: 'SVD 几何意义思维导图', type: '思维导图', icon: Brain },
    { id: '3', title: 'SVD 应用测验', type: '测验', icon: CheckCircle2 },
    { id: '4', title: 'B站3Blue1Brown', type: '视频', icon: Video },
    { id: '5', title: 'Python SVD 实战', type: '代码', icon: Code },
    { id: '6', title: 'SVD 应用案例 PPT', type: '演示文稿', icon: Presentation },
  ]

  const stats = [
    { label: '掌握度', value: 87, color: 'text-[var(--success)]' },
    { label: '学习天数', value: 14, color: 'text-[var(--primary)]' },
    { label: '已完成节点', value: 42, color: 'text-[var(--info)]' },
    { label: '待巩固', value: 8, color: 'text-[var(--warning)]' },
  ]

  const dimensions = [
    { label: '抽象思维', value: 85 },
    { label: '计算能力', value: 72 },
    { label: '应用理解', value: 68 },
    { label: '证明能力', value: 55 },
  ]

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">线性代数 · 学习路径</h1>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
                第三周 · 矩阵分解专题 · 进度 62%
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Continue
              </button>
            </div>
          </div>
        </div>

        {/* Learning Path Timeline */}
        <div className="px-6 py-6 border-b border-[var(--border)]">
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-[var(--border)] -translate-y-1/2" />
            
            {/* Nodes */}
            <div className="relative flex justify-between items-center">
              {nodes.map((node, idx) => (
                <div key={node.id} className="flex flex-col items-center gap-2 relative">
                  <button
                    onClick={() => node.status !== 'locked' && setSelectedNode(node.id)}
                    className={cn(
                      'h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all',
                      node.status === 'completed' && 'bg-[var(--success)] border-[var(--success)] text-white',
                      node.status === 'active' && 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30',
                      node.status === 'locked' && 'bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed'
                    )}
                  >
                    {node.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : node.status === 'locked' ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-bold">{idx + 1}</span>
                    )}
                  </button>
                  <span className={cn(
                    'text-[11px] text-center max-w-[80px] leading-tight',
                    node.status === 'locked' ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'
                  )}>
                    {node.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Node Content */}
        <div className="flex-1 px-6 py-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              当前节点：SVD 分解
            </h2>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              3 个学习资源已生成 · 预计用时 45 分钟
            </p>
          </div>

          {/* Resource Grid */}
          <div className="grid grid-cols-2 gap-3">
            {resources.map((resource) => {
              const Icon = resource.icon
              return (
                <button
                  key={resource.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:border-[var(--primary)] transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[var(--muted)] group-hover:bg-[var(--primary)]/10 transition-colors">
                      <Icon className="h-4 w-4 text-[var(--primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13px] font-medium text-[var(--foreground)] mb-1 line-clamp-2">
                        {resource.title}
                      </h3>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{resource.type}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel - Learner Profile */}
      <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Profile Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
            <div className="h-12 w-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold text-lg">
              陈
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--foreground)]">陈思远</h3>
              <p className="text-[12px] text-[var(--muted-foreground)]">大三 · 计算机科学</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[var(--background)] rounded-lg p-3">
                <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Learning Dimensions */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              学习维度
            </h3>
            {dimensions.map((dim) => (
              <div key={dim.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-[var(--foreground)]">{dim.label}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{dim.value}%</span>
                </div>
                <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full transition-all"
                    style={{ width: `${dim.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
