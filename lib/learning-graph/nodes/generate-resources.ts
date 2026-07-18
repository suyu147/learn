import type { Resource, ResourceType } from '@/lib/types/resource';
import type { LearnEvent } from '../types';
import type { LearningStateType } from '../state';
import { generateResource } from '../helpers/resource-generators';
import { generatePptScenes } from '../helpers/ppt-generator';
import { useSettingsStore } from '@/lib/store/settings';

const AGENT_NAMES: Record<string, string> = {
  document: '文档Agent', mindmap: '思维导图Agent', quiz: '题库Agent',
  video: '视频Agent', code: '代码Agent', reading: '拓展阅读Agent', ppt: '课件Agent',
};

const MAX_CONCURRENCY = 3;

function getWriter(config: { configurable?: { writer?: (event: LearnEvent) => void } }) {
  return config.configurable?.writer ?? (() => undefined);
}

function getUserId(config: { configurable?: { userId?: string } }): string {
  return config.configurable?.userId ?? 'anonymous';
}

export async function generateResourcesNode(
  state: LearningStateType,
  config: { configurable?: { writer?: (event: LearnEvent) => void; userId?: string } },
) {
  const write = getWriter(config);
  const node = state.currentNode;
  const resourcePlan = state.resourcePlan;
  if (!node || !resourcePlan) return { phase: 'generate' };
  write({ type: 'phase_start', phase: 'generate' });

  try {
    // 分批并行生成，每批最多 MAX_CONCURRENCY 个
    const types = resourcePlan.execution.resourceTypes;
    const disabledAgentIds = typeof window !== 'undefined' ? useSettingsStore.getState().disabledAgentIds ?? [] : [];
    const enabledTypes = types.filter((type) => !disabledAgentIds.includes(type));
    const generatedResources: Resource[] = [];
    for (let i = 0; i < enabledTypes.length; i += MAX_CONCURRENCY) {
      const batch = enabledTypes.slice(i, i + MAX_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (type) => {
          write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'running', resourceType: type as ResourceType });
          try {
            const generated = await generateResource(type, node.knowledgePoints, state.profile, state.aiConfig);
            const resource: Resource = {
              id: crypto.randomUUID(), userId: getUserId(config), type: type as ResourceType, title: generated.title, content: generated.content,
              sourceAgent: type, status: 'ready', createdAt: new Date().toISOString(), metadata: { knowledgePoints: node.knowledgePoints, profileUsed: true, ...generated.metadata },
            };
            write({ type: 'resource_delta', resource });
            write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'completed', resourceType: type as ResourceType });
            return resource;
          } catch (_err) {
            write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'failed', resourceType: type as ResourceType });
            const fallbackResource: Resource = {
              id: crypto.randomUUID(), userId: getUserId(config), type: type as ResourceType, title: `${node.knowledgePoints.join('、')} - ${type}（生成失败）`,
              content: '资源生成失败，请重试', sourceAgent: type, status: 'failed',
              createdAt: new Date().toISOString(), metadata: { knowledgePoints: node.knowledgePoints, error: true },
            };
            write({ type: 'resource_delta', resource: fallbackResource });
            return fallbackResource;
          }
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          generatedResources.push(result.value);
        }
      }
    }

    let pptScenes = null;
    if (resourcePlan.execution.shouldGeneratePPT && !disabledAgentIds.includes('ppt')) {
      write({ type: 'agent_status', agentId: 'ppt', agentName: AGENT_NAMES.ppt, status: 'running', resourceType: 'ppt' as ResourceType });
      try {
        pptScenes = await generatePptScenes(`讲解：${node.knowledgePoints.join('、')}`, state.aiConfig, true, true, node.knowledgePoints);
        if (pptScenes.length > 0) {
          write({ type: 'ppt_ready', scenes: pptScenes, nodeId: node.id, userId: getUserId(config), knowledgePoints: node.knowledgePoints });
          // Wrap PPT scenes as a Resource so the frontend can find and render it
          const pptResource: Resource = {
            id: crypto.randomUUID(),
            userId: getUserId(config),
            type: 'ppt',
            title: `${node.knowledgePoints.join('、')} - 动态课件`,
            content: `PPT课件：共${pptScenes.length}页`,
            sourceAgent: 'ppt',
            status: 'ready',
            createdAt: new Date().toISOString(),
            metadata: {
              knowledgePoints: node.knowledgePoints,
              profileUsed: true,
              pptData: pptScenes,
            },
          };
          write({ type: 'resource_delta', resource: pptResource });
          generatedResources.push(pptResource);
          write({ type: 'agent_status', agentId: 'ppt', agentName: AGENT_NAMES.ppt, status: 'completed', resourceType: 'ppt' as ResourceType });
        }
      } catch (_err) {
        write({ type: 'agent_status', agentId: 'ppt', agentName: AGENT_NAMES.ppt, status: 'failed', resourceType: 'ppt' as ResourceType });
      }
    }

    // Build the full node list: all completed nodes + the current node with resource refs
    const nodeWithResources = { ...node, resources: generatedResources.map((resource) => ({ resourceId: resource.id, type: resource.type, title: resource.title })) }
    const allNodes = [...state.completedNodes, nodeWithResources]

    // Build edges: link each completed node to its successor, plus edge from last completed to current
    const allEdges: { from: string; to: string }[] = []
    for (let i = 0; i < state.completedNodes.length - 1; i++) {
      allEdges.push({ from: state.completedNodes[i].id, to: state.completedNodes[i + 1].id })
    }
    if (state.completedNodes.length > 0) {
      allEdges.push({ from: state.completedNodes[state.completedNodes.length - 1].id, to: node.id })
    }

    const path = {
      id: state.sessionId,
      userId: getUserId(config),
      goal: state.goal,
      nodes: allNodes,
      edges: allEdges,
      estimatedDays: Math.max(1, allNodes.length),
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    write({ type: 'path_update', path });
    write({ type: 'phase_end', phase: 'generate' });
    return { generatedResources, pptScenes, phase: 'generate' };
  } catch (error) {
    write({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    write({ type: 'phase_end', phase: 'generate' });
    return { phase: 'generate' };
  }
}
