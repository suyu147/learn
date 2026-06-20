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

export async function generateResourcesNode(
  state: LearningStateType,
  config: { configurable?: { writer?: (event: LearnEvent) => void } },
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
              id: crypto.randomUUID(), userId: 'current', type: type as ResourceType, title: generated.title, content: generated.content,
              sourceAgent: type, status: 'ready', createdAt: new Date().toISOString(), metadata: { knowledgePoints: node.knowledgePoints, profileUsed: true, ...generated.metadata },
            };
            write({ type: 'resource_delta', resource });
            write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'completed', resourceType: type as ResourceType });
            return resource;
          } catch (_err) {
            write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'failed', resourceType: type as ResourceType });
            const fallbackResource: Resource = {
              id: crypto.randomUUID(), userId: 'current', type: type as ResourceType, title: `${node.knowledgePoints.join('、')} - ${type}（生成失败）`,
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
      pptScenes = await generatePptScenes(`讲解：${node.knowledgePoints.join('、')}`, state.aiConfig, true, true);
      if (pptScenes.length > 0) write({ type: 'ppt_ready', scenes: pptScenes });
    }

    const path = {
      id: state.sessionId,
      userId: 'current',
      goal: state.goal,
      nodes: [...state.completedNodes, { ...node, resources: generatedResources.map((resource) => ({ resourceId: resource.id, type: resource.type, title: resource.title })) }],
      edges: state.completedNodes.length > 0 ? [{ from: state.completedNodes[state.completedNodes.length - 1].id, to: node.id }] : [],
      estimatedDays: Math.max(1, state.completedNodes.length + 1),
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
