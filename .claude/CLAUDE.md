# SmartLearn 项目规则 — DeepTutor → Next.js 迁移主控文档

> **本文件是 AI 执行任何迁移/重构任务时的第一参考文件。**
> 每次会话开始时必须先读本文件获取最新上下文，再根据指引读取其他专项文档。

---

## 一、项目基本信息

### SmartLearn（目标项目）

| 项目 | 实际值 |
|------|--------|
| 路径 | `D:\python\docment\smartlearn` |
| 框架 | Next.js **^15.3.0**（非 15.5） + React **^19.1.0** + TypeScript **5.7** |
| 样式 | Tailwind CSS **^4.0.0**（CSS-first，`@theme inline` 配置，无 tailwind.config） |
| 状态管理 | Zustand **^5.0.0** + Immer（22 个 store：13 核心 + 9 v2） |
| UI 库 | shadcn/ui **^4.8.1**（radix-vega 风格，32 个 UI 组件） |
| AI/LLM | Vercel AI SDK **ai ^5.0.192** + @langchain/langgraph **^0.3.0** |
| 数据库 | Prisma **^6.0.0** + PostgreSQL（8 个模型，**尚未接入实际使用**） |
| i18n | i18next，4 种语言（en-US / zh-CN / ja-JP / ru-RU） |
| AI 提供商 | 12 家（openai/anthropic/google/glm/qwen/deepseek/kimi/minimax/siliconflow/doubao/grok/spark） |
| 测试覆盖 | **零**（无测试文件） |
| 主题 | 4 套（Cream / Dark / Snow / Glass） |

### DeepTutor（参考源码）

| 项目 | 实际值 |
|------|--------|
| 路径 | `D:\python\docment\DeepTutor-main`（**非** `E:\DeepTutor-main`） |
| 版本 | **1.4.2**（`deeptutor/__version__.py`，**非** 1.4.8） |
| 后端 | Python 3.11+ / FastAPI / Uvicorn |
| 前端 | Next.js **^16.2.3** + React 19 + Tailwind **^3.4.17** + React Context（**无 Zustand**） |
| LLM | 多 provider SDK（OpenAI/Anthropic/DashScope/Perplexity/Ollama 等 20+） |
| RAG | **仅 LlamaIndex 一种管线**（GraphRAG/LightRAG/PageIndex 未实现） |
| Partner 渠道 | **12 个**已实现（DingTalk/Discord/Email/Feishu/Matrix/MoChat/QQ/Slack/Telegram/WeCom/WhatsApp/Zulip；Teams/NapCat/WeChat **未实现**） |
| API 路由 | 22-23 个路由模块（`deeptutor/api/routers/`） |
| 搜索 | 10 个搜索提供商（Baidu/Brave/DuckDuckGo/Exa/Jina/OpenRouter/Perplexity/SearXNG/Serper/Tavily） |

### 两项目前端技术栈差异（迁移组件时必须注意）

| 维度 | SmartLearn | DeepTutor web/ |
|------|-----------|---------------|
| Tailwind | **v4**（CSS-first `@theme inline`） | **v3**（`tailwind.config.js`） |
| 状态管理 | **Zustand v5** + persist | **React Context** |
| 组件库 | **shadcn/ui**（Radix 原语） | 自定义组件 + Framer Motion |
| i18n 语言 | 4 种（en/zh/ja/ru） | 2 种（en/zh） |
| 图标 | lucide-react | lucide-react |

**影响**：从 DeepTutor 迁移前端组件时，必须将 Tailwind v3 class 语法适配为 v4，将 React Context 替换为 Zustand store，将自定义组件替换为 shadcn/ui 等价物。

---

## 二、关键架构事实

### 两套 LangGraph 图（不要混淆）

| 图 | 路径 | 用途 |
|---|---|---|
| learning-graph | `lib/learning-graph/graph.ts` | 自适应学习流程（8 节点 + 条件边 + 闭环） |
| director-graph | `lib/orchestration/director-graph.ts` | **多智能体对话编排**（导演决定下一个发言 Agent），用于 PPT 生成等 |

**注意**：director-graph 的核心功能是"多 Agent 对话编排"，PPT 只是编排的可能输出之一。迁移时 Chat Capability 使用新的 AgentLoop 子图，**不复用 director-graph**。

### Agent 注册表

路径：`lib/orchestration/registry/store.ts`
当前 10 个 Agent：profile / document / quiz / code / tutor / evaluation / mindmap / video / ppt / reading

### 资源类型（7 种）

`lib/types/resource.ts`：document / mindmap / quiz / video / code / reading / ppt

### Prisma Schema（8 个模型，尚未接入）

`prisma/schema.prisma`：User / LearningProfile / Resource / LearningPath / ChatSession / QuizResult / PathNodeResource / StageOutline

**问题**：这 8 个模型虽然定义了，但没有任何 API 路由或 Service 实际调用它们。Phase 1 需要在此基础上扩展 Session/Turn/Message，并激活实际使用。

### PrismaClient 单例

- 实际实现：`lib/utils/database.ts`
- 重导出：`lib/db/client.ts`（`export { prisma } from '@/lib/utils/database'`）

### LearnEvent（14 种，非 15）

`lib/learning-graph/types.ts`：phase_start / phase_end / text_delta / node_ready / resource_decision / resource_delta / ppt_ready / evaluation_result / profile_update / path_update / tutor_response / agent_status / error / done

### StreamEvent（DeepTutor 现有 14 种，计划扩展为 17 种）

`deeptutor/core/stream.py` StreamEventType：STAGE_START / STAGE_END / THINKING / OBSERVATION / CONTENT / TOOL_CALL / TOOL_RESULT / PROGRESS / SOURCES / RESULT / ERROR / SESSION / SESSION_META / DONE

**注意**：迁移路线图中的"17 种"是扩展后的目标值，当前 DeepTutor 实际只有 14 种。

### 学习图拓扑（8 节点）

```
START → routeByAction → plan_node / evaluate / tutor_respond / END
plan_node → analyze_learner → plan_resources → generate_resources → END
evaluate → afterEvaluate → update_profile / update_profile_end
update_profile → afterUpdateProfile → plan_node / END
update_profile_end → END
tutor_respond → END
```

### Zustand Store 双重体系（需要注意）

`lib/store/` 下存在新旧两套 store 命名：

| 旧 store | v2 store | 说明 |
|----------|----------|------|
| `sessions.ts` | `v2/session-store.ts` | 会话管理 |
| `settings.ts` | `v2/settings-store.ts` | 设置 |
| `knowledge-store.ts` | — | 知识库 |
| `memory-store.ts` | — | 记忆 |
| `book-store.ts` | — | 书籍 |
| `cowriter-store.ts` | — | 协作写作 |

**决策**：迁移时需要明确统一为一套，避免前端集成混乱。建议在 Phase 2d 时统一处理。

### 全项目零测试覆盖

SmartLearn 没有任何测试文件。Phase 0 要求核心模块测试覆盖率 ≥ 80%。

---

## 三、API 路由现状

### 已完成（全部提交并推送至 origin/master）

- **39+ 个** `/api/v1/*` 路由已创建并提交（Phase 0~5 共 8 次迁移提交）
- **17 个**旧路由已迁移到 v1 等价路由
- Phase 5 额外新增：`/api/v1/auth/login`、`/api/v1/auth/register`、`/api/v1/chat/import`

### 旧路由清单（17 个，已全部迁移到 v1）

/api/chat、/api/code/execute、/api/evaluate、/api/generate/ppt、/api/generate/resources、/api/health、/api/learn、/api/profile、/api/profile/chat、/api/proxy-media、/api/resource-decision、/api/settings/image-gen、/api/transcription、/api/tutor/chat、/api/verify-model、/api/video/search、/api/web-search

---

## 四、当前已知问题

### 4.1 ~~TypeScript 编译错误~~（已解决）

Phase 0~5 全部通过后 `npx tsc --noEmit` 零错误，87 个 Vitest 测试全部通过。

### 4.2 ~~页面 Mock 数据~~（已解决）

Phase 3b 前端已将页面从 mock 切换到真实 API 调用。

### 4.3 Prisma Schema 未完全接入

8 个原始 Prisma 模型（User, LearningProfile, Resource 等）定义了但在部分路径中尚未被实际调用。Phase 1 新增的 Session/Turn/Message 已在 `services/session.ts` 中使用。

### 4.4 Store 双重体系

新旧 store 并存（13 核心 + 9 v2），尚未统一。

### 4.5 Phase 6 待实施

Docker 部署是最后一个 Phase，需要创建 Dockerfile + docker-compose.yml + .dockerignore + .env.example。

---

## 五、迁移执行铁律

### 5.1 严格按 Phase 顺序

```
Phase 0 → 1 → 2a → 2b/2c（可并行）→ 2d → 3a → 3b → 4 → 5 → 6
```

- 禁止跨 Phase 实现
- 每个 Phase 必须验证通过后才能进入下一个
- 验证标准见 `.claude/acceptance-criteria.md`

### 5.2 禁止事项

| 禁止 | 原因 |
|------|------|
| 实现标记为 ⏳（推迟）的功能 | Partner/Cron/Subagent/高级RAG 与 Next.js 不兼容或复杂度过高 |
| 修改非当前 Phase 的文件 | 避免破坏已完成的功能 |
| 创建超出文档定义的抽象 | 防止过度工程化 |
| 引入未确认的 npm 依赖 | 避免版本冲突和安全风险 |
| 在 `lib/deeptutor/` 之外创建迁移代码 | 迁移代码统一放在 `lib/deeptutor/` 下 |
| 复用 director-graph 作为 Chat Capability | Chat 用新的 AgentLoop 子图 |
| 仅凭文档描述猜测 DeepTutor 实现 | 必须先读源码再重写 |

### 5.3 代码位置与规范

- **迁移代码位置**：`lib/deeptutor/`（与 `lib/ai/`、`lib/store/` 同级）
- **import 路径**：`@/lib/deeptutor/...`
- **API 路由**：新路由统一 `/api/v1/*`
- **类型系统**：TypeScript 严格模式，禁止 `any`（除非标注 `// TODO: remove any`）
- **错误处理**：每个 async 函数必须有 try/catch 或上层错误边界
- **单 worker 模式**：跨请求状态共享使用模块级变量（Map、EventEmitter 等）

### 5.4 代码风格

| 规范 | 示例 |
|------|------|
| 文件命名 | kebab-case：`tool-registry.ts` |
| 类命名 | PascalCase：`ToolRegistry` |
| 函数命名 | camelCase：`registerTool()` |
| 常量命名 | UPPER_SNAKE_CASE：`MAX_ITERATIONS` |
| 接口命名 | PascalCase，不加 `I` 前缀 |
| 类型导出 | 优先 `export type` |
| 错误处理 | 自定义 Error 类（如 `ToolExecutionError`） |
| 异步模式 | 全部 `async/await`，不用 `.then()` 链 |
| 日志 | 使用 `@/lib/logger`，不用 `console.log` |
| Import 顺序 | 1. React/Next → 2. 第三方库 → 3. @/ 别名 → 4. 相对路径 |

### 5.5 i18n 规范

- 所有新组件必须支持 i18n（`useI18n` hook）
- 不硬编码中文文本，翻译 key 放 `lib/i18n/locales/` 的 4 个 JSON（en-US / zh-CN / ja-JP / ru-RU）
- API Key 不传前端，走后端环境变量

### 5.6 修改现有文件的安全策略

1. **先读后改**：修改任何文件前，先完整读取
2. **最小变更**：只修改必要部分
3. **向后兼容**：新增字段用可选类型（`?`），不删除现有字段
4. **渐进迁移**：新 API 就绪前，旧 API 保持可用
5. **改完验证**：`npm run build` 必须通过

---

## 六、架构决策摘要

| # | 决策 | 关键点 |
|---|------|--------|
| 1 | Agentic Loop 基于 LangGraph | 三种 Capability 类型：Loop/Agent/Graph |
| 2 | SSE + HTTP POST 回传 | ask_user 60s 超时降级，Map<turnId, PromiseResolver> 单 worker |
| 3 | Prisma + PostgreSQL | 复用现有，扩展 Session/Turn/Message |
| 4 | RAG 仅 pgvector 基础检索 | **不依赖 llamaindex-ts**，BM25/索引版本化推迟到 Phase 5 |
| 5 | Parsing 仅 markitdown + 纯文本 | 不引入 Python sidecar |
| 6 | Sandbox 复用 Piston API | 不自建沙箱 |
| 7 | 代码放 `lib/deeptutor/` | 该目录将在 Phase 0 创建 |
| 8 | SmartLearn 改造为 GraphCapability | learning-graph 保留内部实现，director-graph 仅用于 PPT 编排 |
| 9 | 统一 `/api/v1/*` | 17 个旧路由已全部迁移并提交（Phase 0~5） |
| 10 | Partner/Cron/Subagent 推迟 | 与 Next.js 请求-响应模型不兼容 |
| 11 | 单 worker 部署 | `next start` 限制 1 worker，模块级变量共享状态 |
| 12 | EventBus 短期用模块级 EventEmitter | 长期可升级 Redis pub/sub |
| 13 | KnowledgeCapability 独占工具面 | 替换而非增强工具集 |

详细决策说明见 `迁移路线图.md`。

---

## 七、Phase 速查

| Phase | 目标 | 用户可见 | 状态 |
|-------|------|---------|------|
| 0 | 类型定义 + MockTool/Capability 测试 + LangGraph JS 验证 | 否 | ✅ |
| 1 | 认证 + 会话持久化 + SSE 扩展 + 存储 + LLM 适配 + 设置 | 是 | ✅ |
| 2a | AgentLoop + Chat + 5 个简单 Tools + 前端 | 是 | ✅ |
| 2b | pgvector RAG + Embedding + KB 管理 + rag/read_source Tools | 是 | ✅ |
| 2c | Sandbox + Memory L1/L2/L3 + Notebook + 延迟工具 | 是 | ✅ |
| 2d | SmartLearn GraphCapability + 事件映射 + API 迁移 + Store 统一 | 是 | ✅ |
| 3a | solve/mastery/explore_context Loop Capabilities + Persona/Skill | 是 | ✅ |
| 3b | question/research/visualize Agent Capabilities + MCP + 前端页面 | 是 | ✅ |
| 4 | Book Engine（13 Block + 5 子代理）+ Co-Writer + Playground | 是 | ✅ |
| 5 | BM25 混合检索 + math_animator/vision/obsidian + 媒体 + Auth 前端 | 是 | ✅ |
| 6 | Docker 部署 | 是 | 🔄 待执行 |

---

## 八、专项文档索引

执行迁移时，以下文件按需读取：

| 文件 | 用途 | 读取时机 |
|------|------|---------|
| `.claude/migration-guide.md` | 迁移执行规范（禁止事项 + 架构约束 + 侵入性修改清单） | 每次开始前 |
| `.claude/acceptance-criteria.md` | 每个 Phase 的验收标准和验证场景 | 完成 Phase 时 |
| `.claude/dependency-graph.md` | Phase 间/模块间/文件间依赖关系 | 规划执行顺序时 |
| `.claude/python-to-ts-spec.md` | Python → TypeScript 映射规则 | 转换代码时 |
| `.claude/source-index.md` | SmartLearn + DeepTutor 关键模块接口速查 | 需要接口签名参考时 |
| `迁移路线图.md` | 完整迁移规划和 13 条架构决策 | 理解全局时 |
| `功能清单.md` | 每个功能的来源/状态/说明 | 确认功能范围时 |
| `deeptutor项目代码结构说明.md` | DeepTutor 源码完整目录说明 | 查找 DeepTutor 模块时 |
| `deeptutor项目架构与模块分析文档.md` | DeepTutor 7 层架构 + 数据流 + 技术难点 | 深入理解设计时 |

---

## 九、DeepTutor 源码参考路径

```
D:\python\docment\DeepTutor-main\
  deeptutor\
    core\             ← UnifiedContext, StreamEvent, ToolProtocol, Agentic Loop
    runtime\          ← Orchestrator, Registry
    api\routers\      ← 22-23 个 API 路由
    capabilities\     ← chat/solve/research/question/visualize/math_animator/auto
    tools\            ← brainstorm/reason/rag/code_executor/web_search 等
    agents\           ← BaseAgent + 各 Capability 的 Agent 实现
    services\
      llm\            ← LLM 工厂/注册/能力检测/流量控制
      rag\            ← RAG 服务（仅 LlamaIndex）
      memory\         ← 三层记忆 + 整合器 + 快照
      session\        ← Turn 运行时 + 会话管理
      search\         ← 10 个搜索提供商
      config\         ← 运行时设置 + 模型目录
    book\             ← Book Engine（13 Block + 5 子代理）
    co_writer\        ← 协作写作
    learning\         ← 掌握路径 + 间隔重复
    tutorbot\         ← TutorBot 引擎（channels/providers/agent）
    multi_user\       ← 多用户系统（推迟迁移）
  web\                ← Next.js 16 前端（React Context，非 Zustand）
```

**重要**：迁移任何模块前，必须先阅读对应的 DeepTutor 源码，理解完整逻辑后再用 TS 重写。

---

## 十、提交规范

### 分支命名

```
feature/migration-phase-{N}
```

### 提交格式

```
feat(deeptutor): Phase {N} - {简述}

- 具体变更 1
- 具体变更 2
```

### Phase 提交粒度

- Phase 0：按模块提交（types → registry → prompt → orchestrator）
- Phase 1：按子模块提交（1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6）
- Phase 2+：按功能提交

---

## 十一、工作流规则

1. 每次会话开始时，先读本文件（`.claude/CLAUDE.md`）获取最新上下文
2. 确认当前正在执行的 Phase 编号
3. 读取对应的专项文档（见第八节）
4. 改完代码后跑 `npm run build` 验证
5. 对话上下文接近上限时，总结本次会话内容保存为 `.md` 文件，供新窗口衔接
6. 发现本文件信息与实际代码不符时，以实际代码为准，并更新本文件

---

## 附录：审计修正记录（2026-07-07）

以下修正基于代码交叉验证审计，已更新到本文件：

| 原始声明 | 修正为 | 来源 |
|---------|--------|------|
| DeepTutor 路径 `E:\DeepTutor-main` | `D:\python\docment\DeepTutor-main` | 迁移路线图.md |
| DeepTutor 版本 1.4.8 | **1.4.2** | `__version__.py` |
| 16 个旧路由废弃 | **17 个**旧路由 | Git 历史 |
| LearnEvent 15 种 | **14 种** | `lib/learning-graph/types.ts` |
| StreamEvent 17 种 | 现有 **14 种**，计划扩展 17 种 | `deeptutor/core/stream.py` |
| 4 种 RAG 引擎 | 仅 **1 种**（LlamaIndex） | `services/rag/factory.py` |
| 15 个 Partner 渠道 | **12 个**已实现 | `tutorbot/channels/` |
| 27 个 API 路由 | **22-23 个** | `api/routers/` |
| Next.js 15.5 | **^15.3.0** | `package.json` |
| 14 种 Book Block | **13 种** + 1 基类 | `book/blocks/` |
| director-graph "PPT演示" | **多智能体对话编排** | `director-graph.ts` 注释 |

新增章节：
- 第四节（当前已知问题）— TS 编译错误、mock 数据、Prisma 未接入、Store 双重体系
- 第一节"两项目前端技术栈差异"表
- 第二节"Zustand Store 双重体系"表
