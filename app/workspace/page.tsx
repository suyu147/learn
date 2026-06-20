'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResourceDecisionResultV2 } from '@/lib/generation/resource-decision';
import { useRouter } from 'next/navigation';
import { LearningPathPanel } from '@/components/workspace/learning-path-panel';
import { ResourceViewer } from '@/components/workspace/resource-viewer';
import { TutorChatPanel } from '@/components/workspace/tutor-chat-panel';
import { WorkspaceHeader } from '@/components/workspace/workspace-header';
import { useLearningPathStore } from '@/lib/store/learning-path';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useResourcesStore } from '@/lib/store/resources';
import { useSessionsStore } from '@/lib/store/sessions';
import { useSettingsStore } from '@/lib/store/settings';
import { useResourceDecisionsStore } from '@/lib/store/resource-decisions';
import { useAgentActivityStore } from '@/lib/store/agent-activity';
import { isProfileComplete } from '@/lib/utils/profile-utils';
import type { LearningPath, LearningPathNode } from '@/lib/types/learning-path';
import type { Resource } from '@/lib/types/resource';
import type { LearnEvent, LearnRequest } from '@/lib/learning-graph';
import { AppNav } from '@/components/layout/app-nav';

function buildPath(goal: string, completedNodes: LearningPathNode[], currentNode: LearningPathNode | null) {
  const nodes = [...completedNodes, ...(currentNode ? [currentNode] : [])];
  return {
    id: crypto.randomUUID(),
    userId: 'current',
    goal,
    nodes,
    edges: completedNodes.length > 0 && currentNode ? [{ from: completedNodes[completedNodes.length - 1].id, to: currentNode.id }] : [],
    estimatedDays: Math.max(nodes.length, 1),
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies LearningPath;
}

export default function WorkspacePage() {
  const router = useRouter();
  const { profile, updateDimensions } = useLearningProfileStore();
  const { path, setPath, updateNodeStatus, loadPathForSession } = useLearningPathStore();
  const { addResource, loadResourcesForSession } = useResourcesStore();
  const { currentSessionId, createSession, getCurrentSession } = useSessionsStore();
  const { providerId, modelId, apiKey, baseUrl } = useSettingsStore();
  const recordResourceClick = useResourceDecisionsStore((state) => state.recordResourceClick);
  const recordQuizResult = useResourceDecisionsStore((state) => state.recordQuizResult);
  const addDecisionLog = useResourceDecisionsStore((state) => state.addDecisionLog);
  const setNodeOverride = useResourceDecisionsStore((state) => state.setNodeOverride);
  const getFeedbackForSession = useResourceDecisionsStore((state) => state.getFeedbackForSession);
  const getOverrideForSession = useResourceDecisionsStore((state) => state.getOverrideForSession);
  const getDecisionLogsForSession = useResourceDecisionsStore((state) => state.getDecisionLogsForSession);
  const updateAgentStatus = useAgentActivityStore((state) => state.updateAgentStatus);
  const agentStatuses = useAgentActivityStore((state) => state.agentStatuses);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [decisionSuggestionsByNodeId, setDecisionSuggestionsByNodeId] = useState<Record<string, ResourceDecisionResultV2>>({});
  const startedSessionRef = useRef<string | null>(null);

  const completedNodes = useMemo(() => path?.nodes.filter((node) => node.status === 'completed') ?? [], [path]);
  const currentNode = useMemo(() => path?.nodes.find((node) => node.status === 'in_progress') ?? null, [path]);

  const pathRef = useRef(path);
  const profileRef = useRef(profile);
  const completedNodesRef = useRef(completedNodes);
  const currentNodeRef = useRef(currentNode);

  useEffect(() => {
    if (!isProfileComplete(profile?.dimensions ?? null)) router.replace('/profile');
  }, [profile, router]);

  useEffect(() => {
    if (!profile) return;
    const goal = profile.dimensions.learningGoals.shortTerm?.join('；') || profile.dimensions.learningGoals.longTerm || profile.dimensions.knowledgeBase.subjects.map((subject) => subject.name).join('、');
    const session = getCurrentSession();
    if (!session || session.profileId !== profile.id) createSession(profile.id, goal);
  }, [createSession, getCurrentSession, profile]);

  useEffect(() => {
    if (!currentSessionId) return;
    loadPathForSession(currentSessionId);
    loadResourcesForSession(currentSessionId);
  }, [currentSessionId, loadPathForSession, loadResourcesForSession]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    completedNodesRef.current = completedNodes;
  }, [completedNodes]);

  useEffect(() => {
    if (!currentSessionId) {
      setDecisionSuggestionsByNodeId({});
      return;
    }
    const decisionLogs = getDecisionLogsForSession(currentSessionId);
    setDecisionSuggestionsByNodeId(Object.fromEntries(decisionLogs.map((log) => [log.nodeId, log.result])));
  }, [currentSessionId, getDecisionLogsForSession]);

  const handleLearnEvent = useCallback((event: LearnEvent) => {
    const livePath = pathRef.current;
    const liveProfile = profileRef.current;
    const liveCompletedNodes = completedNodesRef.current;
    const liveCurrentNode = currentNodeRef.current;

    switch (event.type) {
      case 'node_ready': {
        const nextPath = buildPath(livePath?.goal ?? liveProfile?.dimensions.learningGoals.longTerm ?? '学习路径', liveCompletedNodes, event.node);
        pathRef.current = nextPath;
        currentNodeRef.current = event.node;
        setPath(nextPath);
        break;
      }
      case 'resource_decision':
        if (!currentSessionId) break;
        addDecisionLog({
          sessionId: currentSessionId,
          nodeId: event.nodeId,
          createdAt: new Date().toISOString(),
          result: event.decision,
        });
        setDecisionSuggestionsByNodeId((current) => ({ ...current, [event.nodeId]: event.decision }));
        break;
      case 'resource_delta': {
        addResource(event.resource);
        if (!liveCurrentNode) break;
        const updatedNode: LearningPathNode = {
          ...liveCurrentNode,
          resources: [...liveCurrentNode.resources, { resourceId: event.resource.id, type: event.resource.type, title: event.resource.title }],
        };
        const nextPath = {
          ...(livePath ?? buildPath('', [], null)),
          nodes: [...liveCompletedNodes, updatedNode],
          updatedAt: new Date().toISOString(),
        };
        currentNodeRef.current = updatedNode;
        pathRef.current = nextPath;
        setPath(nextPath);
        break;
      }
      case 'ppt_ready': {
        if (!liveCurrentNode) break;
        const pptResource: Resource = { id: crypto.randomUUID(), userId: 'current', type: 'ppt', title: `${liveCurrentNode.title} - 动态课件`, content: JSON.stringify(event.scenes), sourceAgent: 'ppt', status: 'ready', createdAt: new Date().toISOString(), metadata: { pptData: event.scenes } };
        addResource(pptResource);
        const updatedNode: LearningPathNode = {
          ...liveCurrentNode,
          resources: [...liveCurrentNode.resources, { resourceId: pptResource.id, type: 'ppt', title: pptResource.title }],
        };
        const nextPath = {
          ...(livePath ?? buildPath('', [], null)),
          nodes: [...liveCompletedNodes, updatedNode],
          updatedAt: new Date().toISOString(),
        };
        currentNodeRef.current = updatedNode;
        pathRef.current = nextPath;
        setPath(nextPath);
        break;
      }
      case 'profile_update':
        updateDimensions(event.dimensions);
        break;
      case 'path_update':
        pathRef.current = event.path;
        completedNodesRef.current = event.path.nodes.filter((node) => node.status === 'completed');
        currentNodeRef.current = event.path.nodes.find((node) => node.status === 'in_progress') ?? null;
        setPath(event.path);
        break;
      case 'agent_status':
        updateAgentStatus({
          agentId: event.agentId,
          agentName: event.agentName,
          status: event.status,
          resourceType: event.resourceType,
        });
        break;
      default:
        break;
    }
  }, [addDecisionLog, addResource, currentSessionId, setPath, updateAgentStatus, updateDimensions]);

  const sendLearnAction = useCallback(async (payload: LearnRequest) => {
    setIsStreaming(true);
    try {
      const response = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { handleLearnEvent(JSON.parse(line.slice(6)) as LearnEvent); } catch {}
        }
      }
    } finally {
      setIsStreaming(false);
    }
  }, [handleLearnEvent]);

  useEffect(() => {
    if (!profile || !currentSessionId || startedSessionRef.current === currentSessionId || path) return;
    startedSessionRef.current = currentSessionId;
    void sendLearnAction({
      action: 'start',
      sessionId: currentSessionId,
      profile: profile.dimensions,
      goal: profile.dimensions.learningGoals.longTerm || profile.dimensions.learningGoals.shortTerm.join('、') || '学习目标',
      completedNodes: [],
      currentNodeId: null,
      resourceFeedback: getFeedbackForSession(currentSessionId),
      nodeDecisionOverrides: getOverrideForSession(currentSessionId),
      // TODO: 生产环境应移除 apiKey 前端传递，改用环境变量
      aiConfig: { providerId, modelId, apiKey, baseUrl },
    });
  }, [apiKey, baseUrl, currentSessionId, getFeedbackForSession, getOverrideForSession, modelId, path, profile, providerId, sendLearnAction]);

  const handleResourceSelection = useCallback((resource: Resource) => {
    setSelectedResource(resource);
    if (!currentSessionId || !currentNode) return;
    recordResourceClick(currentSessionId, currentNode.id, resource.type);
  }, [currentNode, currentSessionId, recordResourceClick]);

  const handleQuizResult = useCallback((_resource: Resource, result: { score: number; completed: boolean }) => {
    if (!currentSessionId || !currentNode) return;
    recordQuizResult(currentSessionId, currentNode.id, result.score, result.completed);
  }, [currentNode, currentSessionId, recordQuizResult]);

  const handleNodeComplete = useCallback((nodeId: string) => {
    if (!currentSessionId || !profile || !currentNode) return;
    updateNodeStatus(nodeId, 'completed');
    const nextCompleted = [...completedNodes, { ...currentNode, status: 'completed' as const }];
    void sendLearnAction({
      action: 'node_complete',
      sessionId: currentSessionId,
      profile: profile.dimensions,
      goal: path?.goal ?? '',
      completedNodes: nextCompleted,
      currentNodeId: nodeId,
      quizResults: [],
      resourceFeedback: getFeedbackForSession(currentSessionId),
      nodeDecisionOverrides: getOverrideForSession(currentSessionId),
      // TODO: 生产环境应移除 apiKey 前端传递，改用环境变量
      aiConfig: { providerId, modelId, apiKey, baseUrl },
    });
  }, [apiKey, baseUrl, completedNodes, currentNode, currentSessionId, getFeedbackForSession, getOverrideForSession, modelId, path?.goal, profile, providerId, sendLearnAction, updateNodeStatus]);

  const handleResourceView = useCallback((nodeId: string, type: Resource['type'], dwellMs: number) => {
    if (!currentSessionId) return;
    useResourceDecisionsStore.getState().recordResourceView(currentSessionId, nodeId, type, dwellMs);
  }, [currentSessionId]);

  const handleSuggestionSelection = useCallback((nodeId: string, selectedTypes: Resource['type'][]) => {
    if (!currentSessionId) return;
    setNodeOverride(currentSessionId, nodeId, selectedTypes);
    setDecisionSuggestionsByNodeId((current) => {
      const suggestion = current[nodeId];
      if (!suggestion) return current;
      const selectedSet = new Set(selectedTypes);
      const nextSuggestion: ResourceDecisionResultV2 = {
        ...suggestion,
        items: suggestion.items.map((item) => selectedSet.has(item.type)
          ? { ...item, action: 'generate', reason: item.action === 'generate' ? item.reason : '用户手动选择保留该资源类型', sourceLayer: item.action === 'generate' ? item.sourceLayer : 'feedback' }
          : { ...item, action: 'skip', reason: item.action === 'skip' ? item.reason : '用户手动取消该资源类型' }),
        execution: {
          resourceTypes: suggestion.items.filter((item) => item.type !== 'ppt' && selectedSet.has(item.type)).map((item) => item.type),
          shouldGeneratePPT: selectedSet.has('ppt'),
        },
        summary: {
          reasoning: suggestion.items.map((item) => `[${selectedSet.has(item.type) ? item.type : `跳过 ${item.type}`}] ${selectedSet.has(item.type) ? (item.action === 'generate' ? item.reason : '用户手动选择保留该资源类型') : (item.action === 'skip' ? item.reason : '用户手动取消该资源类型')}`),
          skipped: suggestion.items.filter((item) => !selectedSet.has(item.type)).map((item) => ({ type: item.type, reason: item.action === 'skip' ? item.reason : '用户手动取消该资源类型' })),
        },
        trace: {
          ...suggestion.trace,
          feedbackSignals: [...suggestion.trace.feedbackSignals.filter((signal) => signal !== 'override:manual-selection'), 'override:manual-selection'],
        },
      };
      addDecisionLog({ sessionId: currentSessionId, nodeId, createdAt: new Date().toISOString(), result: nextSuggestion });
      return { ...current, [nodeId]: nextSuggestion };
    });
  }, [addDecisionLog, currentSessionId, setNodeOverride]);

  return (
    <div className="flex h-screen flex-col">
      <AppNav />
      <WorkspaceHeader profile={profile} agentStatuses={agentStatuses} />
      <div className="flex flex-1 overflow-hidden">
        <LearningPathPanel
          path={path}
          generatingNodes={isStreaming && currentNode ? new Set([currentNode.id]) : new Set()}
          decisionSuggestionsByNodeId={decisionSuggestionsByNodeId}
          onSuggestionSelection={handleSuggestionSelection}
          onSelectResource={handleResourceSelection}
          onNodeComplete={handleNodeComplete}
        />
        <div className="flex-1 overflow-auto border-x">
          <ResourceViewer
            resource={selectedResource}
            sessionId={currentSessionId}
            nodeId={currentNode?.id ?? null}
            onQuizResult={handleQuizResult}
            onResourceView={handleResourceView}
          />
        </div>
        <TutorChatPanel selectedResource={selectedResource} />
      </div>
    </div>
  );
}
