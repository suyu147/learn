# SmartLearn Claude Code 分步执行指令

> 使用方法：按编号顺序，每次只发一条指令给 Claude Code，等它完成并确认无错误后再发下一条。
> 每条指令末尾的验证步骤必须执行。

---

## Phase 1：修复编译错误

### 第 1 步：创建项目规则文件

```
请在项目根目录创建 .claude/CLAUDE.md 文件，内容如下：

```
# SmartLearn 项目规则

## 关键架构
- 两套 LangGraph 图：learning-graph（学习流程，/api/learn）和 director-graph（PPT演示，/api/chat），不要混淆
- Agent 注册表在 lib/orchestration/registry/store.ts，当前 6 个 Agent（profile/document/quiz/code/tutor/evaluation）
- 资源类型 7 种：document/mindmap/quiz/video/code/reading/ppt
- 前端 store 用 zustand + persist（localStorage），数据库 schema 在 prisma/schema.prisma 但未接入
- 已有依赖：recharts, @xyflow/react, motion, echarts, markmap-lib, markmap-view — 不需要安装新依赖
- lib/store/whiteboard-history.ts、lib/store/media-generation.ts、lib/api/stage-api.ts、lib/utils/audio-player.ts 这些文件已存在，不要创建桩文件
- lib/store/canvas.ts 已有 clearAllEffects/setSpotlight/setLaser/playVideo/setWhiteboardClearing 等方法
- lib/types/action.ts 已是判别联合类型，Action 的各子类型定义完整

## 代码规范
- 所有新组件必须支持 i18n（useI18n hook），翻译 key 放 lib/i18n/locales/ 的 4 个 JSON 文件
- 不在组件中硬编码中文文本
- 改完代码后运行 npx tsc --noEmit 验证
- 项目重构计划详见根目录 项目重构.md
```

验证：确认文件已创建。
```

---

### 第 2 步：获取当前编译错误

```
请运行 npx tsc --noEmit 2>&1 | Select-Object -First 200，查看当前 TypeScript 编译错误。
将输出保存到 tsc-current-errors.txt。然后统计：
1. 错误总数
2. 按文件分布（每个文件多少个错误）
3. 错误类型分布（TS2307模块找不到 / TS2345类型不兼容 / TS2339属性不存在 / 其他）

不要修改任何代码，只做分析。
```

---

### 第 3 步：修复 engine.ts 编译错误

```
lib/action/engine.ts 是编译错误最集中的文件。请读取该文件和第 2 步的 tsc-current-errors.txt，定位 engine.ts 的实际错误。

重要背景（这些文件都已存在，不要创建桩文件）：
- lib/types/action.ts 已是完整的判别联合类型（SpotlightAction/LaserAction/SpeechAction 等），Action 的 type 字段是字面量类型
- lib/store/canvas.ts 已有 clearAllEffects/setSpotlight/setLaser/playVideo/playingVideoElementId/setWhiteboardClearing
- lib/store/whiteboard-history.ts、lib/store/media-generation.ts、lib/api/stage-api.ts、lib/utils/audio-player.ts 都已存在

如果 tsc 报"Cannot find module"但文件确实存在，可能是 tsconfig 路径别名配置问题，检查 tsconfig.json 的 paths 配置。
如果 tsc 报"Property does not exist"但 store 中确实有该方法，可能是 import 的 store 版本不对或类型推断问题。

请根据实际 tsc 输出定位并修复，不要预设错误类型。逐个修复，不要重写整个文件。

修复后运行 npx tsc --noEmit 2>&1 | Select-Object -First 50 确认 engine.ts 的错误减少。
```

---

### 第 4 步：修复剩余编译错误

```
运行 npx tsc --noEmit 2>&1 | Select-Object -First 200 查看剩余错误。

逐个文件修复，策略：
- 对于类型不兼容错误：添加适当的类型断言或类型守卫
- 对于属性不存在错误：检查是否需要扩展接口或添加可选链
- 对于非核心功能的类型错误（如 slide-renderer 相关），可以添加 // @ts-expect-error 注释并说明原因
- 不要删除或注释掉有错误的代码行，而是正确修复类型

修复后运行 npx tsc --noEmit 报告最终错误数量。目标：错误数降到 20 以下。
```

---

## Phase 2：补齐 Agent 注册

### 第 5 步：新增 4 个 Agent 到注册表

```
请修改 lib/orchestration/registry/store.ts，在 defaultAgents 数组中新增 4 个 Agent。

先读取 lib/prompts/resource-prompts.json 确认有哪些 key（已知有 document/mindmap/quiz/video/code/reading/ppt 共 7 个）。

在 defaultAgents 数组末尾添加：

{
  id: 'mindmap',
  name: '思维导图Agent',
  description: '生成知识点思维导图',
  systemPrompt: resourcePrompts.mindmap,
  taskTypes: ['resource_gen'],
  isDefault: true,
},
{
  id: 'video',
  name: '视频Agent',
  description: '搜索和推荐教学视频',
  systemPrompt: resourcePrompts.video,
  taskTypes: ['resource_gen'],
  isDefault: true,
},
{
  id: 'ppt',
  name: '课件Agent',
  description: '生成动态交互课件',
  systemPrompt: resourcePrompts.ppt,
  taskTypes: ['resource_gen'],
  isDefault: true,
},
{
  id: 'reading',
  name: '拓展阅读Agent',
  description: '策展拓展阅读材料',
  systemPrompt: resourcePrompts.reading,
  taskTypes: ['resource_gen'],
  isDefault: true,
},

注意：resource-prompts.json 已有全部 7 个 key，不需要补充 prompt。

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 3：资源生成并行化

### 第 6 步：新增 agent_status 事件类型

```
请修改 lib/learning-graph/types.ts：

1. 在文件顶部确认 ResourceType 已从 @/lib/types/resource 导入（如果没有就添加）

2. 在 LearnEvent 联合类型中，在 { type: 'error'; message: string } 之前新增：
   | { type: 'agent_status'; agentId: string; agentName: string; status: 'running' | 'completed' | 'failed'; resourceType: ResourceType }

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 7 步：创建全局 Agent 活动 Store

```
请创建 lib/store/agent-activity.ts：

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResourceType } from '@/lib/types/resource';

export interface AgentActivityEntry {
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  resourceType: ResourceType;
  timestamp: number;
}

interface AgentActivityState {
  agentStatuses: Record<string, AgentActivityEntry>;
  activityLog: AgentActivityEntry[];
  updateAgentStatus: (entry: Omit<AgentActivityEntry, 'timestamp'>) => void;
  getActivityLog: () => AgentActivityEntry[];
  clearAll: () => void;
}

export const useAgentActivityStore = create<AgentActivityState>()(
  persist(
    (set, get) => ({
      agentStatuses: {},
      activityLog: [],

      updateAgentStatus: (entry) => {
        const fullEntry = { ...entry, timestamp: Date.now() };
        set((state) => ({
          agentStatuses: { ...state.agentStatuses, [entry.agentId]: fullEntry },
          activityLog: [...state.activityLog, fullEntry].slice(-100), // 保留最近100条
        }));
      },

      getActivityLog: () => get().activityLog,
      clearAll: () => set({ agentStatuses: {}, activityLog: [] }),
    }),
    { name: 'agent-activity-storage', partialize: (state) => ({ activityLog: state.activityLog }) },
  ),
);

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 8 步：改造 generate-resources.ts — 并行 + 失败降级

```
请修改 lib/learning-graph/nodes/generate-resources.ts，做以下改造：

1. 在文件顶部添加 Agent 名称映射：
   const AGENT_NAMES: Record<string, string> = {
     document: '文档Agent', mindmap: '思维导图Agent', quiz: '题库Agent',
     video: '视频Agent', code: '代码Agent', reading: '拓展阅读Agent', ppt: '课件Agent',
   };

2. 添加并发限制常量：
   const MAX_CONCURRENCY = 3;

3. 将 try 块内的串行 for 循环改为并行生成。替换以下代码：
   原代码：
     const generatedResources: Resource[] = [];
     for (const type of resourcePlan.execution.resourceTypes) {
       const generated = await generateResource(type, node.knowledgePoints, state.profile, state.aiConfig);
       const resource: Resource = { ... };
       generatedResources.push(resource);
       write({ type: 'resource_delta', resource });
     }

   替换为：
     // 分批并行生成，每批最多 MAX_CONCURRENCY 个
     const types = resourcePlan.execution.resourceTypes;
     const generatedResources: Resource[] = [];
     for (let i = 0; i < types.length; i += MAX_CONCURRENCY) {
       const batch = types.slice(i, i + MAX_CONCURRENCY);
       const results = await Promise.allSettled(
         batch.map(async (type) => {
           write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'running', resourceType: type });
           try {
             const generated = await generateResource(type, node.knowledgePoints, state.profile, state.aiConfig);
             const resource: Resource = {
               id: crypto.randomUUID(), userId: 'current', type, title: generated.title, content: generated.content,
               sourceAgent: type, status: 'ready', createdAt: new Date().toISOString(),
               metadata: { knowledgePoints: node.knowledgePoints, profileUsed: true, ...generated.metadata },
             };
             write({ type: 'resource_delta', resource });
             write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'completed', resourceType: type });
             return resource;
           } catch (err) {
             write({ type: 'agent_status', agentId: type, agentName: AGENT_NAMES[type] || type, status: 'failed', resourceType: type });
             const fallbackResource: Resource = {
               id: crypto.randomUUID(), userId: 'current', type, title: `${node.knowledgePoints.join('、')} - ${type}（生成失败）`,
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

4. PPT 生成逻辑保持不变（在资源并行完成后单独执行）

5. 确保 import 中包含 ResourceType（从 @/lib/types/resource 导入，如果还没有的话）

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 9 步：前端接入 agent_status 事件

```
请修改 app/workspace/page.tsx，接入 agent_status 事件：

1. 在文件顶部添加 import：
   import { useAgentActivityStore } from '@/lib/store/agent-activity';

2. 在 WorkspacePage 组件内添加 store 引用：
   const updateAgentStatus = useAgentActivityStore((state) => state.updateAgentStatus);

3. 在 handleLearnEvent 的 switch 语句中，在 default 之前新增 case：
   case 'agent_status':
     updateAgentStatus({
       agentId: event.agentId,
       agentName: event.agentName,
       status: event.status,
       resourceType: event.resourceType,
     });
     break;

4. 修改 WorkspaceHeader 组件的调用，传入 agentStatuses prop：
   <WorkspaceHeader profile={profile} agentStatuses={useAgentActivityStore((state) => state.agentStatuses)} />

5. 修改 components/workspace/workspace-header.tsx：
   - Props 接口新增：agentStatuses?: Record<string, { status: string; agentName: string; resourceType: string; timestamp: number }>;
   - 在 header 右侧区域（Badge 画像完整度之前），添加 Agent 状态指示：
     如果 agentStatuses 存在且有 running 状态的 Agent，显示一个小标签：
     <Badge variant="outline" className="text-xs gap-1">
       <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
       {Object.values(agentStatuses).filter(a => a.status === 'running').length} 个Agent运行中
     </Badge>

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 4：修复评估闭环

### 第 10 步：state 新增 evaluationFeedback + evaluate 节点写入

```
请修改以下两个文件：

1. lib/learning-graph/state.ts — 在 LearningState 的 Annotation.Root 中新增字段（加在 evaluationScore 之后）：
   evaluationFeedback: Annotation<{ weakPoints: string[]; strongPoints: string[]; suggestedFocus: string[] } | null>(),

2. lib/learning-graph/nodes/evaluate.ts — 修改 evaluateNode 函数的返回值：
   - 在 try 块中，当 quizResults 为空时的 fallback return 中，新增 evaluationFeedback: null
   - 在 try 块中，正常评估的 return 中，新增：
     evaluationFeedback: evaluation ? { weakPoints: evaluation.weakPoints, strongPoints: evaluation.strongPoints, suggestedFocus: evaluation.suggestedFocus } : null
   - 在 catch 块的 return 中，新增 evaluationFeedback: null

3. lib/learning-graph/nodes/update-profile.ts — 不需要改，evaluationFeedback 通过 state 自动传递

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 11 步：评估反馈注入资源策略

```
请修改以下两个文件：

1. lib/generation/resource-decision.ts — 在 DecisionConstraints 接口中新增两个可选字段（加在 forceExclude 之后）：
   boostTypes?: ResourceType[];
   suppressTypes?: ResourceType[];

2. lib/learning-graph/nodes/plan-resources.ts — 在 planResourcesNode 函数中，构建 constraints 时注入评估反馈：
   在 const overrideTypes = ... 之后，const decision = applyOverrides(...) 之前，添加：
   
   const evaluationFeedback = state.evaluationFeedback;
   const boostTypes: ResourceType[] = evaluationFeedback?.weakPoints?.length
     ? ['quiz', 'code']
     : [];
   const suppressTypes: ResourceType[] = evaluationFeedback?.strongPoints?.length
     ? ['document']
     : [];

   然后修改 decideNodeResourcePlan 的调用，在 constraints 对象中新增：
   boostTypes,
   suppressTypes,

3. 回到 lib/generation/resource-decision.ts — 在 decideNodeResourcePlan 函数中使用 boostTypes 和 suppressTypes：
   在 const forceExclude = new Set(constraints?.forceExclude ?? []); 之后添加：
   const boostTypes = new Set(constraints?.boostTypes ?? []);
   const suppressTypes = new Set(constraints?.suppressTypes ?? []);

   在 for (const type of DECISION_RESOURCE_TYPES) 循环中，在 forceExclude 检查之后添加：
   if (boostTypes.has(type) && items.get(type)?.action === 'skip') {
     const item = items.get(type);
     if (item && !forceExclude.has(type)) {
       items.set(type, { ...item, action: 'generate', reason: `评估反馈：薄弱知识点需要${type}资源强化`, sourceLayer: 'feedback' as const });
     }
   }
   if (suppressTypes.has(type) && items.get(type)?.action === 'generate') {
     const item = items.get(type);
     if (item && !forceInclude.includes(type)) {
       items.set(type, { ...item, action: 'skip', reason: `评估反馈：已掌握内容跳过${type}资源` });
     }
   }

4. lib/learning-graph/nodes/plan-node.ts — 在 buildPrompt 函数中注入评估反馈：
   在 return 的数组末尾（'请规划下一个学习节点。' 之前）添加：
   state.evaluationFeedback?.weakPoints?.length
     ? `上轮评估薄弱点：${state.evaluationFeedback.weakPoints.join('、')}，请优先规划包含这些知识点的节点。`
     : '',

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 5：更新导航

### 第 12 步：添加全局导航组件

```
请创建 components/layout/app-nav.tsx — 全局导航栏组件：

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, Users, BarChart3, FolderOpen, Settings, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/profile', labelKey: 'nav.profile', icon: Users },
  { href: '/workspace', labelKey: 'nav.workspace', icon: BookOpen },
  { href: '/agent-orchestration', labelKey: 'nav.agentOrchestration', icon: Users },
  { href: '/evaluation', labelKey: 'nav.evaluation', icon: BarChart3 },
  { href: '/resources/library', labelKey: 'nav.resourceLibrary', icon: FolderOpen },
  { href: '/ppt', labelKey: 'nav.ppt', icon: Presentation },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-12 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-bold">SmartLearn</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  {item.labelKey /* 后续替换为 t(item.labelKey) */}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

然后在以下页面中替换现有的 header 为 <AppNav />：
1. app/profile/page.tsx — 删除 <header>...</header>，在 <div className="flex min-h-screen flex-col"> 内顶部添加 <AppNav />
2. app/workspace/page.tsx — 保留 WorkspaceHeader（它有会话管理功能），在它上方添加 <AppNav />
3. app/page.tsx — 暂时不动（后面会整体重写为仪表盘）

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 6：新增页面

### 第 13 步：Agent 编排页面 — 静态布局

```
请创建 app/agent-orchestration/page.tsx — 多智能体协同可视化页面（第一版：静态布局）。

页面布局：左侧 2/3 为 Agent 节点图，右侧 1/3 为协作日志面板。

先创建一个简化版本：
1. 左侧用 CSS Grid 或 Flex 布局展示 10 个 Agent 卡片（不用 @xyflow/react，先用简单卡片布局）：
   - Profile Agent（画像分析师）
   - Planner Agent（路径规划师）
   - Analyzer Agent（学情分析师）
   - Doc Agent（文档专家）
   - MindMap Agent（思维导图专家）
   - Quiz Agent（题库专家）
   - Code Agent（代码专家）
   - Reading Agent（拓展阅读策展人）
   - Video Agent（视频推荐官）
   - PPT Agent（课件设计师）

2. 每个卡片显示：Agent 名称、角色描述、状态指示灯（⚪等待/🟡运行/🟢完成/🔴失败）
   状态从 useAgentActivityStore 的 agentStatuses 读取

3. 右侧面板：协作日志时间线
   从 useAgentActivityStore 的 activityLog 读取，每条显示时间、Agent名称、状态、资源类型

4. 顶部使用 <AppNav /> 导航

5. 所有文本先用中文硬编码，后续统一替换为 i18n

验证：运行 npx tsc --noEmit 确认无新错误。然后运行 npm run dev 访问 /agent-orchestration 确认页面可渲染。
```

---

### 第 14 步：Agent 编排页面 — 接入动态状态

```
请增强 app/agent-orchestration/page.tsx：

1. 当 Agent 状态为 running 时，卡片边框变为黄色 + 添加 animate-pulse 效果
2. 当 Agent 状态为 completed 时，卡片边框变为绿色
3. 当 Agent 状态为 failed 时，卡片边框变为红色
4. 点击卡片时，展开显示该 Agent 的最近活动记录（从 activityLog 过滤）
5. 在右侧日志面板中，最新记录自动滚动到底部

6. 底部添加统计区域：
   - 已完成 Agent 数 / 总数
   - 失败 Agent 数
   - 使用 recharts 的 PieChart 展示资源类型分布（从 activityLog 统计 completed 状态的 resourceType）

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 15 步：评估页面 — 维度量化 + profileHistory

```
请先做数据准备工作：

1. 修改 lib/store/learning-profile.ts：
   - 在 LearningProfileState 接口中新增：
     profileHistory: Array<{ version: number; dimensions: ProfileDimensions; updatedAt: string }>;
   - 在 store 初始值中新增：profileHistory: []
   - 在 updateDimensions 方法的 set() 回调中，在创建 newProfile 之前，先将当前 profile 追加到 profileHistory：
     如果 state.profile 存在，追加 { version: state.profile.version, dimensions: state.profile.dimensions, updatedAt: state.profile.updatedAt }
   - 在 persist 的 partialize 中包含 profileHistory
   - 在 reset 方法中包含 profileHistory: []

2. 在 lib/utils/profile-utils.ts 中新增维度量化函数：
   export function calculateDimensionScores(dimensions: ProfileDimensions): Record<keyof ProfileDimensions, number> {
     return {
       knowledgeBase: Math.min(100, (dimensions.knowledgeBase.subjects.length > 0 ? 60 : 0) + dimensions.knowledgeBase.subjects.reduce((acc, s) => acc + (s.mastery > 0 ? 10 : 0), 0)),
       cognitiveStyle: dimensions.cognitiveStyle.preference ? 100 : (dimensions.cognitiveStyle.type !== 'reading' ? 70 : 30),
       learningGoals: (dimensions.learningGoals.shortTerm.length > 0 ? 50 : 0) + (dimensions.learningGoals.longTerm ? 50 : 0),
       weakPoints: (dimensions.weakPoints.topics.length > 0 ? 60 : 0) + (dimensions.weakPoints.errorPatterns.length > 0 ? 40 : 0),
       timePreference: (dimensions.timePreference.preferredDuration > 0 ? 70 : 0) + (dimensions.timePreference.preferredTimeSlot ? 30 : 0),
       interests: (dimensions.interests.domains.length > 0 ? 50 : 0) + (dimensions.interests.preferredFormats.length > 1 ? 50 : 0),
       learningPace: dimensions.learningPace.speed !== 'moderate' ? 100 : 50,
       errorPatterns: (dimensions.errorPatterns.commonMistakes.length > 0 ? 60 : 0) + (dimensions.errorPatterns.difficultAreas.length > 0 ? 40 : 0),
     };
   }

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 16 步：评估页面 — 创建页面

```
请创建 app/evaluation/page.tsx — 学习效果评估页面。

页面内容：

1. 8 维度雷达图（初始值 vs 当前值对比）：
   - 使用 recharts 的 RadarChart
   - 初始值从 profileHistory[0] 计算（用 calculateDimensionScores），当前值从 profile 计算
   - 8 个维度用 PROFILE_DIMENSION_LABELS 的中文标签
   - 两条线：初始（虚线灰色）和当前（实线蓝色）

2. 薄弱点追踪：
   - 从 useAgentActivityStore 的 activityLog 中筛选 failed 状态的记录
   - 从 learning-profile store 读取 weakPoints.topics 和 errorPatterns
   - 用标签形式展示，每个薄弱点一个 Badge

3. 画像增量更新时间线：
   - 从 profileHistory 读取，垂直时间线
   - 每个节点显示：版本号、更新时间、维度变化摘要（对比前后 version 的差异）

4. 推荐解释面板：
   - 从 useResourceDecisionsStore 读取当前 session 的 decisionLogs
   - 展示每条 decision 的 summary.reasoning

5. 顶部使用 <AppNav /> 导航

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 17 步：首页升级为仪表盘

```
请改造 app/page.tsx 为学习总览仪表盘。

替换当前内容为：

1. 顶部使用 <AppNav /> 导航

2. Hero 区域：
   - 欢迎语"欢迎回来"
   - 画像完整度进度条（从 useLearningProfileStore 读取，用 calculateProfileCompleteness 计算）
   - "继续学习"按钮（跳转 /workspace，如果画像未完成则跳转 /profile）

3. 4 核心卡片（2x2 网格）：
   - 画像完整度：百分比 + 进度条
   - 当前学习节点：从 useLearningPathStore 读取 in_progress 节点的标题
   - 已生成资源数：从 useResourcesStore 读取资源总数，按类型小图标分布
   - 学习进度：已完成节点数 / 总节点数

4. 学习路径横向时间轴：
   - 从 useLearningPathStore 读取 path
   - 已完成节点（绿色圆点）→ 当前节点（蓝色高亮）→ 待学习节点（灰色）

5. Agent 状态总览：
   - 从 useAgentActivityStore 读取 agentStatuses
   - 10 个 Agent 小卡片，显示名称和当前状态

6. 智能推荐提示：
   - 如果画像不完整，显示"完善画像以获得更精准推荐"
   - 如果有评估薄弱点，显示"建议复习 XXX"

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 18 步：个人学习资源库

```
请创建 app/resources/library/page.tsx — 个人学习资源库。

1. 创建目录 app/resources/（如果不存在）

2. 页面内容：
   - 顶部筛选栏：资源类型标签页（全部/文档/思维导图/视频/代码/题库/阅读/课件）+ 搜索输入框
   - 资源卡片网格：每个卡片显示类型图标（用 RESOURCE_TYPE_ICONS 映射）、标题、生成时间、来源 Agent
   - 点击卡片在本页展开预览（用 Dialog 弹窗显示 content）
   - 失败资源（status === 'failed'）显示红色"生成失败"标记

3. 数据来源：从 useResourcesStore 读取

4. 顶部使用 <AppNav /> 导航

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 7：现有页面增强

### 第 19 步：画像构建页面增强

```
请增强 components/profile/profile-card.tsx：

1. 读取 lib/types/profile.ts 中的 PROFILE_DIMENSION_LABELS 获取维度中文名

2. 将 ProfileCard 改为可折叠的 8 维度面板：
   - 每个维度显示：名称 + 完成度小进度条（用 calculateDimensionScores 计算该维度分数）
   - 点击维度可展开查看详细内容（显示该维度的 JSON 数据，格式化展示）
   - 分数低于 50 的维度用虚线边框 + "待补充"提示

3. 在 ProfileCard 底部显示画像诊断建议：
   - 列出分数低于 50 的维度名称
   - 提示"建议补充 XXX 信息以获得更精准推荐"

4. 使用 lib/utils/profile-utils.ts 中已有的 calculateProfileCompleteness 和新增的 calculateDimensionScores

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 20 步：学习工作台增强

```
请增强以下组件：

1. components/workspace/learning-path-panel.tsx：
   - 每个节点下方增加可展开的"生成日志"区域
   - 展开后从 useAgentActivityStore 的 activityLog 中过滤该节点相关的记录
   - 显示时间线：哪个 Agent 在什么时间做了什么

2. components/workspace/resource-viewer.tsx：
   - 每个资源顶部增加来源追溯标签："由 [Doc Agent] 生成"
   - 从 resource.sourceAgent 字段读取，用 AGENT_NAMES 映射显示中文名
   - 失败资源（status === 'failed'）显示"生成失败"标记和重试按钮（重试按钮暂不实现功能，只显示 UI）

3. components/workspace/tutor-chat-panel.tsx：
   - 在聊天输入框上方增加提示："AI 辅导基于当前资源内容回答问题"

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 21 步：设置页面增强

```
请增强 app/settings/page.tsx：

1. 讯飞星火专用配置区（在现有模型配置下方新增 Card）：
   - 标题："讯飞星火配置"
   - 字段：APIKey（Input + 密码显示切换）、APISecret（Input + 密码显示切换）
   - 模型选择（Select）：Lite / Pro / Pro-128K / 4.0 Ultra
   - 从 lib/ai/spark-adapter.ts 的 SPARK_MODELS 读取模型列表
   - 保存时写入 useSettingsStore（需要先在 lib/store/settings.ts 中新增 sparkApiKey/sparkApiSecret/sparkModelId 字段及其 setter）

2. 多 Agent 开关（新增 Card）：
   - 标题："资源生成 Agent 管理"
   - 从 lib/orchestration/registry/store.ts 读取 Agent 列表
   - 每个 taskTypes 包含 'resource_gen' 的 Agent 显示一个 Switch 开关
   - 关闭的 Agent ID 存入 useSettingsStore 的新字段 disabledAgentIds: string[]
   - 在 generate-resources.ts 中读取 disabledAgentIds 过滤掉禁用的类型（这个改动可以后续做，先完成 UI）

3. 数据导出/导入（新增 Card）：
   - "导出数据"按钮：将 learning-profile + resources + learning-path + resource-decisions + agent-activity 打包为 JSON 下载
   - "导入数据"按钮：上传 JSON 文件，解析后写入各 store

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 21.5 步：禁用 Agent 的后端过滤

```
第 21 步在设置页添加了 Agent 开关，存入 useSettingsStore 的 disabledAgentIds。
现在需要在资源生成时实际过滤掉禁用的 Agent。

请修改 lib/learning-graph/nodes/generate-resources.ts：

1. 在文件顶部添加 import：
   import { useSettingsStore } from '@/lib/store/settings';

2. 在 generateResourcesNode 函数中，在 const types = resourcePlan.execution.resourceTypes 之后添加过滤：
   const disabledAgentIds = typeof window !== 'undefined' ? useSettingsStore.getState().disabledAgentIds ?? [] : [];
   const enabledTypes = types.filter((type) => !disabledAgentIds.includes(type));

3. 将后续代码中的 types 替换为 enabledTypes（分批并行生成使用 enabledTypes）

4. 同样在 PPT 生成逻辑中，如果 disabledAgentIds 包含 'ppt'，跳过 PPT 生成

注意：useSettingsStore.getState() 可以在 React 组件外使用（zustand 的非 Hook 用法）。
但在服务端（/api/learn route）中 window 不存在，所以需要 typeof window 检查。
更好的做法是把 disabledAgentIds 通过 LearnRequest 传入后端，但这需要改 API 接口，
暂时用前端 store 读取即可（generate-resources.ts 只在客户端触发的流程中使用）。

验证：运行 npx tsc --noEmit 确认无新错误。
```

### 第 22 步：架构图 + Agent 角色卡

```
请创建以下组件：

1. components/architecture-overview.tsx：
   - 用 SVG 绘制系统架构图
   - 层次：用户层（浏览器）→ 前端 UI（Next.js）→ API 路由（/api/learn, /api/chat）→ LangGraph 编排层（learning-graph, director-graph）→ 模型接入层（AI SDK）→ 大模型（讯飞星火/OpenAI/Anthropic/Google）
   - 每层用圆角矩形，层间用箭头连接
   - 简洁风格，宽度 100%，高度自适应
   - 导出为 React 组件，接收 className prop

2. components/agent-roles-card.tsx：
   - 从 lib/orchestration/registry/store.ts 读取 Agent 列表
   - 每个 Agent 显示：名称、描述、角色图标（用 lucide-react 图标映射）
   - 悬停展开显示 systemPrompt 前 200 字摘要
   - 使用 HoverCard 组件（已有 @radix-ui/react-hover-card）

3. 在 app/settings/page.tsx 底部新增一个 Card，标题"系统架构"，内嵌 <ArchitectureOverview />

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 23 步：学习路径节点"为什么？"按钮

```
请修改 components/workspace/learning-path-panel.tsx：

1. 在每个节点标题右侧添加一个信息图标按钮（Info icon from lucide-react）

2. 点击后弹出 Popover 或 Dialog，显示该节点的资源决策推理过程：
   - 从 useResourceDecisionsStore 的 getDecisionLogsForSession 读取
   - 找到 nodeId 匹配的 decision log
   - 展示 decision.summary.reasoning（每条推理一行）
   - 展示 decision.trace.rulesApplied（应用的规则列表）

3. 如果没有决策记录，显示"暂无决策记录"

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 9：数据库接入（可延后）

### 第 24 步：Prisma schema 更新 + 客户端

```
请做以下修改：

1. 修改 prisma/schema.prisma：
   - ResourceType enum 新增 ppt 和 reading
   - ResourceStatus enum 新增 failed

2. 创建 lib/db/client.ts：
   import { PrismaClient } from '@prisma/client';
   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
   export const prisma = globalForPrisma.prisma ?? new PrismaClient();
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

3. 创建 app/api/profile/route.ts：
   - GET：从 prisma.learningProfile.findMany 读取画像列表，返回 JSON
   - POST：接收 { dimensions: ProfileDimensions } 数据，用 prisma.learningProfile.upsert 保存
   - 暂时用 userId: 'default-user' 硬编码

4. 在 .env.example 中添加：DATABASE_URL="postgresql://user:password@localhost:5432/smartlearn"

5. 运行 npx prisma generate 确认 schema 无误

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 25 步：Store 写入数据库

```
请修改 lib/store/learning-profile.ts，在 updateDimensions 方法中加入数据库写入：

在 set() 回调之后（set 调用的外面），添加：
if (typeof window !== 'undefined') {
  fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dimensions: mergedDimensions }),
  }).catch(() => {});
}

注意：
- typeof window 检查防止 SSR 时执行
- .catch(() => {}) 静默失败，不影响本地使用
- mergedDimensions 变量需要在 set 回调外部也能访问，所以需要调整代码结构：
  先计算 mergedDimensions，然后 set()，然后 fetch()

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

### 第 26 步：API Key 后端代理

```
请修改 API Key 传递方式：

1. 修改 app/api/learn/route.ts：
   在 POST 函数中，构建 graph 输入时，aiConfig 改为：
   aiConfig: {
     providerId: body.aiConfig?.providerId || process.env.AI_PROVIDER as string || undefined,
     modelId: body.aiConfig?.modelId || process.env.AI_MODEL_ID || undefined,
     apiKey: process.env.AI_API_KEY || body.aiConfig?.apiKey,
     baseUrl: process.env.AI_BASE_URL || body.aiConfig?.baseUrl,
   }
   优先使用环境变量，fallback 到前端传来的值（兼容过渡期）

2. 在 .env.example 中添加：
   AI_API_KEY=your-api-key-here
   AI_BASE_URL=https://api.openai.com/v1
   AI_PROVIDER=openai
   AI_MODEL_ID=gpt-4o

3. 前端暂不改动（保留传 apiKey 的能力作为 fallback），但在 workspace 页面的 aiConfig 构建处添加注释：
   // TODO: 生产环境应移除 apiKey 前端传递，改用环境变量

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 10：i18n 补全

### 第 27 步：i18n 翻译补全

```
请检查并补全 i18n 翻译：

1. 读取 lib/i18n/locales/zh-CN.json，查看现有 key 结构

2. 为以下新增内容添加翻译 key（在 nav 命名空间下）：
   - nav.dashboard: "总览"
   - nav.profile: "画像构建"
   - nav.workspace: "学习工作台"
   - nav.agentOrchestration: "Agent 编排"
   - nav.evaluation: "学习评估"
   - nav.resourceLibrary: "资源库"
   - nav.ppt: "动态课件"
   - nav.settings: "设置"

3. 为评估页面添加翻译 key（在 evaluation 命名空间下）：
   - evaluation.title: "学习效果评估"
   - evaluation.radarChart: "能力雷达图"
   - evaluation.initialScore: "初始值"
   - evaluation.currentScore: "当前值"
   - evaluation.weakPoints: "薄弱知识点"
   - evaluation.timeline: "画像更新时间线"
   - evaluation.reasoning: "推荐解释"

4. 为 Agent 编排页面添加翻译 key（在 agentOrchestration 命名空间下）：
   - agentOrchestration.title: "多智能体协同编排"
   - agentOrchestration.status.waiting: "等待中"
   - agentOrchestration.status.running: "运行中"
   - agentOrchestration.status.completed: "已完成"
   - agentOrchestration.status.failed: "失败"
   - agentOrchestration.log: "协作日志"
   - agentOrchestration.statistics: "统计"

5. 同步更新 en-US.json、ja-JP.json、ru-RU.json（可以用简单翻译，不需要完美）

6. 替换第 13 步和第 17 步中硬编码的中文文本为 t() 调用

验证：运行 npx tsc --noEmit 确认无新错误。
```

---

## Phase 11：最终验证

### 第 28 步：全量构建验证

```
请依次运行以下命令并报告结果：

1. npx tsc --noEmit — 报告错误数量（目标：0）
2. npm run build — 报告是否成功
3. npm run lint — 报告 lint 结果

如果有错误，逐个修复直到全部通过。对于无法修复的非关键错误，记录在 tsc-remaining-errors.txt 中。
```

---

### 第 29 步：功能验证

```
请启动开发服务器 npm run dev，然后逐页验证以下功能：

1. / (首页仪表盘) — 页面可渲染，4 卡片有数据
2. /profile — 画像构建对话可用
3. /workspace — 学习流程可触发，Agent 状态栏可见
4. /agent-orchestration — Agent 卡片显示，状态随学习流程变化
5. /evaluation — 雷达图可渲染
6. /resources/library — 资源列表可显示
7. /settings — 讯飞星火配置区可见
8. /ppt — PPT 页面不受影响

如果某页报错，读取浏览器控制台错误信息并修复。

验证完成后停止开发服务器。
```
