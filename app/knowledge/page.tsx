'use client'

import { useState } from 'react'
import { Plus, Upload, Book, FileText, FileCheck, Search, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeBase {
  id: string
  title: string
  description: string
  blocks: number
  status: 'indexed' | 'indexing'
  icon: React.ComponentType<{ className?: string }>
}

interface RetrievalResult {
  id: string
  score: number
  snippet: string
  source: string
}

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('SVD 在推荐系统中的应用')

  const knowledgeBases: KnowledgeBase[] = [
    {
      id: '1',
      title: '线性代数教材',
      description: '包含矩阵分解、特征值、线性变换等核心概念',
      blocks: 42,
      status: 'indexed',
      icon: Book,
    },
    {
      id: '2',
      title: 'Python 编程笔记',
      description: 'Python 基础语法、NumPy、Pandas 等库的使用',
      blocks: 28,
      status: 'indexed',
      icon: FileText,
    },
    {
      id: '3',
      title: '机器学习论文',
      description: '推荐系统、协同过滤、矩阵分解相关论文',
      blocks: 15,
      status: 'indexing',
      icon: FileCheck,
    },
  ]

  const retrievalResults: RetrievalResult[] = [
    {
      id: '1',
      score: 0.94,
      snippet: 'SVD 分解在推荐系统中的核心应用是通过矩阵分解将用户-物品评分矩阵分解为低秩近似，从而发现用户和物品的潜在特征向量...',
      source: '线性代数教材 · 第 8 章',
    },
    {
      id: '2',
      score: 0.87,
      snippet: '协同过滤算法利用 SVD 进行降维处理，保留前 k 个最大奇异值，实现用户偏好和物品特征的隐语义分析...',
      source: '机器学习论文 · Paper #3',
    },
    {
      id: '3',
      score: 0.79,
      snippet: '在 Netflix Prize 竞赛中，基于 SVD 的矩阵分解方法取得了显著效果，成为推荐系统领域的经典基线模型...',
      source: '机器学习论文 · Paper #7',
    },
  ]

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">知识库</h1>
            <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              新建知识库
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="px-6 py-6">
          <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--primary)] transition-colors cursor-pointer">
            <Upload className="h-8 w-8 text-[var(--muted-foreground)] mx-auto mb-3" />
            <p className="text-[14px] font-medium text-[var(--foreground)] mb-1">拖放文件到此处上传</p>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              支持 PDF、DOCX、MD、TXT · 单文件最大 50MB
            </p>
          </div>
        </div>

        {/* Knowledge Base Cards */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 gap-3">
            {knowledgeBases.map((kb) => {
              const Icon = kb.icon
              return (
                <div
                  key={kb.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[var(--muted)]">
                      <Icon className="h-5 w-5 text-[var(--primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{kb.title}</h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1',
                            kb.status === 'indexed'
                              ? 'bg-[var(--success)] text-white'
                              : 'bg-[var(--warning)] text-white'
                          )}
                        >
                          {kb.status === 'indexed' ? (
                            <>
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              已索引
                            </>
                          ) : (
                            <>
                              <Clock className="h-2.5 w-2.5" />
                              索引中
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--muted-foreground)] mb-2">{kb.description}</p>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{kb.blocks} blocks</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel - RAG Preview */}
      <div className="w-96 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto">
        <div className="p-4 space-y-4">
          <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            RAG 检索预览
          </h3>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              placeholder="输入查询内容..."
            />
          </div>

          {/* Retrieval Results */}
          <div className="space-y-3">
            {retrievalResults.map((result) => (
              <div
                key={result.id}
                className="bg-[var(--background)] rounded-lg p-3 space-y-2 hover:border-[var(--primary)] border border-transparent transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--primary)]">
                    相似度：{(result.score * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{result.source}</span>
                </div>
                <p className="text-[12px] text-[var(--foreground)] leading-relaxed line-clamp-3">{result.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
