'use client'

import { Plus, Book, FileText, Code, Brain, Clock, Network, Play, Layout, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BookItem {
  id: string
  title: string
  pages: number
  status: 'compiled' | 'compiling' | 'planning'
  gradient: string
}

interface BlockType {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
}

export default function BookPage() {
  const books: BookItem[] = [
    { id: '1', title: '线性代数精要', pages: 12, status: 'compiled', gradient: 'from-[#2B6CB0] to-[#9B7AE8]' },
    { id: '2', title: 'Python 算法手册', pages: 8, status: 'compiling', gradient: 'from-[#16A34A] to-[#059669]' },
    { id: '3', title: '机器学习数学基础', pages: 20, status: 'compiled', gradient: 'from-[#F59E0B] to-[#EF4444]' },
    { id: '4', title: '操作系统原理', pages: 0, status: 'planning', gradient: 'from-[#9B7AE8] to-[#E07B9E]' },
  ]

  const blockTypes: BlockType[] = [
    { id: '1', name: 'Text', icon: FileText },
    { id: '2', name: 'Code', icon: Code },
    { id: '3', name: 'Quiz', icon: Brain },
    { id: '4', name: 'FlashCards', icon: Clock },
    { id: '5', name: 'Timeline', icon: Clock },
    { id: '6', name: 'ConceptGraph', icon: Network },
    { id: '7', name: 'Animation', icon: Play },
    { id: '8', name: 'Interactive', icon: Layout },
  ]

  const getStatusBadge = (status: string) => {
    if (status === 'compiled') return { label: '已编译', color: 'bg-[var(--success)] text-white' }
    if (status === 'compiling') return { label: '编译中', color: 'bg-[var(--warning)] text-white' }
    return { label: '规划中', color: 'bg-[var(--muted)] text-[var(--muted-foreground)]' }
  }

  return (
    <div className="h-full bg-[var(--background)] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Book Engine</h1>
          <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            创建新书
          </button>
        </div>
      </div>

      {/* Book Grid */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4 mb-8">
          {books.map((book) => {
            const statusBadge = getStatusBadge(book.status)
            return (
              <div
                key={book.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--primary)] transition-colors cursor-pointer group"
              >
                {/* Book Cover */}
                <div className={cn('h-32 bg-gradient-to-br flex items-center justify-center relative', book.gradient)}>
                  <Book className="h-12 w-12 text-white opacity-80" />
                  <div className="absolute top-3 right-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', statusBadge.color)}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                {/* Book Info */}
                <div className="p-4">
                  <h3 className="text-[14px] font-semibold text-[var(--foreground)] mb-1">{book.title}</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    {book.pages > 0 ? `${book.pages} pages` : 'No pages yet'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Block Type Showcase */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">14 种 Block 类型</h2>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {blockTypes.map((block) => {
              const Icon = block.icon
              return (
                <div
                  key={block.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-[var(--primary)] transition-colors cursor-pointer group"
                >
                  <div className="p-3 rounded-lg bg-[var(--muted)] group-hover:bg-[var(--primary)]/10 transition-colors">
                    <Icon className="h-5 w-5 text-[var(--primary)]" />
                  </div>
                  <span className="text-[12px] font-medium text-[var(--foreground)]">{block.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
