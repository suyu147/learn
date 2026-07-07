'use client'

import { useState } from 'react'
import { Download, RefreshCw, Clock, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

type MemoryLayer = 'L1' | 'L2' | 'L3'

interface MemoryEntry {
  id: string
  time: string
  context: string
  content: string
  tags: string[]
}

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  size: 'primary' | 'secondary'
}

export default function MemoryPage() {
  const [activeLayer, setActiveLayer] = useState<MemoryLayer>('L1')

  const layers: { id: MemoryLayer; label: string; description: string }[] = [
    { id: 'L1', label: 'L1 · 短期记忆', description: '当前会话的临时记忆，包含对话上下文、用户偏好和即时反馈。会话结束后自动整合到 L2。' },
    { id: 'L2', label: 'L2 · 中期整合', description: '跨会话的整合记忆，提取关键知识点和学习模式。每周自动压缩和更新。' },
    { id: 'L3', label: 'L3 · 长期持久', description: '核心知识图谱和长期学习偏好，持久化存储。仅在重大知识更新时调整。' },
  ]

  const memoryEntries: MemoryEntry[] = [
    {
      id: '1',
      time: '14:32',
      context: '本轮对话',
      content: '用户倾向于先理解理论推导，再查看代码实现。对 SVD 的几何解释表现出较高兴趣。',
      tags: ['学习偏好', 'SVD'],
    },
    {
      id: '2',
      time: '14:28',
      context: '本轮对话',
      content: '已掌握特征值分解的基础概念，理解特征向量表示变换方向、特征值表示缩放比例。',
      tags: ['知识状态', '特征值'],
    },
    {
      id: '3',
      time: '13:15',
      context: '上一轮对话',
      content: '用户偏好在理论讲解后附带 Python 代码示例，便于实践验证。',
      tags: ['学习偏好', 'Python'],
    },
    {
      id: '4',
      time: '10:42',
      context: '今天早间',
      content: '用户提到下周有线性代数期中考试，需要重点复习矩阵分解相关内容。',
      tags: ['日程', '考试'],
    },
  ]

  const graphNodes: GraphNode[] = [
    { id: 'svd', label: 'SVD', x: 50, y: 50, size: 'primary' },
    { id: 'eigen', label: '特征值', x: 20, y: 30, size: 'secondary' },
    { id: 'recommend', label: '推荐系统', x: 80, y: 30, size: 'secondary' },
    { id: 'ortho', label: '正交矩阵', x: 15, y: 70, size: 'secondary' },
    { id: 'lowrank', label: '低秩近似', x: 85, y: 70, size: 'secondary' },
    { id: 'pca', label: 'PCA', x: 35, y: 85, size: 'secondary' },
    { id: 'transform', label: '线性变换', x: 65, y: 85, size: 'secondary' },
  ]

  const graphEdges = [
    { from: 'svd', to: 'eigen' },
    { from: 'svd', to: 'recommend' },
    { from: 'svd', to: 'ortho' },
    { from: 'svd', to: 'lowrank' },
    { from: 'svd', to: 'pca' },
    { from: 'svd', to: 'transform' },
    { from: 'eigen', to: 'ortho' },
    { from: 'lowrank', to: 'recommend' },
    { from: 'pca', to: 'transform' },
  ]

  return (
    <div className="h-full bg-[var(--background)] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">记忆工作台</h1>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              导出快照
            </button>
            <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              手动整合
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-[var(--border)] px-6">
        <div className="flex gap-1">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors',
                activeLayer === layer.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              )}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layer Description */}
      <div className="px-6 py-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[13px] text-[var(--foreground)] leading-relaxed">
            {layers.find((l) => l.id === activeLayer)?.description}
          </p>
        </div>
      </div>

      {/* Memory Timeline */}
      <div className="px-6 pb-6">
        <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-3">记忆时间线</h2>
        <div className="space-y-3">
          {memoryEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-[10px] text-[var(--muted-foreground)]">{entry.time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-[var(--primary)]">{entry.context}</span>
                  </div>
                  <p className="text-[13px] text-[var(--foreground)] leading-relaxed mb-2">{entry.content}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-[var(--muted)] rounded-full text-[10px] text-[var(--muted-foreground)] flex items-center gap-1"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory Graph */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)]">记忆图谱</h2>
          <span className="text-[11px] text-[var(--muted-foreground)]">· 12 个实体 · 18 条关系</span>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 relative" style={{ height: '400px' }}>
          {/* SVG Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {graphEdges.map((edge, idx) => {
              const from = graphNodes.find((n) => n.id === edge.from)
              const to = graphNodes.find((n) => n.id === edge.to)
              if (!from || !to) return null
              return (
                <line
                  key={idx}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {graphNodes.map((node) => (
            <div
              key={node.id}
              className={cn(
                'absolute flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 cursor-pointer',
                node.size === 'primary'
                  ? 'h-16 w-16 bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30'
                  : 'h-12 w-12 bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]'
              )}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}
            >
              <span className={cn('text-[11px] font-semibold', node.size === 'primary' && 'text-white')}>
                {node.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
