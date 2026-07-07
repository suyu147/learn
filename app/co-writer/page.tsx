'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Sparkles,
  RefreshCw,
  ArrowDownUp,
  Minimize2,
  BookOpen,
  Eye,
  PenLine,
  Loader2,
  Clock,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'
import { useCowriterStore, type CowriterDoc } from '@/lib/store/cowriter-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  preview: string
}

interface EditResult {
  editedText: string
  operationId: string
}

type EditAction = 'rewrite' | 'shorten' | 'expand' | 'summarize'

// ---------------------------------------------------------------------------
// Markdown preview helper (lightweight)
// ---------------------------------------------------------------------------

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-5 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-4">$1</h1>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\$\$(.*?)\$\$/gim, '<div class="my-3 p-3 bg-[var(--muted)] rounded-lg font-mono text-sm text-center">$1</div>')
    .replace(/\$(.*?)\$/gim, '<code class="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[var(--primary)] text-[13px]">$1</code>')
    .replace(/\n\n/gim, '</p><p class="mb-3 leading-relaxed">')
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CoWriterPage() {
  const store = useCowriterStore()

  // Local state
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [activeDoc, setActiveDoc] = useState<CowriterDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editAction, setEditAction] = useState<EditAction | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [showInstruction, setShowInstruction] = useState(false)
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split')
  const [dirty, setDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch document list
  // ---------------------------------------------------------------------------
  const fetchDocs = useCallback(async () => {
    try {
      const list = await apiGet<DocSummary[]>('/api/v1/co-writer')
      setDocs(list)
    } catch {
      // API might be down, use empty list
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // ---------------------------------------------------------------------------
  // Load a document
  // ---------------------------------------------------------------------------
  const loadDoc = useCallback(async (id: string) => {
    try {
      const doc = await apiGet<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>(`/api/v1/co-writer/${id}`)
      const mapped: CowriterDoc = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        version: 1,
        lastEdited: doc.updatedAt,
        status: 'saved',
      }
      // Sync to store
      const existing = store.documents.find((d) => d.id === id)
      if (!existing) {
        store.addDoc(mapped)
      }
      store.setActiveDoc(id)
      setActiveDoc(mapped)
      setDirty(false)
    } catch (err) {
      console.error('Failed to load document:', err)
    }
  }, [store])

  // ---------------------------------------------------------------------------
  // Create new document
  // ---------------------------------------------------------------------------
  const createDoc = useCallback(async () => {
    try {
      const doc = await apiPost<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>(
        '/api/v1/co-writer',
        { title: '未命名文档', content: '# 未命名文档\n\n开始写作...' },
      )
      store.addDoc({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        version: 1,
        lastEdited: doc.updatedAt,
        status: 'saved',
      })
      await fetchDocs()
      await loadDoc(doc.id)
    } catch (err) {
      console.error('Failed to create document:', err)
    }
  }, [store, fetchDocs, loadDoc])

  // ---------------------------------------------------------------------------
  // Delete document
  // ---------------------------------------------------------------------------
  const deleteDoc = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('确定删除此文档？')) return
      try {
        await apiDelete(`/api/v1/co-writer/${id}`)
        store.removeDoc(id)
        if (activeDoc?.id === id) {
          setActiveDoc(null)
          store.setActiveDoc('')
        }
        await fetchDocs()
      } catch (err) {
        console.error('Failed to delete document:', err)
      }
    },
    [store, activeDoc, fetchDocs],
  )

  // ---------------------------------------------------------------------------
  // Auto-save (debounced)
  // ---------------------------------------------------------------------------
  const autoSave = useCallback(
    (content: string) => {
      if (!activeDoc) return
      setDirty(true)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          await apiPut(`/api/v1/co-writer/${activeDoc.id}`, { content })
          store.updateDocContent(activeDoc.id, content)
          setDirty(false)
          // Refresh doc list to get updated timestamps
          fetchDocs()
        } catch (err) {
          console.error('Auto-save failed:', err)
        } finally {
          setSaving(false)
        }
      }, 1500)
    },
    [activeDoc, store],
  )

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const content = e.target.value
      setActiveDoc((prev) => (prev ? { ...prev, content } : null))
      autoSave(content)
    },
    [autoSave],
  )

  // ---------------------------------------------------------------------------
  // AI edit action
  // ---------------------------------------------------------------------------
  const runEditAction = useCallback(
    async (action: EditAction) => {
      if (!activeDoc || editing) return

      // If action needs instruction
      if ((action === 'rewrite' || action === 'expand') && !showInstruction) {
        setEditAction(action)
        setShowInstruction(true)
        return
      }

      setEditing(true)
      setEditAction(action)
      store.updateDocContent(activeDoc.id, activeDoc.content) // mark as ai-generating

      try {
        const result = await apiPost<EditResult>(
          `/api/v1/co-writer/${activeDoc.id}/edit`,
          {
            text: activeDoc.content,
            instruction: editInstruction || '',
            action,
            language: 'zh',
          },
        )

        if (result.editedText && !result.editedText.startsWith('[')) {
          setActiveDoc((prev) =>
            prev ? { ...prev, content: result.editedText } : null,
          )
          store.updateDocContent(activeDoc.id, result.editedText)
        }
      } catch (err) {
        console.error('Edit action failed:', err)
      } finally {
        setEditing(false)
        setEditAction(null)
        setShowInstruction(false)
        setEditInstruction('')
      }
    },
    [activeDoc, editing, editInstruction, showInstruction, store],
  )

  // ---------------------------------------------------------------------------
  // Status helpers
  // ---------------------------------------------------------------------------
  const wordCount = activeDoc?.content.length ?? 0
  const lineCount = activeDoc?.content.split('\n').length ?? 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Document list sidebar */}
      <div className="w-64 border-r border-[var(--border)] flex flex-col bg-[var(--card)]">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">文档列表</h2>
          <button
            onClick={createDoc}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors"
            title="新建文档"
          >
            <Plus className="h-4 w-4 text-[var(--muted-foreground)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-40" />
              <p className="text-[12px] text-[var(--muted-foreground)]">暂无文档</p>
              <button
                onClick={createDoc}
                className="mt-2 text-[12px] text-[var(--primary)] hover:underline"
              >
                创建第一个文档
              </button>
            </div>
          ) : (
            docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => loadDoc(doc.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-colors group flex items-start gap-2.5',
                  activeDoc?.id === doc.id
                    ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20'
                    : 'hover:bg-[var(--muted)]',
                )}
              >
                <FileText className="h-4 w-4 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--foreground)] truncate">
                    {doc.title}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                    {doc.preview.slice(0, 80)}
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(doc.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteDoc(doc.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--destructive)]/10 transition-all"
                >
                  <Trash2 className="h-3 w-3 text-[var(--destructive)]" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        {activeDoc ? (
          <>
            {/* Toolbar */}
            <div className="border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PenLine className="h-4 w-4 text-[var(--primary)]" />
                <h1 className="text-[14px] font-semibold text-[var(--foreground)] truncate max-w-xs">
                  {activeDoc.title}
                </h1>
                <span className="text-[11px] flex items-center gap-1">
                  {saving ? (
                    <span className="text-[var(--muted-foreground)] flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> 保存中...
                    </span>
                  ) : dirty ? (
                    <span className="text-[var(--warning)]">● 未保存</span>
                  ) : (
                    <span className="text-[var(--success)] flex items-center gap-1">
                      <Save className="h-3 w-3" /> 已保存
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode('editor')}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium transition-colors',
                      viewMode === 'editor'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
                    )}
                    title="仅编辑器"
                  >
                    <PenLine className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium transition-colors',
                      viewMode === 'split'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
                    )}
                    title="分栏视图"
                  >
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium transition-colors',
                      viewMode === 'preview'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
                    )}
                    title="仅预览"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>

                {/* AI actions */}
                <button
                  onClick={() => runEditAction('rewrite')}
                  disabled={editing}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editing && editAction === 'rewrite' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  改写
                </button>
                <button
                  onClick={() => runEditAction('shorten')}
                  disabled={editing}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editing && editAction === 'shorten' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" />
                  )}
                  精简
                </button>
                <button
                  onClick={() => runEditAction('expand')}
                  disabled={editing}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editing && editAction === 'expand' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" />
                  )}
                  扩展
                </button>
                <button
                  onClick={() => runEditAction('summarize')}
                  disabled={editing}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editing && editAction === 'summarize' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  总结
                </button>
              </div>
            </div>

            {/* Instruction input (conditional) */}
            {showInstruction && (
              <div className="border-b border-[var(--border)] px-4 py-2 bg-[var(--card)]">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editInstruction.trim()) {
                        runEditAction(editAction!)
                      }
                      if (e.key === 'Escape') {
                        setShowInstruction(false)
                        setEditInstruction('')
                      }
                    }}
                    placeholder="输入编辑指令（可选），按 Enter 执行..."
                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editAction) runEditAction(editAction)
                    }}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)]"
                  >
                    执行
                  </button>
                  <button
                    onClick={() => {
                      setShowInstruction(false)
                      setEditInstruction('')
                    }}
                    className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Split Editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Editor pane */}
              {(viewMode === 'split' || viewMode === 'editor') && (
                <div
                  className={cn(
                    'flex flex-col',
                    viewMode === 'split' ? 'flex-1 border-r border-[var(--border)]' : 'flex-1',
                  )}
                >
                  <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2">
                    <PenLine className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span className="text-[12px] font-medium text-[var(--muted-foreground)]">
                      Markdown 源文件
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <textarea
                      value={activeDoc.content}
                      onChange={handleContentChange}
                      className="w-full h-full bg-transparent p-6 font-mono text-[13px] text-[var(--foreground)] leading-relaxed resize-none outline-none"
                      placeholder="开始写作..."
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* Preview pane */}
              {(viewMode === 'split' || viewMode === 'preview') && (
                <div
                  className={cn(
                    'flex flex-col',
                    viewMode === 'split' ? 'flex-1' : 'flex-1',
                  )}
                >
                  <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span className="text-[12px] font-medium text-[var(--muted-foreground)]">
                      实时预览
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {editing ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)] mx-auto mb-3" />
                          <p className="text-[13px] text-[var(--muted-foreground)]">
                            AI 正在{editAction === 'rewrite' ? '改写' : editAction === 'shorten' ? '精简' : editAction === 'expand' ? '扩展' : '总结'}文本...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="prose prose-sm max-w-none text-[var(--foreground)]"
                        dangerouslySetInnerHTML={{
                          __html: `<p class="mb-3 leading-relaxed">${renderMarkdown(activeDoc.content)}</p>`,
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="border-t border-[var(--border)] px-6 py-2 flex items-center justify-between bg-[var(--card)]">
              <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)]">
                <span>字数：{wordCount}</span>
                <span>行数：{lineCount}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)]">
                <span>
                  最近更新：{new Date(activeDoc.lastEdited || Date.now()).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-[var(--muted-foreground)] mx-auto mb-4 opacity-30" />
              <p className="text-[15px] font-medium text-[var(--foreground)] mb-1">
                选择一个文档或创建新文档
              </p>
              <p className="text-[13px] text-[var(--muted-foreground)] mb-4">
                Co-Writer 支持 AI 辅助写作：改写、精简、扩展、总结
              </p>
              <button
                onClick={createDoc}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                新建文档
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
