'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  GitBranch,
  CheckSquare,
  Play,
  Code,
  BookOpen,
  Presentation,
  Search,
  X,
} from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useResourcesStore } from '@/lib/store/resources';
import type { Resource, ResourceType } from '@/lib/types/resource';
import { RESOURCE_TYPE_LABELS } from '@/lib/types/resource';
import { cn } from '@/lib/utils';

const ALL_TYPES: ResourceType[] = ['document', 'mindmap', 'quiz', 'video', 'code', 'reading', 'ppt'];

const ICON_MAP: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  mindmap: GitBranch,
  quiz: CheckSquare,
  video: Play,
  code: Code,
  reading: BookOpen,
  ppt: Presentation,
};

const TYPE_COLORS: Record<ResourceType, string> = {
  document: 'text-blue-500 bg-blue-50',
  mindmap: 'text-emerald-500 bg-emerald-50',
  quiz: 'text-amber-500 bg-amber-50',
  video: 'text-purple-500 bg-purple-50',
  code: 'text-cyan-500 bg-cyan-50',
  reading: 'text-orange-500 bg-orange-50',
  ppt: 'text-pink-500 bg-pink-50',
};

type FilterTab = 'all' | ResourceType;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  ...ALL_TYPES.map((t) => ({ key: t, label: RESOURCE_TYPE_LABELS[t] })),
];

export default function ResourceLibraryPage() {
  const resources = useResourcesStore((s) => s.resources);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  const filtered = useMemo(() => {
    let list = resources;
    if (activeTab !== 'all') {
      list = list.filter((r) => r.type === activeTab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.sourceAgent.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [resources, activeTab, search]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resources.length };
    for (const r of resources) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  }, [resources]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <div className="container flex-1 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">资源库</h1>
          <p className="text-sm text-muted-foreground">
            共 {resources.length} 个学习资源
          </p>
        </div>

        {/* 筛选栏 */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {tab.label}
                {typeCounts[tab.key] != null && typeCounts[tab.key] > 0 && (
                  <span className="ml-1.5 opacity-70">({typeCounts[tab.key]})</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索资源..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 资源卡片网格 */}
        {filtered.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => {
              const Icon = ICON_MAP[resource.type];
              const isFailed = resource.status === 'failed';
              return (
                <div
                  key={resource.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewResource(resource)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreviewResource(resource); }}
                  className={cn(
                    'group relative rounded-lg border bg-card p-4 transition-all cursor-pointer select-none',
                    'hover:border-primary/30 hover:shadow-sm',
                    isFailed && 'border-red-300 bg-red-50/30',
                  )}
                >
                  {/* 失败标记 */}
                  {isFailed && (
                    <Badge variant="destructive" className="absolute right-3 top-3 text-[10px] px-1.5 py-0">
                      生成失败
                    </Badge>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TYPE_COLORS[resource.type])}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium truncate group-hover:text-primary">
                        {resource.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{RESOURCE_TYPE_LABELS[resource.type]}</span>
                        <span>·</span>
                        <span>{resource.sourceAgent}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(resource.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground">
            <Search className="h-10 w-10 opacity-30" />
            <p className="mt-3 text-sm">
              {search ? '没有找到匹配的资源' : '暂无资源'}
            </p>
            <p className="mt-1 text-xs">
              {search ? '尝试其他关键词' : '开始学习后，生成的资源将出现在这里'}
            </p>
          </div>
        )}
      </div>

      {/* 资源预览弹窗 */}
      <Dialog open={previewResource !== null} onOpenChange={(open) => { if (!open) setPreviewResource(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewResource && (() => {
                const Icon = ICON_MAP[previewResource.type];
                return <Icon className={cn('h-5 w-5', TYPE_COLORS[previewResource.type].split(' ')[0])} />;
              })()}
              {previewResource?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {previewResource && RESOURCE_TYPE_LABELS[previewResource.type]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {previewResource?.sourceAgent}
              </span>
              <span className="text-xs text-muted-foreground">
                {previewResource && new Date(previewResource.createdAt).toLocaleString('zh-CN')}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-md border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words text-xs font-mono leading-relaxed">
              {previewResource?.content ?? ''}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
