'use client';

import { useLearningPathStore } from '@/lib/store/learning-path';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
  ChevronRight,
  FileText,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import type { PathNodeStatus } from '@/lib/types/learning-path';
import { RESOURCE_TYPE_LABELS, type ResourceType } from '@/lib/types/resource';
import type { ResourceDecisionResultV2 } from '@/lib/generation/resource-decision';

const DECISION_TYPES: ResourceType[] = ['document', 'mindmap', 'quiz', 'video', 'code', 'reading', 'ppt'];

const statusConfig: Record<PathNodeStatus, { icon: React.ElementType; color: string; label: string }> = {
  locked: { icon: Lock, color: 'text-muted-foreground', label: '未解锁' },
  available: { icon: Circle, color: 'text-blue-500', label: '可学习' },
  in_progress: { icon: PlayCircle, color: 'text-amber-500', label: '学习中' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: '已完成' },
};

interface PathTimelineProps {
  onClickResource?: (resourceId: string) => void;
  generatingNodes?: Set<string>;
  decisionSuggestionsByNodeId?: Record<string, ResourceDecisionResultV2>;
  onSuggestionSelection?: (nodeId: string, selectedTypes: ResourceType[]) => void;
  onNodeComplete?: (nodeId: string) => void;
}

export function PathTimeline({
  onClickResource,
  generatingNodes,
  decisionSuggestionsByNodeId,
  onSuggestionSelection,
  onNodeComplete,
}: PathTimelineProps) {
  const { path, updateNodeStatus } = useLearningPathStore();

  if (!path) return null;

  // 通过resourceId查找Resource引用
  function handleResourceClick(e: React.MouseEvent, resourceId: string) {
    e.preventDefault();
    e.stopPropagation();
    onClickResource?.(resourceId);
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">学习路径：{path.goal}</h2>
        <Badge variant="secondary">预计 {path.estimatedDays} 天</Badge>
      </div>

      <div className="relative space-y-3">
        {path.nodes.map((node, index) => {
          const config = statusConfig[node.status];
          const Icon = config.icon;
          const suggestion = decisionSuggestionsByNodeId?.[node.id];
          const suggestedTypes = suggestion?.items.filter((item) => item.action === 'generate').map((item) => item.type) ?? [];
          const skippedItems = suggestion?.items.filter((item) => item.action !== 'generate') ?? [];
          const selectedSuggestionTypes = new Set(suggestedTypes);
          const isGenerating = generatingNodes?.has(node.id);

          return (
            <div key={node.id} className="relative">
              {index < path.nodes.length - 1 && (
                <div className="absolute left-[19px] top-10 h-[calc(100%-8px)] w-0.5 bg-border" />
              )}

              <Card
                className={`transition-all ${
                  node.status === 'available' || node.status === 'in_progress'
                    ? 'hover:shadow-md cursor-pointer'
                    : node.status === 'locked'
                      ? 'opacity-60'
                      : ''
                }`}
                onClick={() => {
                  if (node.status === 'available') {
                    updateNodeStatus(node.id, 'in_progress');
                  }
                }}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{node.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                      {suggestion && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Sparkles className="h-3 w-3" />
                              Agent 建议
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="font-medium">建议生成</p>
                                <p className="mt-1 text-muted-foreground">
                                  {suggestedTypes.length > 0
                                    ? suggestedTypes.map((type) => RESOURCE_TYPE_LABELS[type]).join('、')
                                    : '本节点当前没有推荐生成的普通资源'}
                                </p>
                              </div>
                              {onSuggestionSelection && (
                                <div>
                                  <p className="font-medium">手动调整</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {DECISION_TYPES.map((type) => {
                                      const selected = selectedSuggestionTypes.has(type);
                                      return (
                                        <button
                                          key={`${node.id}-toggle-${type}`}
                                          type="button"
                                          className={`rounded-full border px-2 py-1 text-xs transition-colors ${
                                            selected
                                              ? 'border-primary bg-primary/10 text-primary'
                                              : 'border-border text-muted-foreground hover:bg-accent'
                                          }`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            const nextTypes = selected
                                              ? suggestedTypes.filter((item) => item !== type)
                                              : [...suggestedTypes, type];
                                            onSuggestionSelection(node.id, nextTypes);
                                          }}
                                        >
                                          {RESOURCE_TYPE_LABELS[type]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {skippedItems.length > 0 && (
                                <div>
                                  <p className="font-medium">跳过项</p>
                                  <div className="mt-1 space-y-1 text-muted-foreground">
                                    {skippedItems.map((item) => (
                                      <p key={`${node.id}-${item.type}`}>{RESOURCE_TYPE_LABELS[item.type]}：{item.reason}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className="font-medium">决策轨迹</p>
                                <p className="mt-1 text-muted-foreground">
                                  {suggestion.trace.rulesApplied.join('、') || '默认规则'}
                                </p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {node.knowledgePoints.map((kp, i) => (
                        <Badge key={kp || `kp-${i}`} variant="secondary" className="text-xs">
                          {kp}
                        </Badge>
                      ))}
                    </div>
                    {suggestedTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {suggestedTypes.map((type) => (
                          <Badge key={`${node.id}-suggestion-${type}`} variant="outline" className="text-[11px]">
                            建议：{RESOURCE_TYPE_LABELS[type]}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {node.resources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.resources.map((res, i) => (
                          <button
                            key={res.resourceId || `res-${i}`}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                'application/x-smartlearn-resource',
                                JSON.stringify({ resourceId: res.resourceId }),
                              );
                              event.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={(e) => handleResourceClick(e, res.resourceId)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <FileText className="h-3 w-3" />
                            {RESOURCE_TYPE_LABELS[res.type as ResourceType] || res.type}
                            <span className="max-w-[120px] truncate">{res.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {node.quizId && (
                      <div className="mt-1">
                        <button
                          onClick={(e) => handleResourceClick(e, node.quizId!)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
                        >
                          <HelpCircle className="h-3 w-3" />
                          练习测验
                        </button>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>预计 {node.estimatedMinutes} 分钟</span>
                      <span>{node.resources.length} 个资源</span>
                      {isGenerating && <span className="text-primary">Agent 生成中</span>}
                      {node.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNodeComplete?.(node.id);
                            if (!onNodeComplete) {
                              updateNodeStatus(node.id, 'completed');
                            }
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          标记完成
                        </Button>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
