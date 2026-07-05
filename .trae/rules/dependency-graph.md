# 迁移依赖关系图

> 本文件定义 Phase 间、模块间、文件间的精确依赖关系，确保迁移顺序正确。

---

## 1. Phase 间依赖

```
Phase 0 (架构定义)
  ↓
Phase 1 (核心基础设施)
  ↓
Phase 2a (AgentLoop + Chat + 简单 Tools)
  ↓
Phase 2b (RAG + Search + Embedding) ←── 与 2c 无依赖，可并行
Phase 2c (Sandbox + Memory + Notebook) ←── 与 2b 无依赖，可并行
  ↓ (2b 和 2c 都完成后)
Phase 2d (SmartLearn Capability 改造)
  ↓
Phase 3a (Loop Capabilities: solve/mastery/explore)
  ↓
Phase 3b (Agent Capabilities: question/research/visualize + 前端页面)
  ↓
Phase 4 (Book + Co-Writer)
  ↓
Phase 5 (高级功能)
  ↓
Phase 6 (Docker 部署)
```

### 每个 Phase 的前置条件

| Phase | 必须完成的前置 | 可选前置 |
|-------|---------------|---------|
| 0 | 无 | 阅读 DeepTutor + SmartLearn 源码 |
| 1 | Phase 0 的所有类型定义和接口 | 无 |
| 2a | Phase 1 的 Session/Turn/Message、认证、SSE 扩展 | 无 |
| 2b | Phase 1 的存储服务、LLM 适配 | Phase 2a 的 ToolRegistry |
| 2c | Phase 1 的存储服务、LLM 适配 | Phase 2a 的 ToolRegistry |
| 2d | Phase 2a（Chat Capability 可用）+ Phase 2b（RAG 可用）+ Phase 2c（Memory 可用） | 无 |
| 3a | Phase 2d（SmartLearn 已改造） | Phase 2b（Learning 服务可能用 RAG） |
| 3b | Phase 3a（Persona/Skill 服务） | 无 |
| 4 | Phase 3b（前端页面框架就位） | 无 |
| 5 | Phase 4 | 无 |
| 6 | Phase 5 | 无 |

---

## 2. Phase 内部模块依赖

### Phase 0：架构定义

```
创建顺序：
  1. lib/deeptutor/core/types.ts                    ← 无依赖
  2. lib/deeptutor/core/tool-protocol.ts             ← 依赖 types.ts
  3. lib/deeptutor/core/capability-protocol.ts       ← 依赖 types.ts, tool-protocol.ts
  4. lib/deeptutor/tools/_base.ts                    ← 依赖 types.ts, tool-protocol.ts
  5. lib/deeptutor/tools/_mock.ts                    ← 依赖 _base.ts
  6. lib/deeptutor/tools/registry.ts                 ← 依赖 _base.ts
  7. lib/deeptutor/tools/composition.ts              ← 依赖 registry.ts
  8. lib/deeptutor/capabilities/_base.ts             ← 依赖 capability-protocol.ts
  9. lib/deeptutor/capabilities/_loop.ts             ← 依赖 _base.ts, tools/registry.ts
  10. lib/deeptutor/capabilities/_knowledge.ts       ← 依赖 _base.ts, tools/registry.ts
  11. lib/deeptutor/capabilities/_pipeline.ts        ← 依赖 _base.ts
  12. lib/deeptutor/capabilities/_graph.ts           ← 依赖 _base.ts
  13. lib/deeptutor/capabilities/registry.ts         ← 依赖 _base.ts, capability-protocol.ts
  14. lib/deeptutor/core/stream-bus.ts               ← 依赖 types.ts
  15. lib/deeptutor/core/input-handler.ts            ← 依赖 types.ts, stream-bus.ts
  16. lib/deeptutor/core/event-bus.ts                ← 无依赖
  17. lib/deeptutor/core/labels.ts                   ← 依赖 types.ts
  18. lib/deeptutor/core/prompt/types.ts             ← 无依赖
  19. lib/deeptutor/core/prompt/renderer.ts          ← 依赖 types.ts
  20. lib/deeptutor/core/prompt/manager.ts           ← 依赖 types.ts, renderer.ts
  21. lib/deeptutor/core/orchestrator.ts             ← 依赖 capabilities/registry.ts, stream-bus.ts, input-handler.ts
  22. lib/deeptutor/services/ (所有空壳)              ← 依赖 types.ts
```

### Phase 1：核心基础设施

```
创建顺序：
  1.1 Prisma Schema 扩展 (Session/Turn/Message)     ← 依赖现有 schema.prisma
  1.2 认证系统 (JWT + middleware + AsyncLocalStorage) ← 依赖 schema 扩展
  1.3 流式事件系统 (17种 StreamEvent + input-handler) ← 依赖 Phase 0 的 stream-bus.ts, input-handler.ts
  1.4 存储服务 (本地磁盘 + S3 适配器)                ← 依赖认证（userId）
  1.5 LLM 服务适配 (UsageTracker + TrafficController) ← 依赖 SmartLearn 的 callLLM/streamLLM
  1.6 设置与配置系统 (API Key 服务端存储 + 模型目录)   ← 依赖认证 + Prisma
```

### Phase 2a：AgentLoop + Chat

```
创建顺序：
  2a.1 AgentLoop 子图                               ← 依赖 Phase 0 的所有核心类型 + Phase 1 的 SSE
  2a.2 简单 Tools (brainstorm, reason, web_fetch, ask_user, web_search)
      ← 依赖 AgentLoop 子图 + Phase 0 的 ToolRegistry
  2a.3 Chat Capability                              ← 依赖 AgentLoop + 简单 Tools
  2a.4 Chat 前端                                    ← 依赖 Chat Capability API
  2a.5 附件处理                                     ← 依赖 Phase 1.4 存储服务
```

### Phase 2b：RAG + Search

```
创建顺序：
  1. pgvector 扩展 (Prisma)                         ← 依赖 Phase 1 的 Prisma
  2. Embedding 调用                                  ← 依赖 SmartLearn 的 providers.ts
  3. 文档分块                                       ← 依赖存储服务
  4. 基本重排序                                     ← 依赖 Embedding
  5. KB 管理器                                      ← 依赖分块 + Embedding + pgvector
  6. KB Seed 机制                                   ← 依赖 KB 管理器
  7. markitdown 解析                                ← 依赖存储服务
  8. rag Tool + read_source Tool                    ← 依赖 KB 管理器 + Phase 2a 的 ToolRegistry
  9. 前端组件                                       ← 依赖 KB API
```

### Phase 2c：Sandbox + Memory + Notebook

```
创建顺序：
  1. Sandbox (Piston API 适配器 + 配额)             ← 依赖 SmartLearn 现有 /api/code/execute
  2. Memory (L1/L2/L3 + 整合器 + 快照)              ← 依赖 Phase 1.4 存储服务 + Phase 1.5 LLM
  3. Notebook (管理器)                               ← 依赖 Phase 1.4 存储服务
  4. Tools (code_execution, exec, read_memory, write_memory, list_notebook, write_note, paper_search, load_tools)
      ← 依赖 Sandbox + Memory + Notebook + Phase 2a 的 ToolRegistry
  5. DeferredToolLoader 机制                         ← 依赖 Phase 0 的 ToolProtocol
  6. 前端组件                                       ← 依赖 Memory/Notebook API
```

### Phase 2d：SmartLearn Capability 改造

```
创建顺序：
  1. SmartLearn GraphCapability 包装                 ← 依赖 Phase 0 的 GraphCapability + 现有 learning-graph
  2. LearnEvent → StreamEvent 映射层                ← 依赖 Phase 1.3 的 StreamEvent 定义
  3. API 迁移 (旧路由 → /api/v1/*)                  ← 依赖 GraphCapability 包装完成
  4. 前端整合 (/smartlearn 页面)                     ← 依赖新 API
  5. Store 迁移 (useSettingsStore, useSessionsStore) ← 依赖新 API
  6. 旧 API 废弃                                    ← 依赖前端完全切换
```

---

## 3. 跨模块依赖矩阵

### 3.1 服务层依赖

| 服务 | 依赖的服务 | 依赖的 SmartLearn 模块 |
|------|-----------|----------------------|
| LLMService | 无 | `lib/ai/llm.ts`, `lib/ai/providers.ts` |
| SessionService | AuthService, StorageService | `prisma/schema.prisma` |
| AuthService | 无 | `prisma/schema.prisma` |
| StorageService | AuthService (userId) | `fs`, `path` |
| RAGService | LLMService, StorageService | `lib/ai/providers.ts` (embedding) |
| MemoryService | LLMService, StorageService | 无 |
| NotebookService | StorageService | 无 |
| SandboxService | 无 | `app/api/code/execute/route.ts` |
| SearchService | 无 | `lib/web-search/tavily.ts` |
| SkillService | StorageService | 无 |
| PersonaService | StorageService, LLMService | 无 |
| LearningService | RAGService, MemoryService, LLMService | 无 |
| KnowledgeService | RAGService, StorageService | 无 |
| MCPService | 无 | 无 |

### 3.2 Capability 依赖

| Capability | 依赖的 Tools | 依赖的服务 |
|------------|-------------|-----------|
| Chat | brainstorm, reason, web_fetch, ask_user, web_search, rag, read_source | LLMService, SessionService |
| SmartLearn | (内部 learning-graph 节点) | LLMService, SessionService |
| deep_solve | solve_plan, solve_finish_step, solve_replan, brainstorm, reason, rag, code_execution | LLMService, SessionService |
| mastery_path | mastery_status, mastery_quiz, mastery_grade, mastery_assess, mastery_build | LearningService, LLMService |
| explore_context | read_source | RAGService |
| deep_question | brainstorm, reason | LLMService |
| deep_research | web_search, web_fetch, rag, paper_search | SearchService, RAGService |
| visualize | code_execution | SandboxService |

---

## 4. Prisma Schema 演进路径

```
现有 Schema (Phase 0)
  User, LearningProfile, Resource, LearningPath, ChatSession, QuizResult, PathNodeResource, StageOutline

Phase 1 新增
  Session (id, userId, mode, title, metadata, createdAt, updatedAt)
  Turn (id, sessionId, userId, status, mode, metadata, createdAt)
  Message (id, sessionId, turnId, role, content, parentMessageId, metadata, createdAt)

Phase 2b 新增
  KnowledgeBase (id, userId, name, description, provider, documentCount, status, createdAt, updatedAt)
  Document (id, kbId, title, filePath, chunkCount, status, createdAt)
  DocumentChunk (id, documentId, content, embedding, metadata, createdAt)  ← pgvector
```

**迁移脚本顺序**：
1. `prisma migrate dev --name add_session_turn_message`
2. `prisma migrate dev --name add_knowledge_base`（Phase 2b）
3. 每个 migrate 必须验证现有数据不受影响

---

## 5. SmartLearn 现有文件修改清单

### Phase 1 需修改的现有文件

| 文件 | 修改内容 | 风险等级 |
|------|---------|---------|
| `prisma/schema.prisma` | 新增 Session/Turn/Message 模型 | 低（新增，不影响现有） |
| `lib/store/settings.ts` | 新增服务端设置相关字段 | 中（向后兼容，新字段可选） |
| `lib/store/sessions.ts` | 新增 turns 层 | 高（数据模型变更） |

### Phase 2d 需修改的现有文件

| 文件 | 修改内容 | 风险等级 |
|------|---------|---------|
| `app/api/learn/route.ts` | 迁移到 /api/v1/smartlearn | 高（API 变更） |
| `app/api/chat/route.ts` | 废弃，替换为 /api/v1/chat | 高（API 变更） |
| `app/api/tutor/chat/route.ts` | 废弃，合并到 /api/v1/chat | 高（API 变更） |
| `app/api/evaluate/route.ts` | 迁移到 /api/v1/smartlearn/evaluate | 中 |
| `app/api/web-search/route.ts` | 迁移到 /api/v1/search/web | 中 |
| `app/api/video/search/route.ts` | 迁移到 /api/v1/search/video | 中 |
| `app/api/profile/route.ts` | 迁移到 /api/v1/smartlearn/profile | 中 |
| `app/api/generate/ppt/route.ts` | 迁移到 /api/v1/smartlearn/ppt | 中 |
| `app/api/generate/resources/route.ts` | 迁移到 /api/v1/smartlearn/resources | 中 |
| `components/layout/app-nav.tsx` | 新增 SmartLearn 导航项 | 低 |
| `components/chat/process-sse-stream.ts` | 扩展事件类型处理 | 中（向后兼容） |

### 不修改的现有文件

| 文件 | 原因 |
|------|------|
| `lib/learning-graph/*` | 包装为 GraphCapability，内部不修改 |
| `lib/orchestration/director-graph.ts` | 保留为 PPT 编排 |
| `lib/generation/*` | 保留为 smartlearn 内部 |
| `lib/ai/llm.ts` | 复用，不修改 |
| `lib/ai/providers.ts` | 复用，不修改 |
| `components/resources/*` | 7 种资源查看器保留 |
| `components/slide-renderer/*` | PPT 编辑器保留 |
