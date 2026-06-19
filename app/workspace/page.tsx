'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLearningPathStore } from '@/lib/store/learning-path';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useResourcesStore } from '@/lib/store/resources';
import { useSessionsStore } from '@/lib/store/sessions';
import { useSettingsStore } from '@/lib/store/settings';
import { isProfileComplete } from '@/lib/utils/profile-utils';
import { LearningPathPanel } from '@/components/workspace/learning-path-panel';
import { ResourceViewer } from '@/components/workspace/resource-viewer';
import { TutorChatPanel } from '@/components/workspace/tutor-chat-panel';
import { WorkspaceHeader } from '@/components/workspace/workspace-header';
import { ALL_RESOURCE_TYPES, type Resource, type ResourceType } from '@/lib/types/resource';
import type { LearningPath, LearningPathNode, PathNodeStatus } from '@/lib/types/learning-path';
import {
  buildNodeDecisionContext,
  decideNodeResourcePlan,
  type ResourceDecisionResultV2,
} from '@/lib/generation/resource-decision';
import { useResourceDecisionsStore } from '@/lib/store/resource-decisions';

const VALID_NODE_STATUSES: PathNodeStatus[] = ['locked', 'available', 'in_progress', 'completed'];

function getNodeOrder(path: LearningPath, nodeId: string) {
  const index = path.nodes.findIndex((node) => node.id === nodeId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getNodeDependencies(path: LearningPath, node: LearningPathNode) {
  if (node.prerequisites.length > 0) {
    return node.prerequisites;
  }

  return path.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from);
}

function areDependenciesSatisfied(path: LearningPath, node: LearningPathNode, completedNodeIds: Set<string>) {
  const dependencies = getNodeDependencies(path, node);
  if (dependencies.length === 0) {
    return true;
  }

  return dependencies.every((dependencyId) => completedNodeIds.has(dependencyId));
}

function reconcilePathStatuses(path: LearningPath): LearningPath {
  const completedNodeIds = new Set(
    path.nodes.filter((node) => node.status === 'completed').map((node) => node.id),
  );
  const inProgressNodeIds = new Set(
    path.nodes.filter((node) => node.status === 'in_progress').map((node) => node.id),
  );

  const eligibleNodeIds = new Set(
    path.nodes
      .filter((node) => node.status !== 'completed')
      .filter((node) => areDependenciesSatisfied(path, node, completedNodeIds))
      .map((node) => node.id),
  );

  let nextActiveNodeId = path.nodes.find(
    (node) => node.status === 'in_progress' && eligibleNodeIds.has(node.id),
  )?.id;

  if (!nextActiveNodeId) {
    nextActiveNodeId = path.nodes.find(
      (node) => node.status !== 'completed' && eligibleNodeIds.has(node.id),
    )?.id;
  }

  let changed = false;
  const nextNodes = path.nodes.map((node) => {
    let nextStatus: PathNodeStatus;

    if (node.status === 'completed') {
      nextStatus = 'completed';
    } else if (!eligibleNodeIds.has(node.id)) {
      nextStatus = 'locked';
    } else if (node.id === nextActiveNodeId) {
      nextStatus = 'in_progress';
    } else {
      nextStatus = 'available';
    }

    if (nextStatus !== node.status) {
      changed = true;
      return { ...node, status: nextStatus };
    }

    if (node.status === 'in_progress' && !inProgressNodeIds.has(node.id)) {
      changed = true;
    }

    return node;
  });

  return changed ? { ...path, nodes: nextNodes } : path;
}

function normalizePlannedPath(path: LearningPath): LearningPath {
  const nodes = path.nodes.map((node, index) => ({
    ...node,
    resources: [],
    status: VALID_NODE_STATUSES.includes(node.status)
      ? node.status
      : index === 0
        ? 'in_progress'
        : 'locked',
  }));

  return reconcilePathStatuses({ ...path, nodes });
}

export default function WorkspacePage() {
  const router = useRouter();
  const { profile } = useLearningProfileStore();
  const { path, setPath, storedPaths, updateNodeStatus, loadPathForSession, isPlanning, setPlanning } =
    useLearningPathStore();
  const { addResource, removeResource, loadResourcesForSession } = useResourcesStore();
  const { sessions, currentSessionId, createSession, getCurrentSession } = useSessionsStore();
  const { providerId, modelId, apiKey, baseUrl, generatePptImages } = useSettingsStore();
  const addDecisionLog = useResourceDecisionsStore((state) => state.addDecisionLog);
  const decisionLogsBySession = useResourceDecisionsStore((state) => state.logsBySession);
  const overridesBySession = useResourceDecisionsStore((state) => state.overridesBySession);
  const feedbackBySession = useResourceDecisionsStore((state) => state.feedbackBySession);
  const setNodeOverride = useResourceDecisionsStore((state) => state.setNodeOverride);
  const clearNodeOverride = useResourceDecisionsStore((state) => state.clearNodeOverride);
  const recordResourceClick = useResourceDecisionsStore((state) => state.recordResourceClick);
  const recordResourceView = useResourceDecisionsStore((state) => state.recordResourceView);
  const recordQuizResult = useResourceDecisionsStore((state) => state.recordQuizResult);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [generatingNodes, setGeneratingNodes] = useState<Set<string>>(new Set());

  const lastProfileIdRef = useRef<string | null>(null);
  const hasAutoPlanned = useRef(false);
  const isGeneratingRef = useRef(false);
  const generatingNodeSetRef = useRef<Set<string>>(new Set());
  const generationVersionByNodeRef = useRef<Map<string, number>>(new Map());
  const activeAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const selectedResourceOpenedAtRef = useRef<number | null>(null);
  const lastSelectedResourceRef = useRef<Resource | null>(null);

  const decisionSuggestionsByNodeId = useMemo(() => {
    if (!path || !profile) return {} as Record<string, ResourceDecisionResultV2>;

    const loggedByNodeId = new Map(
      (currentSessionId ? decisionLogsBySession[currentSessionId] ?? [] : []).map((log) => [log.nodeId, log.result]),
    );
    const overrides = currentSessionId ? overridesBySession[currentSessionId] ?? {} : {};
    const sessionFeedback = currentSessionId ? feedbackBySession[currentSessionId] ?? [] : [];

    return Object.fromEntries(
      path.nodes.map((node, index) => {
        const override = overrides[node.id];
        const priorFeedback = sessionFeedback.filter((item) => {
          const previousIndex = path.nodes.findIndex((candidate) => candidate.id === item.nodeId);
          return previousIndex > -1 && previousIndex < index;
        });
        const existing = loggedByNodeId.get(node.id);
        const baseDecision = decideNodeResourcePlan({
          node: buildNodeDecisionContext(node, index, path.nodes.length),
          profile: profile.dimensions,
          existingResources: override ? [] : node.resources,
          priorFeedback,
          constraints: {
            allowLLM: false,
            allowPPT: true,
            latencyBudgetMs: 200,
            forceInclude: override?.selectedTypes,
            forceExclude: override
              ? (['document', 'mindmap', 'quiz', 'video', 'code', 'reading', 'ppt'] as ResourceType[]).filter(
                  (type) => !override.selectedTypes.includes(type),
                )
              : undefined,
          },
        });

        if (existing) {
          return [node.id, existing];
        }

        return [node.id, baseDecision];
      }),
    ) as Record<string, ResourceDecisionResultV2>;
  }, [currentSessionId, decisionLogsBySession, feedbackBySession, overridesBySession, path, profile]);

  useEffect(() => {
    if (!isProfileComplete(profile?.dimensions ?? null)) {
      router.replace('/profile');
    }
  }, [profile, router]);

  useEffect(() => {
    setSelectedResource(null);
    hasAutoPlanned.current = false;

    if (currentSessionId) {
      loadPathForSession(currentSessionId);
      loadResourcesForSession(currentSessionId);
      return;
    }

    setPath(null);
  }, [currentSessionId, loadPathForSession, loadResourcesForSession, setPath]);

  useEffect(() => {
    if (!profile) return;

    const currentSession = currentSessionId ? getCurrentSession() : null;
    const dimensions = profile.dimensions;
    const goal =
      dimensions.learningGoals.shortTerm?.join('；') ||
      dimensions.learningGoals.longTerm ||
      dimensions.knowledgeBase.subjects.map((subject) => subject.name).join('、');

    if (!currentSession || currentSession.profileId !== profile.id) {
      createSession(profile.id, goal);
      lastProfileIdRef.current = profile.id;
      return;
    }

    lastProfileIdRef.current = profile.id;
  }, [profile, currentSessionId, createSession, getCurrentSession]);

  const findNodeIdByResourceId = (resourceId: string) => {
    return path?.nodes.find((node) => node.resources.some((resource) => resource.resourceId === resourceId))?.id ?? null;
  };

  useEffect(() => {
    const previousResource = lastSelectedResourceRef.current;
    const openedAt = selectedResourceOpenedAtRef.current;

    if (previousResource && openedAt && currentSessionId) {
      const previousNodeId = findNodeIdByResourceId(previousResource.id);
      if (previousNodeId) {
        recordResourceView(currentSessionId, previousNodeId, previousResource.type, Date.now() - openedAt);
      }
    }

    lastSelectedResourceRef.current = selectedResource;
    selectedResourceOpenedAtRef.current = selectedResource ? Date.now() : null;
  }, [currentSessionId, path, recordResourceView, selectedResource]);

  const updateNodeResource = useCallback((nodeId: string, resource: Resource) => {
    const sessionId = useSessionsStore.getState().currentSessionId;
    useLearningPathStore.setState((state) => {
      if (!state.path) return {};

      let changed = false;
      const nextNodes = state.path.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        if (node.resources.some((item) => item.resourceId === resource.id)) {
          return node;
        }

        if (node.resources.some((item) => item.type === resource.type)) {
          return node;
        }

        changed = true;
        return {
          ...node,
          resources: [
            ...node.resources,
            {
              resourceId: resource.id,
              type: resource.type,
              title: resource.title,
            },
          ],
        };
      });

      if (!changed) return {};

      const nextPath = { ...state.path, nodes: nextNodes };
      return {
        path: nextPath,
        storedPaths: sessionId ? { ...state.storedPaths, [sessionId]: nextPath } : state.storedPaths,
      };
    });
  }, []);

  const removeNodeResources = useCallback((nodeId: string) => {
    const sessionId = useSessionsStore.getState().currentSessionId;
    const currentPath = useLearningPathStore.getState().path;
    const targetNode = currentPath?.nodes.find((node) => node.id === nodeId);
    if (!targetNode) return;

    for (const resource of targetNode.resources) {
      removeResource(resource.resourceId);
    }

    useLearningPathStore.setState((state) => {
      if (!state.path) return {};
      const nextNodes = state.path.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, resources: [], quizId: undefined }
          : node,
      );
      const nextPath = { ...state.path, nodes: nextNodes };
      return {
        path: nextPath,
        storedPaths: sessionId ? { ...state.storedPaths, [sessionId]: nextPath } : state.storedPaths,
      };
    });

    setSelectedResource((current) => {
      if (!current) return current;
      return targetNode.resources.some((item) => item.resourceId === current.id) ? null : current;
    });
  }, [removeResource]);

  const parseResourceSSE = useCallback(
    async (response: Response, nodeId: string, generationVersion: number) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        if (generationVersionByNodeRef.current.get(nodeId) !== generationVersion) {
          await reader.cancel().catch(() => undefined);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          if (generationVersionByNodeRef.current.get(nodeId) !== generationVersion) {
            await reader.cancel().catch(() => undefined);
            return;
          }

          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'resource_delta' && data.resource) {
              addResource(data.resource);
              updateNodeResource(nodeId, data.resource);
            }
          } catch {
          }
        }
      }
    },
    [addResource, updateNodeResource],
  );

  const parsePPTSSE = useCallback(
    async (response: Response, nodeId: string, generationVersion: number) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        if (generationVersionByNodeRef.current.get(nodeId) !== generationVersion) {
          await reader.cancel().catch(() => undefined);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          if (generationVersionByNodeRef.current.get(nodeId) !== generationVersion) {
            await reader.cancel().catch(() => undefined);
            return;
          }

          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'generation_complete' && data.scenes) {
              const currentPath = useLearningPathStore.getState().path;
              const nodeTitle = currentPath?.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
              const pptResource: Resource = {
                id: crypto.randomUUID(),
                userId: 'current',
                type: 'ppt',
                title: `${nodeTitle} - 动态课件`,
                content: JSON.stringify(data.scenes),
                sourceAgent: 'ppt',
                status: 'ready',
                createdAt: new Date().toISOString(),
                metadata: { pptData: data.scenes },
              };
              addResource(pptResource);
              updateNodeResource(nodeId, pptResource);
            }
          } catch {
          }
        }
      }
    },
    [addResource, updateNodeResource],
  );

  const generateNodeResources = useCallback(
    async (node: LearningPathNode, forcedTypes?: ResourceType[]) => {
      if (!profile || !currentSessionId) return;

      generatingNodeSetRef.current.add(node.id);
      setGeneratingNodes((prev) => new Set(prev).add(node.id));

      try {
        const nextGenerationVersion = (generationVersionByNodeRef.current.get(node.id) ?? 0) + 1;
        generationVersionByNodeRef.current.set(node.id, nextGenerationVersion);

        activeAbortControllersRef.current.get(node.id)?.abort();
        const abortController = new AbortController();
        activeAbortControllersRef.current.set(node.id, abortController);

        const nodeIndex = path?.nodes.findIndex((item) => item.id === node.id) ?? -1;
        const sessionOverrides = useResourceDecisionsStore.getState().overridesBySession[currentSessionId] ?? {};
        const storedOverride = sessionOverrides[node.id];
        const effectiveSelectedTypes = forcedTypes && forcedTypes.length > 0
          ? forcedTypes
          : storedOverride?.selectedTypes;
        const decisionInput = {
          node: buildNodeDecisionContext(node, Math.max(nodeIndex, 0), path?.nodes.length ?? 1),
          profile: profile.dimensions,
          existingResources: node.resources,
          constraints: {
            allowLLM: true,
            allowPPT: true,
            latencyBudgetMs: 2200,
            llmTimeoutMs: 8000,
            forceInclude: effectiveSelectedTypes,
            forceExclude: effectiveSelectedTypes
              ? ALL_RESOURCE_TYPES.filter((type) => !effectiveSelectedTypes.includes(type))
              : undefined,
          },
        };

        let decision: ResourceDecisionResultV2;
        if (effectiveSelectedTypes) {
          decision = decideNodeResourcePlan({
            ...decisionInput,
            existingResources: [],
            constraints: {
              ...decisionInput.constraints,
              allowLLM: false,
            },
          });
        } else {
          try {
            const response = await fetch('/api/resource-decision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                decisionInput,
                aiConfig: { providerId, modelId, apiKey, baseUrl },
              }),
            });

            if (!response.ok) {
              throw new Error(`resource decision failed: ${response.status}`);
            }

            decision = (await response.json()) as ResourceDecisionResultV2;
          } catch (error) {
            console.warn('Enhanced resource decision failed, fallback to local rules', error);
            decision = decideNodeResourcePlan({
              ...decisionInput,
              constraints: {
                ...decisionInput.constraints,
                allowLLM: false,
              },
            });
          }
        }

        addDecisionLog({
          sessionId: currentSessionId,
          nodeId: node.id,
          createdAt: new Date().toISOString(),
          result: decision,
        });

        if (decision.execution.resourceTypes.length === 0 && !decision.execution.shouldGeneratePPT) {
          return;
        }

        const resourcesPromise = fetch('/api/generate/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            knowledgePoints: node.knowledgePoints,
            resourceTypes: decision.execution.resourceTypes,
            profile: profile.dimensions,
            aiConfig: { providerId, modelId, apiKey, baseUrl },
          }),
          signal: abortController.signal,
        });

        const pptPromise = decision.execution.shouldGeneratePPT
          ? fetch('/api/generate/ppt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requirement: `讲解：${node.knowledgePoints.join('、')}`,
                language: 'zh-CN',
                aiConfig: { providerId, modelId, apiKey, baseUrl },
                enableImageGeneration: generatePptImages,
                includeInteractive: true,
              }),
              signal: abortController.signal,
            })
          : Promise.resolve(null);

        const [resourcesResponse, pptResponse] = await Promise.all([resourcesPromise, pptPromise]);
        await Promise.all([
          parseResourceSSE(resourcesResponse, node.id, nextGenerationVersion),
          pptResponse ? parsePPTSSE(pptResponse, node.id, nextGenerationVersion) : Promise.resolve(),
        ]);
      } catch (error) {
        console.error(`Failed to generate resources for node ${node.id}:`, error);
      } finally {
        activeAbortControllersRef.current.delete(node.id);
        generatingNodeSetRef.current.delete(node.id);
        setGeneratingNodes((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    [addDecisionLog, apiKey, baseUrl, currentSessionId, generatePptImages, modelId, parsePPTSSE, parseResourceSSE, path, profile, providerId],
  );

  const autoPlanPath = useCallback(
    async (goal: string) => {
      if (!profile) return;

      setPlanning(true);
      try {
        const response = await fetch('/api/path/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal,
            profile: profile.dimensions,
            aiConfig: { providerId, modelId, apiKey, baseUrl },
          }),
        });

        const reader = response.body?.getReader();
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

            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'path_update' && data.path) {
                setPath(normalizePlannedPath(data.path as LearningPath));
              }
            } catch {
            }
          }
        }
      } catch (error) {
        console.error('Path planning error:', error);
      } finally {
        setPlanning(false);
      }
    },
    [apiKey, baseUrl, modelId, profile, providerId, setPath, setPlanning],
  );

  useEffect(() => {
    if (!profile || !currentSessionId || path || isPlanning || hasAutoPlanned.current) {
      return;
    }

    const currentSession = getCurrentSession();
    if (!currentSession) return;

    const storedPath = storedPaths[currentSessionId];
    if (storedPath) {
      hasAutoPlanned.current = true;
      loadPathForSession(currentSessionId);
      return;
    }

    hasAutoPlanned.current = true;
    autoPlanPath(currentSession.goal);
  }, [
    autoPlanPath,
    currentSessionId,
    getCurrentSession,
    isPlanning,
    loadPathForSession,
    path,
    profile,
    storedPaths,
  ]);

  useEffect(() => {
    if (!currentSessionId || !path || isGeneratingRef.current) return;

    const nextNode = path.nodes
      .filter((node) => node.status === 'in_progress')
      .filter((node) => node.resources.length === 0)
      .filter((node) => !generatingNodeSetRef.current.has(node.id))
      .sort((left, right) => getNodeOrder(path, left.id) - getNodeOrder(path, right.id))[0];

    if (!nextNode) return;

    isGeneratingRef.current = true;
    generateNodeResources(nextNode).finally(() => {
      isGeneratingRef.current = false;
    });
  }, [currentSessionId, generateNodeResources, path]);

  const handleSuggestionSelection = useCallback(
    async (nodeId: string, selectedTypes: ResourceType[]) => {
      if (!currentSessionId || !path) return;

      const normalizedTypes = Array.from(new Set(selectedTypes));
      const node = path.nodes.find((item) => item.id === nodeId);
      if (!node) return;

      if (normalizedTypes.length === 0) {
        clearNodeOverride(currentSessionId, nodeId);
        removeNodeResources(nodeId);
        return;
      }

      setNodeOverride(currentSessionId, nodeId, normalizedTypes);
      removeNodeResources(nodeId);
      await generateNodeResources({ ...node, resources: [] }, normalizedTypes);
    },
    [clearNodeOverride, currentSessionId, generateNodeResources, path, removeNodeResources, setNodeOverride],
  );

  const handleResourceSelection = useCallback(
    (resource: Resource) => {
      setSelectedResource(resource);
      if (!currentSessionId) return;
      const nodeId = findNodeIdByResourceId(resource.id);
      if (!nodeId) return;
      recordResourceClick(currentSessionId, nodeId, resource.type);
    },
    [currentSessionId, findNodeIdByResourceId, recordResourceClick],
  );

  const handleQuizResult = useCallback(
    (resource: Resource, result: { score: number; completed: boolean }) => {
      if (!currentSessionId) return;
      const nodeId = findNodeIdByResourceId(resource.id);
      if (!nodeId) return;
      recordQuizResult(currentSessionId, nodeId, result.score, result.completed);
    },
    [currentSessionId, findNodeIdByResourceId, recordQuizResult],
  );

  const handleNodeComplete = useCallback(
    (nodeId: string) => {
      updateNodeStatus(nodeId, 'completed');
    },
    [updateNodeStatus],
  );

  return (
    <div className="flex h-screen flex-col">
      <WorkspaceHeader profile={profile} />
      <div className="flex flex-1 overflow-hidden">
        <LearningPathPanel
          path={path}
          generatingNodes={generatingNodes}
          decisionSuggestionsByNodeId={decisionSuggestionsByNodeId}
          onSuggestionSelection={handleSuggestionSelection}
          onSelectResource={handleResourceSelection}
          onNodeComplete={handleNodeComplete}
        />
        <div className="flex-1 overflow-auto border-x">
          <ResourceViewer resource={selectedResource} onQuizResult={handleQuizResult} />
        </div>
        <TutorChatPanel selectedResource={selectedResource} />
      </div>
    </div>
  );
}
