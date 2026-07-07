# DeepTutor → Next.js 迁移执行规范

> 本文件是 AI 执行迁移任务时的主控规范。任何迁移操作必须遵守本文件的约束。

---

## 1. 执行铁律

### 1.1 严格按 Phase 顺序执行

```
Phase 0 → Phase 1 → Phase 2a → Phase 2b → Phase 2c → Phase 2d → Phase 3a → Phase 3b → Phase 4 → Phase 5 → Phase 6
```

- **禁止跨 Phase 实现**：即使某个功能看起来简单，也不得在当前 Phase 未完成时提前实现
- **每个 Phase 必须验证通过后才能进入下一个**：验证标准见 `acceptance-criteria.md`
- **当前 Phase 编号必须明确**：每次会话开始时，先确认当前正在执行的 Phase 编号

### 1.2 禁止事项

| 禁止 | 原因 |
|------|------|
| 实现标记为 ⏳（推迟）的功能 | Partner/Cron/Subagent/高级RAG等与 Next.js 不兼容或复杂度过高 |
| 修改非当前 Phase 的文件 | 避免破坏已完成的功能 |
| 创建超出文档定义的抽象 | 防止过度工程化 |
| 引入新的 npm 依赖（未经确认） | 避免版本冲突和安全风险 |
| 修改 `prisma/schema.prisma` 之外的数据模型 | 数据模型变更必须通过 Prisma migrate |
| 在 `lib/deeptutor/` 之外创建迁移代码 | 迁移代码统一放在 `lib/deeptutor/` 下 |
| 复用 `director-graph` 作为 Chat Capability | director-graph 仅用于 PPT 编排，Chat 用新的 AgentLoop 子图 |

### 1.3 必须遵守的约定

- **代码位置**：所有迁移代码放在 `lib/deeptutor/` 下，import 路径 `@/lib/deeptutor/...`
- **API 路由**：新路由统一 `/api/v1/*`，旧路由在 Phase 2d 统一切换
- **类型系统**：使用 TypeScript 严格模式，禁止 `any`（除非明确标注 `// TODO: remove any`）
- **错误处理**：每个 async 函数必须有 try/catch 或上层错误边界
- **单 worker 模式**：所有跨请求状态共享使用模块级变量（Map、EventEmitter 等）

---

## 2. 架构决策的隐含假设与约束

### 决策 2：SSE + HTTP POST 回传

**假设**：自部署模式下连接数不是瓶颈

**约束**：
- ask_user 暂停期间 SSE 连接保持，服务端 `await Promise` 等待用户输入
- 超时 60s 后自动降级为普通文本回复，**必须释放连接**
- `Map<turnId, PromiseResolver>` 必须在超时或取消时清理，否则内存泄漏
- 开发环境 HMR 会清除模块级变量，ask_user 的 Map 会丢失——开发时需注意

### 决策 8：SmartLearn 改造为 GraphCapability

**假设**：learning-graph 可以包装为 GraphCapability

**约束**：
- learning-graph 的 14 种 LearnEvent 与 DeepTutor 的 14 种 StreamEvent（计划扩展为 17 种）的映射不是简单的一对一
- `agent-switch` 映射为 `STAGE_START`（语义不同：Agent切换 vs 阶段开始）
- `tutor_response` 需要映射为 `CONTENT`（不是 `RESULT`）
- director-graph 保留为 smartlearn 内部 PPT 编排，**不复用为 Chat Capability**

### 决策 11：单 worker 部署

**假设**：`next start` 限制为 1 个 worker

**约束**：
- 模块级变量（Map、EventEmitter、信号量等）仅在单 worker 下可靠
- 开发环境（`next dev`）每次 HMR 会重置模块级变量
- 后期如需多 worker，需引入 Redis pub/sub 替代所有模块级状态

### 决策 4：RAG 不依赖 llamaindex-ts

**假设**：pgvector + 自研分块/检索可满足基本需求

**约束**：
- Phase 2b 仅实现 pgvector 基础向量检索 + 文档分块 + 基本重排序
- BM25 混合、4 引擎、索引版本化推迟到 Phase 5
- 分块算法参考 DeepTutor 的 `LlamaIndex` 配置（chunk_size=1024, overlap=200），但用 TS 重写

---

## 3. SmartLearn 现有代码的侵入性修改清单

以下修改会影响现有功能，必须特别小心：

| 修改项 | Phase | 影响范围 | 风险 |
|--------|-------|----------|------|
| `schema.prisma` 新增 Session/Turn/Message 表 | Phase 1 | 数据库迁移 | 必须确保现有表不受影响 |
| `DEFAULT_USER_ID` 从硬编码改为认证上下文 | Phase 1 | 所有使用 DEFAULT_USER_ID 的代码 | 需全局搜索替换 |
| `useSettingsStore` 扩展为 DeepTutor 统一设置 | Phase 2d | 设置页面 | API Key 从 localStorage 迁移到服务端 |
| `useSessionsStore` 数据模型扩展 | Phase 2d | 会话管理 | 新增 turns 层，需向后兼容 |
| 废弃 `/api/learn` 等 17 个旧路由 | Phase 2d | 所有前端调用 | 一次性切换，旧 API 同步废弃 |
| SSE 事件格式扩展（LearnEvent 14种 → StreamEvent 14种，计划扩展17种） | Phase 1 | 前端 SSE 解析 | 新事件类型需前端适配 |

### 修改现有文件时的安全策略

1. **先读后改**：修改任何文件前，先完整读取该文件
2. **最小变更**：只修改必要的部分，不做"顺便"的重构
3. **向后兼容**：新增字段使用可选类型（`?`），不删除现有字段
4. **渐进迁移**：新 API 就绪前，旧 API 保持可用

---

## 4. 分支与提交策略

### 分支命名

```
feature/migration-phase-{N}    # 如 feature/migration-phase-0
```

### 提交规范

```
feat(deeptutor): Phase {N} - {简述}

- 具体变更 1
- 具体变更 2
```

### 每个 Phase 的提交粒度

- **Phase 0**：按模块提交（types → registry → prompt → orchestrator）
- **Phase 1**：按子模块提交（1.1 会话 → 1.2 认证 → 1.3 流式 → 1.4 存储 → 1.5 LLM → 1.6 设置）
- **Phase 2+**：按功能提交

---

## 5. 代码风格规范

与 SmartLearn 现有代码保持一致：

| 规范 | 示例 |
|------|------|
| 文件命名 | kebab-case：`tool-registry.ts` |
| 类命名 | PascalCase：`ToolRegistry` |
| 函数命名 | camelCase：`registerTool()` |
| 常量命名 | UPPER_SNAKE_CASE：`MAX_ITERATIONS` |
| 接口命名 | PascalCase，不加 `I` 前缀：`ToolDefinition`（非 `IToolDefinition`） |
| 类型导出 | 使用 `export type` 而非 `export interface`（当仅用于类型时） |
| 错误处理 | 使用自定义 Error 类（如 `ToolExecutionError`），不抛原始字符串 |
| 异步模式 | 全部使用 `async/await`，不使用 `.then()` 链 |
| 日志 | 使用 `@/lib/logger` 的 `logger`，不使用 `console.log` |
| Import 顺序 | 1. React/Next → 2. 第三方库 → 3. @/ 别名 → 4. 相对路径 |

---

## 6. 关键参考文件

执行迁移时，以下文件是必读的：

| 文件 | 用途 |
|------|------|
| `迁移路线图.md` | 迁移的整体规划和架构决策 |
| `功能清单.md` | 每个功能的来源、状态和说明 |
| `source-index.md` | SmartLearn + DeepTutor 关键模块接口速查 |
| `python-to-ts-spec.md` | Python → TypeScript 的具体映射规则 |
| `dependency-graph.md` | Phase 间/模块间/文件间的精确依赖 |
| `acceptance-criteria.md` | 每个 Phase 的验收标准 |

---

## 7. DeepTutor 源码位置

迁移时需要参考 DeepTutor Python 源码：

```
D:\python\docment\DeepTutor-main\
  deeptutor\
    tutorbot\
      agent\          ← AgentLoop, ContextBuilder, Memory, Subagent, Skills, Tools
      providers\      ← LLMProvider 体系
      channels\       ← 渠道系统（推迟迁移）
      bus\            ← MessageBus（需重新设计）
      config\         ← 配置 Schema
    tools\            ← reason, brainstorm, rag, code_executor 等
    services\         ← RAG, Search, Session, Skill 等
```

**重要**：迁移任何模块前，必须先阅读对应的 DeepTutor 源码，理解其完整逻辑后再用 TS 重写。不得仅凭文档描述猜测实现。
