'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  FileText,
  Brain,
  Video,
  Code,
  Presentation,
  BookOpen,
  CheckSquare,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLearningPathStore } from '@/lib/store/learning-path'
import { useResourcesStore } from '@/lib/store/resources'
import { useLearningProfileStore } from '@/lib/store/learning-profile'
import { useSessionsStore } from '@/lib/store/sessions'
import { consumeSSEStream, apiGet, apiPost } from '@/lib/api-client'
import { getApiToken } from '@/lib/auth-token'
import { useI18n } from '@/lib/hooks/use-i18n'
import type { LearningPathNode } from '@/lib/types/learning-path'
import type { Resource, ResourceType } from '@/lib/types/resource'
import { RESOURCE_TYPE_LABELS } from '@/lib/types/resource'
import type { ProfileDimensions } from '@/lib/types/profile'
import { PROFILE_DIMENSION_LABELS } from '@/lib/types/profile'
import { ResourceViewer } from '@/components/workspace/resource-viewer'
import { useResourceDecisionsStore } from '@/lib/store/resource-decisions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'anonymous'

const RESOURCE_ICON_MAP: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  mindmap: Brain,
  quiz: CheckSquare,
  video: Video,
  code: Code,
  reading: BookOpen,
  ppt: Presentation,
}

/** Map profile dimension keys to a 0-100 score for display. */
function computeDimensionScores(dimensions: ProfileDimensions): { label: string; value: number }[] {
  const levelMap = { beginner: 33, intermediate: 66, advanced: 100 }
  const speedMap = { slow: 33, moderate: 66, fast: 100 }

  return [
    {
      label: PROFILE_DIMENSION_LABELS.knowledgeBase,
      value: levelMap[dimensions.knowledgeBase.level] ?? 33,
    },
    {
      label: PROFILE_DIMENSION_LABELS.cognitiveStyle,
      value: dimensions.cognitiveStyle.preference ? 70 : 40,
    },
    {
      label: PROFILE_DIMENSION_LABELS.learningGoals,
      value: dimensions.learningGoals.shortTerm.length > 0 ? 75 : 30,
    },
    {
      label: PROFILE_DIMENSION_LABELS.learningPace,
      value: speedMap[dimensions.learningPace.speed] ?? 50,
    },
  ]
}

// ---------------------------------------------------------------------------
// Stream event shape from /api/v1/smartlearn SSE endpoints
// ---------------------------------------------------------------------------

interface SmartLearnStreamEvent {
  type: string
  source: string
  stage: string
  content: string
  metadata: Record<string, unknown>
  sessionId: string
  turnId: string
  seq: number
  timestamp: number
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SmartLearnPage() {
  const i18n = useI18n()

  // -- Store selectors --
  const path = useLearningPathStore((s) => s.path)
  const setPath = useLearningPathStore((s) => s.setPath)
  const updateNodeStatus = useLearningPathStore((s) => s.updateNodeStatus)
  const pathReset = useLearningPathStore((s) => s.reset)
  const isPlanning = useLearningPathStore((s) => s.isPlanning)
  const setPlanning = useLearningPathStore((s) => s.setPlanning)

  const resources = useResourcesStore((s) => s.resources)
  const addResource = useResourcesStore((s) => s.addResource)
  const resourcesReset = useResourcesStore((s) => s.reset)

  const profile = useLearningProfileStore((s) => s.profile)
  const setProfile = useLearningProfileStore((s) => s.setProfile)
  const updateDimensions = useLearningProfileStore((s) => s.updateDimensions)

  const currentSessionId = useSessionsStore((s) => s.currentSessionId)
  const createSession = useSessionsStore((s) => s.createSession)
  const getCurrentSession = useSessionsStore((s) => s.getCurrentSession)
  const sessions = useSessionsStore((s) => s.sessions)
  const deleteSession = useSessionsStore((s) => s.deleteSession)

  // -- Local state --
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [currentPhase, setCurrentPhase] = useState('')
  const [agentStatus, setAgentStatus] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // -- Resource decisions store --
  const recordResourceClick = useResourceDecisionsStore((s) => s.recordResourceClick)
  const recordResourceView = useResourceDecisionsStore((s) => s.recordResourceView)
  const recordQuizResult = useResourceDecisionsStore((s) => s.recordQuizResult)

  /** Open a resource in the viewer and record the click for feedback */
  const handleResourceClick = useCallback(
    (resource: Resource, nodeId: string) => {
      setSelectedResource(resource)
      if (currentSessionId) {
        recordResourceClick(currentSessionId, nodeId, resource.type)
      }
    },
    [currentSessionId, recordResourceClick],
  )

  /** Track how long the user viewed a resource (dwell time) */
  const handleResourceView = useCallback(
    (nodeId: string, type: ResourceType, dwellMs: number) => {
      if (currentSessionId) {
        recordResourceView(currentSessionId, nodeId, type, dwellMs)
      }
    },
    [currentSessionId, recordResourceView],
  )

  /** Close the resource viewer */
  const handleCloseResource = useCallback(() => {
    setSelectedResource(null)
  }, [])

  /** Build headers for SSE fetch calls — includes auth token when available */
  const sseHeaders = (): Record<string, string> => {
    const token = getApiToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  // -- Refs for stale-closure prevention in SSE callbacks --
  const pathRef = useRef(path)
  useEffect(() => { pathRef.current = path }, [path])

  // -- Derived data --
  const nodes = path?.nodes ?? []
  const currentSession = getCurrentSession()
  const activeNode = nodes.find((n) => n.status === 'in_progress') ?? null
  const completedCount = nodes.filter((n) => n.status === 'completed').length
  const totalCount = nodes.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Resources for the active node
  const activeNodeResources = activeNode
    ? resources.filter((r) =>
        activeNode.resources?.some((ref) => ref.resourceId === r.id),
      )
    : []

  /** Handle quiz completion — feed result back into the decision engine */
  const handleQuizResult = useCallback(
    (resource: Resource, result: { score: number; completed: boolean }) => {
      if (currentSessionId && activeNode) {
        recordQuizResult(currentSessionId, activeNode.id, result.score, result.completed)
      }
    },
    [currentSessionId, activeNode, recordQuizResult],
  )

  const displayDimensions = profile
    ? computeDimensionScores(profile.dimensions)
    : []

  // -- Computed stats --
  const stats = [
    { label: '掌握度', value: `${progressPercent}%`, color: 'text-[var(--success)]' },
    { label: '学习会话', value: sessions.length, color: 'text-[var(--primary)]' },
    { label: '已完成节点', value: completedCount, color: 'text-[var(--info)]' },
    { label: '学习资源', value: resources.length, color: 'text-[var(--warning)]' },
  ]

  // =========================================================================
  // Fetch profile on mount
  // =========================================================================

  useEffect(() => {
    let cancelled = false

    async function fetchProfile() {
      setIsProfileLoading(true)
      setProfileError(null)
      try {
        const data = await apiGet<{
          profile: {
            id: string | null
            userId: string
            version: number
            dimensions: ProfileDimensions
            isNew?: boolean
          }
        }>(`/api/v1/smartlearn/profile?userId=${USER_ID}`)

        if (!cancelled) {
          setProfile({
            id: data.profile.id ?? 'remote',
            userId: data.profile.userId,
            version: data.profile.version ?? 0,
            dimensions: data.profile.dimensions,
            updatedAt: new Date().toISOString(),
            conversationHistory: [],
          })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '加载画像失败'
          setProfileError(message)
        }
      } finally {
        if (!cancelled) setIsProfileLoading(false)
      }
    }

    fetchProfile()
    return () => { cancelled = true }
  }, [setProfile])

  // =========================================================================
  // SSE event processor
  // =========================================================================

  const processSSEEvent = useCallback(
    (event: SmartLearnStreamEvent) => {
      switch (event.type) {
        // -- Phase lifecycle --
        case 'stage_start':
          setCurrentPhase(event.content || event.stage)
          setAgentStatus(`正在${event.content || event.stage}...`)
          break

        case 'stage_end':
          setCurrentPhase('')
          setAgentStatus('')
          break

        // -- Streaming text --
        case 'content':
          setStreamingText((prev) => prev + event.content)
          break

        // -- Structured results --
        case 'result': {
          const meta = event.metadata
          const learnEventType = meta.learnEventType as string | undefined

          if (learnEventType === 'node_ready' && meta.node) {
            // A new learning node was generated — add to path
            const node = meta.node as LearningPathNode
            const currentPath = pathRef.current
            if (currentPath) {
              const exists = currentPath.nodes.some((n) => n.id === node.id)
              if (!exists) {
                setPath({
                  ...currentPath,
                  nodes: [...currentPath.nodes, node],
                  edges: currentPath.edges,
                  updatedAt: new Date().toISOString(),
                })
              }
            }
          }

          if (learnEventType === 'resource_delta' && meta.resource) {
            const resource = meta.resource as Resource
            addResource(resource)
          }

          if (learnEventType === 'path_update' && meta.path) {
            const updatedPath = meta.path as import('@/lib/types/learning-path').LearningPath
            setPath(updatedPath)
          }

          if (learnEventType === 'evaluation_result' && meta.evaluation) {
            const evaluation = meta.evaluation as {
              feedback: string
              weakPoints: string[]
              strongPoints: string[]
              suggestedFocus: string[]
              profileUpdate: ProfileDimensions | null
            }
            setStreamingText((prev) =>
              prev + `\n\n--- 评估结果 ---\n${evaluation.feedback}\n`,
            )
            if (evaluation.profileUpdate) {
              updateDimensions(evaluation.profileUpdate)
            }
          }

          if (learnEventType === 'profile_update' && meta.dimensions) {
            updateDimensions(meta.dimensions as Partial<ProfileDimensions>)
          }
          break
        }

        // -- Agent progress --
        case 'progress':
          setAgentStatus(event.content)
          break

        // -- Error --
        case 'error':
          setError(event.content || '未知错误')
          break

        // -- Done --
        case 'done':
          setIsStreaming(false)
          setAgentStatus('')
          setCurrentPhase('')
          break

        default:
          // Ignore unknown event types
          break
      }
    },
    [setPath, addResource, updateDimensions],
  )

  // =========================================================================
  // Start learning (SSE stream to /api/v1/smartlearn)
  // =========================================================================

  const handleStartLearning = async () => {
    setError(null)
    setStreamingText('')

    const profileDimensions = profile?.dimensions
    if (!profileDimensions) {
      setError('学习画像尚未加载，请稍后再试')
      return
    }

    // Create or reuse session
    let sessionId = currentSessionId
    if (!sessionId) {
      const goal = profileDimensions.learningGoals.shortTerm[0]
        ?? profileDimensions.learningGoals.longTerm
        ?? '学习'
      const session = createSession(profile?.id ?? USER_ID, goal)
      sessionId = session.id
    }

    setIsStreaming(true)
    setPlanning(true)
    setStreamingText('')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const completedNodes = nodes.filter((n) => n.status === 'completed')

      const res = await fetch('/api/v1/smartlearn', {
        method: 'POST',
        headers: sseHeaders(),
        body: JSON.stringify({
          action: 'start',
          sessionId,
          profile: profileDimensions,
          goal: currentSession?.goal ?? profileDimensions.learningGoals.longTerm ?? '学习',
          completedNodes,
          currentNodeId: activeNode?.id ?? null,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const body = await res.json()
          msg = body.error ?? msg
        } catch {
          // not JSON
        }
        throw new Error(msg)
      }

      await consumeSSEStream(res, {
        onEvent: (rawEvent) => {
          const event = rawEvent as unknown as SmartLearnStreamEvent
          processSSEEvent(event)
        },
        onError: (err) => {
          if (!abort.signal.aborted) {
            setError(err.message || 'Stream error')
            setIsStreaming(false)
          }
        },
        signal: abort.signal,
      })
    } catch (err) {
      if (abort.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setIsStreaming(false)
      setPlanning(false)
      abortRef.current = null
    }
  }

  // =========================================================================
  // Quiz evaluation
  // =========================================================================

  const handleQuizEvaluation = useCallback(
    async (quizResults: Array<{
      questionId: string
      question: string
      knowledgePoints: string[]
      correct: boolean
      userAnswer: string
      correctAnswer: string
      difficulty: number
    }>) => {
      if (!profile?.dimensions) return
      setError(null)
      setIsStreaming(true)
      setStreamingText('')

      const abort = new AbortController()
      abortRef.current = abort

      try {
        const completedNodes = nodes.filter((n) => n.status === 'completed')

        const res = await fetch('/api/v1/smartlearn/evaluate', {
          method: 'POST',
          headers: sseHeaders(),
          body: JSON.stringify({
            sessionId: currentSessionId,
            quizResults,
            profile: profile.dimensions,
            goal: currentSession?.goal ?? '',
            completedNodes,
            currentNodeId: activeNode?.id ?? null,
            currentNodeTitle: activeNode?.title ?? null,
          }),
          signal: abort.signal,
        })

        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = await res.json()
            msg = body.error ?? msg
          } catch {
            // not JSON
          }
          throw new Error(msg)
        }

        await consumeSSEStream(res, {
          onEvent: (rawEvent) => {
            const event = rawEvent as unknown as SmartLearnStreamEvent
            processSSEEvent(event)
          },
          onError: (err) => {
            if (!abort.signal.aborted) {
              setError(err.message || '评估流式传输错误')
              setIsStreaming(false)
            }
          },
          signal: abort.signal,
        })

        // Mark the active node as completed after successful evaluation
        if (activeNode) {
          updateNodeStatus(activeNode.id, 'completed')
        }
      } catch (err) {
        if (abort.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [profile, currentSessionId, currentSession, nodes, activeNode, processSSEEvent, updateNodeStatus],
  )

  // =========================================================================
  // Generate resources
  // =========================================================================

  const handleGenerateResources = useCallback(async () => {
    if (!profile?.dimensions) return
    setError(null)
    setIsStreaming(true)
    setStreamingText('')
    setAgentStatus('正在生成学习资源...')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const completedNodes = nodes.filter((n) => n.status === 'completed')

      const res = await fetch('/api/v1/smartlearn/resources', {
        method: 'POST',
        headers: sseHeaders(),
        body: JSON.stringify({
          sessionId: currentSessionId,
          profile: profile.dimensions,
          goal: currentSession?.goal ?? '',
          completedNodes,
          currentNodeId: activeNode?.id ?? null,
          currentNodeTitle: activeNode?.title ?? null,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const body = await res.json()
          msg = body.error ?? msg
        } catch {
          // not JSON
        }
        throw new Error(msg)
      }

      await consumeSSEStream(res, {
        onEvent: (rawEvent) => {
          const event = rawEvent as unknown as SmartLearnStreamEvent
          processSSEEvent(event)
        },
        onError: (err) => {
          if (!abort.signal.aborted) {
            setError(err.message || '资源生成流式传输错误')
            setIsStreaming(false)
          }
        },
        signal: abort.signal,
      })
    } catch (err) {
      if (abort.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setIsStreaming(false)
      setAgentStatus('')
      abortRef.current = null
    }
  }, [profile, currentSessionId, currentSession, nodes, activeNode, processSSEEvent])

  // =========================================================================
  // Update profile dimensions via API
  // =========================================================================

  const handleUpdateProfile = useCallback(
    async (dimensions: Partial<ProfileDimensions>) => {
      try {
        const data = await apiPost<{
          profile: {
            id: string | null
            userId: string
            version: number
            dimensions: ProfileDimensions
          }
        }>('/api/v1/smartlearn/profile', {
          userId: USER_ID,
          dimensions,
        })
        updateDimensions(data.profile.dimensions)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update profile'
        setError(message)
      }
    },
    [updateDimensions],
  )

  // =========================================================================
  // Reset
  // =========================================================================

  const handleReset = useCallback(() => {
    // Abort any active stream
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    // Clear stores
    pathReset()
    resourcesReset()

    // Clear local state
    setIsStreaming(false)
    setError(null)
    setStreamingText('')
    setCurrentPhase('')
    setAgentStatus('')
    setSelectedNodeId(null)
    setSelectedResource(null)

    // Delete session if exists
    if (currentSessionId) {
      deleteSession(currentSessionId)
    }
  }, [pathReset, resourcesReset, currentSessionId, deleteSession])

  // =========================================================================
  // Node selection
  // =========================================================================

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node || node.status === 'locked') return
      setSelectedNodeId(nodeId)
    },
    [nodes],
  )

  // =========================================================================
  // Cleanup on unmount
  // =========================================================================

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  // =========================================================================
  // Render helpers
  // =========================================================================

  const getNodeIcon = (node: LearningPathNode, idx: number) => {
    if (node.status === 'completed') return <CheckCircle2 className="h-5 w-5" />
    if (node.status === 'locked') return <Lock className="h-5 w-5" />
    return <span className="text-sm font-bold">{idx + 1}</span>
  }

  const getNodeButtonClass = (node: LearningPathNode) => {
    return cn(
      'h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all',
      node.status === 'completed' && 'bg-[var(--success)] border-[var(--success)] text-white',
      node.status === 'in_progress' && 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30',
      node.status === 'available' && 'bg-[var(--card)] border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10',
      node.status === 'locked' && 'bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed',
    )
  }

  const getNodeLabelClass = (node: LearningPathNode) => {
    return cn(
      'text-[11px] text-center max-w-[80px] leading-tight',
      node.status === 'locked'
        ? 'text-[var(--muted-foreground)]'
        : node.id === selectedNodeId
          ? 'text-[var(--primary)] font-medium'
          : 'text-[var(--foreground)]',
    )
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">
                {currentSession?.goal ?? '智能学习'}
                {totalCount > 0 && ` · 学习路径`}
              </h1>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
                {totalCount > 0
                  ? `${completedCount}/${totalCount} 节点完成 · 进度 ${progressPercent}%`
                  : isPlanning
                    ? '正在规划学习路径...'
                    : '点击下方按钮开始学习'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={isStreaming}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置
              </button>
              <button
                onClick={handleStartLearning}
                disabled={isStreaming || isProfileLoading}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {isStreaming ? '学习中...' : totalCount > 0 ? '继续' : '开始学习'}
              </button>
            </div>
          </div>

          {/* Agent status bar */}
          {agentStatus && (
            <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] mt-2">
              <Loader2 className="h-3 w-3 animate-spin text-[var(--primary)]" />
              <span>{agentStatus}</span>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              关闭
            </button>
          </div>
        )}

        {/* Learning Path Timeline */}
        {nodes.length > 0 && (
          <div className="px-6 py-6 border-b border-[var(--border)]">
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-[var(--border)] -translate-y-1/2" />

              {/* Nodes */}
              <div className="relative flex justify-between items-center">
                {nodes.map((node, idx) => (
                  <div key={node.id} className="flex flex-col items-center gap-2 relative">
                    <button
                      onClick={() => handleNodeSelect(node.id)}
                      className={getNodeButtonClass(node)}
                    >
                      {getNodeIcon(node, idx)}
                    </button>
                    <span className={getNodeLabelClass(node)}>
                      {node.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading state while fetching profile */}
        {isProfileLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
              <span className="text-[13px] text-[var(--muted-foreground)]">{i18n.t('common.loading')}</span>
            </div>
          </div>
        )}

        {/* Empty state — no path yet */}
        {!isProfileLoading && nodes.length === 0 && !isStreaming && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center space-y-4 max-w-md">
              {profileError ? (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto text-[var(--warning)]" />
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    画像加载失败
                  </h2>
                  <p className="text-[13px] text-[var(--muted-foreground)]">
                    {profileError}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)]"
                  >
                    重试
                  </button>
                </>
              ) : (
                <>
                  <Play className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    准备开始学习
                  </h2>
                  <p className="text-[13px] text-[var(--muted-foreground)]">
                    点击上方「开始学习」按钮，AI 将根据您的学习画像规划学习路径并生成个性化学习资源。
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Streaming text output */}
        {streamingText && (
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
              AI 输出
            </h3>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <p className="text-[13px] text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                {streamingText}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-[var(--primary)] animate-pulse ml-0.5 align-text-bottom" />
                )}
              </p>
            </div>
          </div>
        )}

        {/* Current Node Content */}
        {(activeNode || selectedNodeId) && (
          <div className="flex-1 px-6 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                {selectedNodeId
                  ? `当前节点：${nodes.find((n) => n.id === selectedNodeId)?.title ?? ''}`
                  : `当前节点：${activeNode?.title ?? ''}`}
              </h2>
              <p className="text-[13px] text-[var(--muted-foreground)]">
                {activeNodeResources.length} 个学习资源
                {activeNode?.estimatedMinutes ? ` · 预计用时 ${activeNode.estimatedMinutes} 分钟` : ''}
              </p>
            </div>

            {/* Resource Grid */}
            {activeNodeResources.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {activeNodeResources.map((resource) => {
                  const Icon = RESOURCE_ICON_MAP[resource.type] ?? FileText
                  return (
                    <button
                      key={resource.id}
                      onClick={() => handleResourceClick(resource, activeNode!.id)}
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
                          <span className="text-[11px] text-[var(--muted-foreground)]">
                            {RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                {isStreaming ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <span className="text-[13px] text-[var(--muted-foreground)]">
                      正在生成资源...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateResources}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                  >
                    生成学习资源
                  </button>
                )}
              </div>
            )}

            {/* Node actions */}
            {activeNode && activeNode.status === 'in_progress' && !isStreaming && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleGenerateResources}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                >
                  重新生成资源
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Panel - Learner Profile */}
      <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Profile Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
            <div className="h-12 w-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold text-lg">
              {isProfileLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'L'
              )}
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
                {isProfileLoading ? '加载中...' : '学习者'}
              </h3>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {profile
                  ? `画像 v${profile.version}`
                  : '暂无画像'}
              </p>
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
          {displayDimensions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                学习维度
              </h3>
              {displayDimensions.map((dim) => (
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
          )}

          {/* Knowledge subjects */}
          {profile && profile.dimensions.knowledgeBase.subjects.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                科目掌握度
              </h3>
              {profile.dimensions.knowledgeBase.subjects.map((subject) => (
                <div key={subject.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-[var(--foreground)]">{subject.name}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {Math.round(subject.mastery * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--success)] rounded-full transition-all"
                      style={{ width: `${Math.round(subject.mastery * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weak points */}
          {profile && profile.dimensions.weakPoints.topics.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                薄弱点
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.dimensions.weakPoints.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] text-[11px]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resource Viewer Modal Overlay */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseResource}
          />
          {/* Modal content */}
          <div className="relative z-10 h-[90vh] w-[90vw] max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal header with close button */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
              <span className="text-[13px] font-medium text-[var(--muted-foreground)]">
                {RESOURCE_TYPE_LABELS[selectedResource.type]} · {selectedResource.title}
              </span>
              <button
                onClick={handleCloseResource}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Viewer content */}
            <div className="flex-1 overflow-hidden">
              <ResourceViewer
                resource={selectedResource}
                sessionId={currentSessionId}
                nodeId={activeNode?.id ?? selectedNodeId}
                onQuizResult={handleQuizResult}
                onResourceView={handleResourceView}
                onRegenerate={undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
