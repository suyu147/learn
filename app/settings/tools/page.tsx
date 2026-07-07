'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ToolToggleProps {
  name: string
  description: string
  enabled: boolean
  onToggle: () => void
}

function ToolToggle({ name, description, enabled, onToggle }: ToolToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 bg-[var(--card)]">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{name}</p>
        <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            enabled && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export default function ToolsPage() {
  const [tools, setTools] = useState([
    { id: 'search', name: '网络搜索', description: '允许 Agent 搜索互联网获取最新信息', enabled: true },
    { id: 'code', name: '代码执行', description: '允许 Agent 运行 Python 代码进行计算和验证', enabled: true },
    { id: 'reason', name: '推理链', description: '启用分步推理，展示完整的思考过程', enabled: true },
    { id: 'kb', name: '知识库检索', description: '从已索引的知识库中检索相关文档片段', enabled: true },
    { id: 'calc', name: '数学计算', description: '使用 Wolfram Alpha 或 SymPy 进行精确数学计算', enabled: false },
    { id: 'image', name: '图片生成', description: '根据描述生成示意图、思维导图等可视化内容', enabled: false },
  ])

  const toggleTool = (id: string) => {
    setTools(tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">工具开关</h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          管理 Agent 可调用的外部工具，启用或禁用各项能力
        </p>
      </div>

      <div className="space-y-3">
        {tools.map((tool) => (
          <ToolToggle
            key={tool.id}
            name={tool.name}
            description={tool.description}
            enabled={tool.enabled}
            onToggle={() => toggleTool(tool.id)}
          />
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          应用更改
        </button>
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
          全部启用
        </button>
      </div>
    </div>
  )
}
