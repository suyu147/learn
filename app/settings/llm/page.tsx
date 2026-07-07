'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
        {description && (
          <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export default function LLMSettingsPage() {
  const [defaultModel, setDefaultModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState('0.7')
  const [maxTokens, setMaxTokens] = useState('4096')
  const [thinkingMode, setThinkingMode] = useState(true)
  const [contextProtection, setContextProtection] = useState(true)
  const [rateLimiting, setRateLimiting] = useState(false)

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">LLM 模型设置</h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          配置大语言模型提供商、API 密钥和默认参数
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Default Model */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">默认模型</label>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="qwen-max">Qwen-Max</option>
            <option value="deepseek-v2">DeepSeek-V2</option>
          </select>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">Temperature</label>
          <input
            type="text"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="0.7"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">最大 Token 数</label>
          <input
            type="text"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="4096"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <Toggle
            checked={thinkingMode}
            onChange={setThinkingMode}
            label="启用 Thinking 模式"
            description="在回答前展示思考过程，提升复杂推理任务的准确性"
          />
          <Toggle
            checked={contextProtection}
            onChange={setContextProtection}
            label="自动上下文窗口保护"
            description="当上下文接近限制时自动压缩历史消息"
          />
          <Toggle
            checked={rateLimiting}
            onChange={setRateLimiting}
            label="启用流量控制（RPM 限流）"
            description="限制每分钟请求数，避免 API 限流错误"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          应用更改
        </button>
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
          重置为默认
        </button>
      </div>
    </div>
  )
}
