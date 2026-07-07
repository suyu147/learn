'use client'

import { useState } from 'react'
import { Search, Settings, Paperclip, BookOpen, Send, MessageSquare, Lightbulb, HelpCircle, Search as SearchIcon, BarChart3, ChevronDown, ChevronUp, CheckCircle2, Loader2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

type Capability = 'chat' | 'solve' | 'quiz' | 'research' | 'visualize'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'thinking' | 'tool' | 'streaming'
  content: string
  timestamp?: string
  metadata?: { duration?: number; status?: string; tool?: string }
}

export default function ChatPage() {
  const [activeCapability, setActiveCapability] = useState<Capability>('chat')
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [message, setMessage] = useState('')

  const capabilities: { id: Capability; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'solve', label: 'Solve', icon: Lightbulb },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'research', label: 'Research', icon: SearchIcon },
    { id: 'visualize', label: 'Visualize', icon: BarChart3 },
  ]

  const mockMessages: Message[] = [
    {
      id: '1',
      type: 'user',
      content: '请解释 SVD 分解在推荐系统中的应用',
      timestamp: '14:32',
    },
    {
      id: '2',
      type: 'thinking',
      content: '用户询问 SVD 在推荐系统中的应用。这是一个应用理解类问题，需要结合线性代数和机器学习的知识。我应该先解释 SVD 的基本概念，然后说明它在协同过滤中的具体应用，最后给出实际案例。',
      metadata: { duration: 12 },
    },
    {
      id: '3',
      type: 'tool',
      content: 'reason',
      metadata: { status: '完成', tool: '知识检索' },
    },
    {
      id: '4',
      type: 'assistant',
      content: '## SVD 在推荐系统中的应用\n\nSVD（奇异值分解）是推荐系统中协同过滤的核心算法之一。\n\n### 基本原理\n\n将用户-物品评分矩阵 $R$ 分解为三个矩阵的乘积：\n\n$$R \\approx U \\Sigma V^T$$\n\n其中 $U$ 表示用户特征矩阵，$\\Sigma$ 是奇异值对角矩阵，$V^T$ 是物品特征矩阵。\n\n### 应用场景\n\n1. **降维处理**：通过保留前 k 个最大奇异值，实现矩阵的低秩近似\n2. **隐语义分析**：发现用户和物品的潜在特征\n3. **冷启动缓解**：利用矩阵分解的泛化能力',
      timestamp: '14:32',
    },
    {
      id: '5',
      type: 'streaming',
      content: '正在生成更多解释...',
    },
  ]

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[var(--foreground)]">线性代数学习助手</h1>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
              Chat
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Search className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Settings className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {mockMessages.map((msg) => {
            if (msg.type === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[70%] bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-2xl rounded-tr-sm px-4 py-3">
                    <p className="text-[13.5px] leading-relaxed">{msg.content}</p>
                    {msg.timestamp && (
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1 text-right">{msg.timestamp}</p>
                    )}
                  </div>
                </div>
              )
            }

            if (msg.type === 'thinking') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%] bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setThinkingExpanded(!thinkingExpanded)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-[var(--primary)]" />
                        <span className="text-[13px] font-medium text-[var(--foreground)]">
                          思考过程（{msg.metadata?.duration} 秒）
                        </span>
                      </div>
                      {thinkingExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    {thinkingExpanded && (
                      <div className="px-4 pb-3 border-t border-[var(--border)] pt-3">
                        <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed">{msg.content}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            if (msg.type === 'tool') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      工具：{msg.metadata?.tool} · {msg.content}
                    </span>
                    <span className="text-[11px] text-[var(--success)] font-medium">{msg.metadata?.status}</span>
                  </div>
                </div>
              )
            }

            if (msg.type === 'streaming') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-1">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )
            }

            // Assistant message
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-4 w-4 text-[var(--primary)]" />
                    <span className="text-[11px] text-[var(--muted-foreground)]">助手</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                    <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.timestamp && (
                    <p className="text-[11px] text-[var(--muted-foreground)]">{msg.timestamp}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Capability Tabs */}
        <div className="border-t border-[var(--border)] px-6 py-3">
          <div className="flex gap-2">
            {capabilities.map((cap) => {
              const Icon = cap.icon
              return (
                <button
                  key={cap.id}
                  onClick={() => setActiveCapability(cap.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all',
                    activeCapability === cap.id
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cap.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--border)] px-6 py-4">
          <div className="flex gap-2 items-end">
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Paperclip className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <BookOpen className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="输入你的问题..."
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] resize-none min-h-[44px] max-h-[120px]"
                rows={1}
              />
            </div>
            <button className="px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
              <Send className="h-[18px] w-[18px]" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-2 text-center">
            Enter 发送 · Shift+Enter 换行
          </p>
        </div>
      </div>

      {/* Right Activity Panel */}
      <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Agent Status */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Agent 状态
            </h3>
            <div className="bg-[var(--background)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">当前状态</span>
                <span className="text-[11px] text-[var(--success)] font-medium">运行中</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">活跃工具</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">3 个</span>
              </div>
            </div>
          </div>

          {/* Tool Calls */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              工具调用
            </h3>
            <div className="space-y-1.5">
              <div className="bg-[var(--background)] rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-[12px] text-[var(--foreground)]">知识检索</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
              </div>
              <div className="bg-[var(--background)] rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-[12px] text-[var(--foreground)]">reason</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
              </div>
              <div className="bg-[var(--background)] rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-[12px] text-[var(--foreground)]">计算验证</span>
                <Loader2 className="h-3.5 w-3.5 text-[var(--primary)] animate-spin" />
              </div>
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              知识库
            </h3>
            <div className="bg-[var(--background)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">线性代数教材</span>
                <span className="text-[11px] text-[var(--success)]">已索引</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">文档块数</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">42</span>
              </div>
            </div>
          </div>

          {/* Token Usage */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Token 用量
            </h3>
            <div className="bg-[var(--background)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">输入</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">1,247</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">输出</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">3,891</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                <span className="text-[12.5px] text-[var(--foreground)] font-medium">总计</span>
                <span className="text-[11px] text-[var(--primary)] font-medium">5,138</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
