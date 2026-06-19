# 视频资源改造方案：从 LLM 分镜脚本 → 知识库+B站视频匹配播放

## 一、改造目标

将当前视频资源从 **LLM 生成文本分镜脚本** 改为 **自动匹配本地知识库和 B 站等视频网站的真实视频**，返回视频链接，并内嵌网页视频播放器，点击即可弹出观看。

---

## 二、当前架构分析（需改造的部分）

| 层级 | 当前实现 | 文件 |
|------|---------|------|
| 资源决策 | `VIDEO_KEYWORDS` 规则匹配 → 决定是否生成 video 类型 | `lib/generation/resource-decision.ts` |
| 生成 API | `generateDefaultResource('video')` → LLM 生成分镜脚本 → `parseVideoScript()` | `app/api/generate/resources/route.ts` |
| 数据模型 | `VideoGenerationResult`（scenes/narration/style） | `lib/video/generate.ts` |
| 类型定义 | `Resource.metadata.videoData` 存储 `VideoGenerationResult` | `lib/types/resource.ts` |
| 前端展示 | `VideoPlayer` 组件渲染分镜时间轴+场景卡片 | `components/resources/video-player.tsx` |
| Prompt | `resource-prompts.json` 的 video prompt 要求 LLM 输出6片段分镜 | `lib/prompts/resource-prompts.json` |

---

## 三、改造后的目标架构

```
用户进入 Workspace
  → 系统检测 in_progress 节点
  → 资源决策（video 类型命中）
  → 调用 /api/generate/resources (type=video)
  → 【新】调用 /api/video/search 搜索匹配视频
    → 1. 本地知识库搜索（向量/关键词匹配）
    → 2. B站等外部视频网站搜索（API/爬虫）
  → 返回 VideoSearchResult（视频列表 + 链接 + 封面 + 匹配度）
  → SSE 流式返回 Resource（metadata.videoData = VideoSearchResult）
  → 【新】VideoPlayer 组件渲染视频卡片列表
  → 点击视频 → 弹出内嵌播放器（iframe / 弹窗）
```

---

## 四、需改造的模块清单

### 4.1 数据模型层

#### 4.1.1 新增 `VideoSearchResult` 类型

**文件**: `lib/types/resource.ts`

```typescript
// 新增：视频搜索结果类型
export interface VideoSource {
  id: string;                    // 视频唯一标识
  title: string;                 // 视频标题
  description: string;           // 视频描述
  url: string;                   // 视频页链接
  embedUrl?: string;             // 可嵌入的播放链接（如B站player嵌入地址）
  coverImageUrl: string;         // 封面图
  duration?: string;             // 时长（如 "12:30"）
  author?: string;               // UP主/作者
  authorAvatar?: string;         // 作者头像
  viewCount?: number;            // 播放量
  platform: 'bilibili' | 'youtube' | 'local' | 'other';  // 来源平台
  publishedAt?: string;          // 发布时间
  relevanceScore?: number;       // 与知识点的匹配度 (0-1)
  matchedKeywords?: string[];    // 命中的关键词
  tags?: string[];               // 视频标签
}

export interface VideoSearchResult {
  format: 'video_search_v1';
  query: string;                 // 搜索查询词
  knowledgePoints: string[];     // 关联的知识点
  videos: VideoSource[];         // 匹配的视频列表
  totalFound: number;            // 总匹配数
  searchSources: string[];       // 搜索来源（如 ['local', 'bilibili']）
}
```

#### 4.1.2 修改 `Resource.metadata` 类型

**文件**: `lib/types/resource.ts`

```typescript
// metadata 中 videoData 字段类型从 VideoGenerationResult 改为 VideoSearchResult
metadata?: {
  // ... 其他字段保持不变
  videoData?: VideoSearchResult;  // 原来是 VideoGenerationResult
};
```

---

### 4.2 视频搜索服务层（核心新增）

#### 4.2.1 本地知识库视频搜索

**新建文件**: `lib/video/local-search.ts`

功能：
- 从本地知识库（数据库/向量库）中搜索与知识点匹配的视频资源
- 支持关键词匹配和语义向量匹配
- 返回 `VideoSource[]`

需要考虑：
- 本地知识库的数据结构设计（视频元数据存储）
- 向量检索的接入方式（如使用项目已有的 embedding 能力）
- 本地视频的存储和访问方式（文件系统/OSS/本地URL）

```typescript
export interface LocalVideoRecord {
  id: string;
  title: string;
  description: string;
  filePath: string;           // 本地文件路径或URL
  coverImagePath?: string;
  duration?: number;
  tags: string[];
  knowledgePoints: string[];  // 关联知识点
  embedding?: number[];       // 向量嵌入（可选）
}

export async function searchLocalVideos(
  knowledgePoints: string[],
  options?: { maxResults?: number; minRelevance?: number }
): Promise<VideoSource[]> {
  // 1. 关键词匹配：在 knowledgePoints 字段中搜索
  // 2. 语义匹配：用知识点 embedding 与视频 embedding 计算相似度
  // 3. 合并去重，按相关度排序
  // 4. 返回 VideoSource[]
}
```

#### 4.2.2 B站视频搜索

**新建文件**: `lib/video/bilibili-search.ts`

功能：
- 调用 B站搜索 API 或爬取搜索结果
- 解析返回数据为 `VideoSource[]`
- 生成 B站嵌入播放链接

B站嵌入播放器 URL 格式：
```
https://player.bilibili.com/player.html?bvid={BV号}&autoplay=0&high_quality=1
```

需要考虑：
- B站 API 的认证方式（Cookie / 无需认证的公开接口）
- 搜索频率限制和反爬策略
- BV号/AV号的提取和转换
- 视频分P（多集）的处理

```typescript
export interface BilibiliSearchOptions {
  maxResults?: number;         // 最大返回数，默认 5
  order?: 'totalrank' | 'click' | 'pubdate';  // 排序方式
  duration?: number;           // 时长过滤（秒）
}

export async function searchBilibiliVideos(
  query: string,
  options?: BilibiliSearchOptions
): Promise<VideoSource[]> {
  // 1. 构建搜索请求（B站搜索API或网页爬取）
  // 2. 解析搜索结果
  // 3. 提取 BV号、标题、封面、时长、UP主、播放量
  // 4. 构建 embedUrl: https://player.bilibili.com/player.html?bvid={bvid}
  // 5. 返回 VideoSource[]
}

// BV号提取工具函数
export function extractBvid(url: string): string | null { ... }

// 构建嵌入播放链接
export function buildBilibiliEmbedUrl(bvid: string, page?: number): string {
  return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0&high_quality=1${page ? `&page=${page}` : ''}`;
}
```

#### 4.2.3 视频搜索聚合服务

**新建文件**: `lib/video/search-aggregator.ts`

功能：
- 聚合本地知识库和外部平台的搜索结果
- 统一去重、排序、截断
- 返回 `VideoSearchResult`

```typescript
export interface VideoSearchConfig {
  enableLocal: boolean;         // 是否启用本地知识库搜索
  enableBilibili: boolean;      // 是否启用B站搜索
  enableYouTube: boolean;       // 是否启用YouTube搜索（预留）
  maxResultsPerSource: number;  // 每个来源最大返回数
  maxTotalResults: number;      // 总最大返回数
  bilibiliOptions?: BilibiliSearchOptions;
}

export async function searchVideos(
  knowledgePoints: string[],
  config?: Partial<VideoSearchConfig>
): Promise<VideoSearchResult> {
  const defaultConfig: VideoSearchConfig = {
    enableLocal: true,
    enableBilibili: true,
    enableYouTube: false,
    maxResultsPerSource: 5,
    maxTotalResults: 10,
  };
  const mergedConfig = { ...defaultConfig, ...config };
  const query = knowledgePoints.join(' ');

  const searchPromises: Promise<VideoSource[]>[] = [];
  const searchSources: string[] = [];

  if (mergedConfig.enableLocal) {
    searchPromises.push(searchLocalVideos(knowledgePoints));
    searchSources.push('local');
  }
  if (mergedConfig.enableBilibili) {
    searchPromises.push(searchBilibiliVideos(query, mergedConfig.bilibiliOptions));
    searchSources.push('bilibili');
  }

  // 并行搜索，容错处理
  const results = await Promise.allSettled(searchPromises);
  const allVideos = results
    .filter((r): r is PromiseFulfilledResult<VideoSource[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // 去重（按URL）、排序（按relevanceScore）、截断
  const uniqueVideos = deduplicateAndSort(allVideos, mergedConfig.maxTotalResults);

  return {
    format: 'video_search_v1',
    query,
    knowledgePoints,
    videos: uniqueVideos,
    totalFound: allVideos.length,
    searchSources,
  };
}
```

---

### 4.3 API 路由层

#### 4.3.1 新增视频搜索 API

**新建文件**: `app/api/video/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchVideos } from '@/lib/video/search-aggregator';

export async function POST(request: NextRequest) {
  const { knowledgePoints, config } = await request.json();

  if (!knowledgePoints?.length) {
    return NextResponse.json({ error: 'knowledgePoints is required' }, { status: 400 });
  }

  try {
    const result = await searchVideos(knowledgePoints, config);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

#### 4.3.2 修改资源生成 API

**文件**: `app/api/generate/resources/route.ts`

修改 `generateDefaultResource` 函数中 `type === 'video'` 的分支：

```typescript
// 原来的逻辑（删除）：
// if (type === 'video') {
//   const { parseVideoScript } = await import('@/lib/video/generate');
//   metadata.videoData = parseVideoScript(content);
// }

// 新的逻辑：
if (type === 'video') {
  const { searchVideos } = await import('@/lib/video/search-aggregator');
  const videoSearchResult = await searchVideos(knowledgePoints);
  metadata.videoData = videoSearchResult;
  // content 改为存储搜索结果的 JSON 字符串
  content = JSON.stringify(videoSearchResult);
  title = `${knowledgePoints.join(', ')} - 推荐视频`;
}
```

---

### 4.4 前端展示层

#### 4.4.1 重写 VideoPlayer 组件

**文件**: `components/resources/video-player.tsx`

完全重写，从分镜脚本展示改为视频列表+内嵌播放器：

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Play, ExternalLink, Clock, Eye, User, Search } from 'lucide-react';
import type { VideoSearchResult, VideoSource } from '@/lib/types/resource';

export function VideoPlayer({
  content,
  title,
  videoData,
}: {
  content: string;
  title: string;
  videoData?: VideoSearchResult;
}) {
  const [selectedVideo, setSelectedVideo] = useState<VideoSource | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  // 解析视频搜索结果
  const parsed: VideoSearchResult = videoData
    || JSON.parse(content);

  const handlePlay = (video: VideoSource) => {
    setSelectedVideo(video);
    setPlayerOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          {title}
          <Badge variant="secondary">{parsed.videos.length} 个视频</Badge>
        </CardTitle>
        <div className="flex gap-1 flex-wrap">
          {parsed.searchSources.map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              <Search className="h-3 w-3 mr-1" />
              {s === 'bilibili' ? 'B站' : s === 'local' ? '本地知识库' : s}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {parsed.videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onPlay={() => handlePlay(video)}
          />
        ))}
      </CardContent>

      {/* 内嵌视频播放器弹窗 */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full">
            {selectedVideo?.embedUrl ? (
              <iframe
                src={selectedVideo.embedUrl}
                className="h-full w-full rounded-lg"
                allowFullScreen
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted rounded-lg">
                <p className="text-muted-foreground">该视频不支持内嵌播放</p>
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => window.open(selectedVideo?.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  在网站中打开
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function VideoCard({ video, onPlay }: { video: VideoSource; onPlay: () => void }) {
  const platformLabel = {
    bilibili: 'B站',
    youtube: 'YouTube',
    local: '本地',
    other: '其他',
  }[video.platform];

  return (
    <div
      className="flex gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onPlay}
    >
      {/* 封面缩略图 */}
      <div className="relative flex-shrink-0 w-40 aspect-video rounded overflow-hidden bg-muted">
        {video.coverImageUrl ? (
          <img src={video.coverImageUrl} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-xs text-white">
            {video.duration}
          </span>
        )}
      </div>

      {/* 视频信息 */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {video.author && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />{video.author}
            </span>
          )}
          {video.viewCount && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />{video.viewCount.toLocaleString()}
            </span>
          )}
          <Badge variant="outline" className="text-xs">{platformLabel}</Badge>
        </div>
        {video.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{video.description}</p>
        )}
        {video.matchedKeywords && video.matchedKeywords.length > 0 && (
          <div className="mt-1 flex gap-1 flex-wrap">
            {video.matchedKeywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 4.4.2 UI 组件依赖检查

需确认项目中已有 `Dialog` 组件（shadcn/ui），如果没有需安装：

```bash
npx shadcn@latest add dialog
```

---

### 4.5 资源决策层（可选调整）

**文件**: `lib/generation/resource-decision.ts`

当前 `VIDEO_KEYWORDS` 规则可保持不变，因为决策逻辑（是否需要视频）仍然适用。但可以考虑：

- 放宽视频生成的触发条件（因为现在是搜索真实视频而非 LLM 生成，成本更低）
- 新增更多视频友好的关键词（如"讲解"、"入门"、"教程"）

```typescript
// 可选：扩展 VIDEO_KEYWORDS
const VIDEO_KEYWORDS = [
  '操作', '演示', '实验', '安装', '配置', '部署', '搭建',
  '调试', '运行', '启动', '设置', '连接', '创建项目',
  '命令行', '终端', 'ide', '编辑器', '浏览器', '开发者工具',
  '实践', '动手', '实操', '项目实战', '案例', '示例',
  '流程', '步骤', '过程', '方法', '技巧',
  // 新增：更多适合视频学习的场景
  '讲解', '入门', '教程', '入门', '入门教程', '速成',
  '可视化', '动画', '图解', '手把手',
];
```

---

### 4.6 Prompt 层（可选调整）

**文件**: `lib/prompts/resource-prompts.json`

由于视频不再由 LLM 生成，`video` 类型的 prompt 可以：
- **方案A**：删除 video 的 prompt（不再需要）
- **方案B**：改为 LLM 辅助生成搜索关键词的 prompt（用 LLM 将知识点转化为更优的搜索词）

推荐方案B，让 LLM 根据知识点生成更精准的搜索查询词：

```json
{
  "video": "你是一个视频搜索关键词优化助手。请根据给定的知识点，生成最适合在视频网站（如B站）搜索教学视频的关键词组合。\n\n要求：\n- 输出JSON格式：{ \"searchQueries\": [\"关键词1\", \"关键词2\", ...] }\n- 生成3-5组搜索词，每组2-4个词\n- 包含中英文变体（如\"Python入门\"和\"Python tutorial\"）\n- 优先考虑教学、教程类关键词\n- 用```json代码块包裹"
}
```

---

### 4.7 配置层

#### 4.7.1 视频搜索配置

**新建文件**: `lib/video/config.ts`

```typescript
export interface VideoSearchConfig {
  // 本地知识库配置
  local: {
    enabled: boolean;
    dbPath?: string;              // 本地数据库路径
    vectorSearchEnabled: boolean; // 是否启用向量搜索
    maxResults: number;
  };
  // B站配置
  bilibili: {
    enabled: boolean;
    cookie?: string;              // B站Cookie（可选，用于提高搜索限额）
    maxResults: number;
    defaultOrder: 'totalrank' | 'click' | 'pubdate';
  };
  // 通用配置
  maxTotalResults: number;
  searchTimeout: number;          // 搜索超时（ms）
}

export const defaultVideoSearchConfig: VideoSearchConfig = {
  local: {
    enabled: true,
    vectorSearchEnabled: false,
    maxResults: 5,
  },
  bilibili: {
    enabled: true,
    maxResults: 5,
    defaultOrder: 'totalrank',
  },
  maxTotalResults: 10,
  searchTimeout: 10000,
};
```

#### 4.7.2 环境变量

**文件**: `.env.local`（新增）

```env
# 视频搜索配置
VIDEO_SEARCH_BILIBILI_ENABLED=true
VIDEO_SEARCH_BILIBILI_COOKIE=
VIDEO_SEARCH_LOCAL_ENABLED=true
VIDEO_SEARCH_LOCAL_DB_PATH=
VIDEO_SEARCH_MAX_RESULTS=10
```

---

### 4.8 本地知识库数据层（如需支持本地视频）

#### 4.8.1 数据库模型

**文件**: `prisma/schema.prisma`（新增模型）

```prisma
model LocalVideo {
  id          String   @id @default(cuid())
  title       String
  description String?
  filePath    String
  coverPath   String?
  duration    Int?
  author      String?
  platform    String   @default("local")
  tags        String?  // JSON array
  knowledgePoints String? // JSON array
  embedding   Bytes?   // 向量嵌入
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 4.8.2 本地视频管理 API（可选）

**新建文件**: `app/api/video/local/route.ts`

提供本地视频的 CRUD 接口，用于管理员上传和管理本地知识库视频。

---

## 五、B站搜索实现方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A. B站搜索API（非官方）** | 响应快、数据结构化 | 非官方接口可能变动、需Cookie | ★★★★ |
| **B. 网页爬取** | 不依赖API | 反爬风险、解析脆弱 | ★★ |
| **C. B站开放平台API** | 官方支持 | 需申请、功能有限 | ★★★ |
| **D. 第三方视频搜索聚合API** | 多平台统一 | 依赖第三方、可能收费 | ★★★ |

**推荐方案A**：使用 B站非官方搜索接口，关键端点：

```
GET https://api.bilibili.com/x/web-interface/search/type
参数: keyword={搜索词}&search_type=video&page=1&page_size=5
Header: Cookie={用户Cookie}（可选，无Cookie也可获取基础结果）
```

返回数据包含：`bvid`、`title`、`pic`（封面）、`duration`、`author`、`play`（播放量）、`tag` 等。

---

## 六、实现步骤（按优先级排序）

### Phase 1：最小可行版本（MVP）

1. **定义新类型** — 在 `lib/types/resource.ts` 中新增 `VideoSource` 和 `VideoSearchResult`
2. **实现B站搜索** — 新建 `lib/video/bilibili-search.ts`，调用B站搜索API
3. **实现搜索聚合** — 新建 `lib/video/search-aggregator.ts`，聚合搜索结果
4. **新增搜索API** — 新建 `app/api/video/search/route.ts`
5. **修改资源生成API** — 改造 `app/api/generate/resources/route.ts` 中 video 分支
6. **重写VideoPlayer** — 改造 `components/resources/video-player.tsx`，展示视频列表+弹窗播放器
7. **安装Dialog组件** — `npx shadcn@latest add dialog`（如未安装）

### Phase 2：本地知识库支持（后期实施）

8. **数据库模型** — 在 Prisma schema 中新增 `LocalVideo` 模型
9. **本地搜索实现** — 补充 `lib/video/local-search.ts` 的真实实现
10. **本地视频管理** — 新建 `app/api/video/local/route.ts`（CRUD）
11. **向量搜索** — 接入项目已有的 embedding 能力，实现语义匹配

### Phase 3：体验优化

12. **LLM 辅助搜索词** — 用 LLM 将知识点优化为搜索关键词
13. **搜索结果缓存** — 相同知识点避免重复搜索
14. **用户反馈** — 记录用户点击/观看行为，优化后续推荐
15. **多平台扩展** — 接入 YouTube 等其他视频平台
16. **视频预览** — 鼠标悬停显示视频预览（B站支持）

---

## 七、关键风险与应对

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| B站API变动/限流 | 搜索失败 | 多源降级（本地优先）、结果缓存、请求限流 |
| B站嵌入播放器CSP限制 | 无法内嵌播放 | 提供外链跳转作为降级方案 |
| 本地知识库为空 | 无本地结果 | MVP阶段先依赖B站，本地库逐步建设 |
| 视频内容质量不可控 | 推荐不相关视频 | LLM辅助筛选、relevanceScore排序、用户反馈 |
| iframe安全风险 | XSS攻击 | sandbox属性限制、CSP策略 |

---

## 八、文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `lib/types/resource.ts` | 新增 VideoSource、VideoSearchResult 类型，修改 metadata.videoData 类型 |
| 新建 | `lib/video/bilibili-search.ts` | B站视频搜索服务 |
| 新建 | `lib/video/local-search.ts` | 本地知识库视频搜索服务 |
| 新建 | `lib/video/search-aggregator.ts` | 视频搜索聚合服务 |
| 新建 | `lib/video/config.ts` | 视频搜索配置 |
| 新建 | `app/api/video/search/route.ts` | 视频搜索 API |
| 修改 | `app/api/generate/resources/route.ts` | video 分支改为调用搜索服务 |
| 重写 | `components/resources/video-player.tsx` | 从分镜脚本展示改为视频列表+弹窗播放器 |
| 可选修改 | `lib/generation/resource-decision.ts` | 放宽视频触发条件 |
| 可选修改 | `lib/prompts/resource-prompts.json` | video prompt 改为搜索关键词优化 |
| 可选修改 | `prisma/schema.prisma` | 新增 LocalVideo 模型 |
| 可选新建 | `app/api/video/local/route.ts` | 本地视频管理 API |
| 废弃 | `lib/video/generate.ts` | `parseVideoScript` 不再使用（可保留兼容） |
