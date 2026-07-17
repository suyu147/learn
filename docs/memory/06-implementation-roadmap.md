# 6. 实施路线图

## 6.1 三阶段实施

### 第一阶段：数据入口修复 + Snapshot 采集 + 并发隔离（核心突破）

**目标**: 让记忆系统有数据进来，不再依赖 LLM 主动调用；同时解决并发安全问题

**任务**:

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 实现 AsyncLocalStorage 工具上下文 | `lib/deeptutor/context/tool-context.ts` (新增) | `runWithToolContext` + `getCurrentUserId` |
| 1.2 | 改造 memory 工具读 userId | `write-memory.ts`, `read-memory.ts` | `_userId` → `getCurrentUserId()` |
| 1.3 | 改造 notebook 工具读 userId | `list-notebook.ts`, `write-note.ts` | `_userId` → `getCurrentUserId()` |
| 1.4 | turns route 包裹 agent loop | `app/api/v1/turns/route.ts` | `runWithToolContext({userId, sessionId, turnId}, ...)` |
| 1.5 | 更新 bootstrap.ts | `lib/deeptutor/bootstrap.ts` | 移除 `defaultUserId` 参数传递 |
| 1.6 | 注入 memoryContext | `app/api/v1/turns/route.ts` | 预读 L3 并传入 context |
| 1.7 | 实现 Entity 类型 | `lib/deeptutor/services/memory/snapshot.ts` | Entity, ChangeEntry 接口 |
| 1.8 | 实现 Chat Snapshot Adapter | `lib/deeptutor/services/memory/snapshot.ts` | readChatEntities (Prisma)，含分页和超时 |
| 1.9 | 实现 Diff 算法 | `lib/deeptutor/services/memory/snapshot.ts` | diffSnapshots |
| 1.10 | 实现 Snapshot Store | `lib/deeptutor/services/memory/snapshot-store.ts` | state.json / changes.jsonl 读写 |
| 1.11 | 集成 Snapshot 到 MemorySubscriber | `lib/deeptutor/services/memory-subscriber.ts` | CAPABILITY_COMPLETE → refreshSnapshot → emitTrace |
| 1.12 | 迁移现有 anonymous 数据 | 一次性脚本 | 将 `data/memory/anonymous/` 下的文件移到对应用户目录 |
| 1.13 | 测试验证 | - | 确认 L1 trace 自动产生，userId 正确隔离，并发安全 |

**验收**: 用户聊 3 轮后，`data/memory/{userId}/L1/chat.jsonl` 有自动写入的 trace 事件；两个并发请求的 userId 不会互相干扰。

### 第二阶段：Consolidator LLM 提取（质量提升）

**目标**: L1 trace → L2 结构化事实 → L3 跨 surface 合成

**任务**:

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | 实现 Document 模型 | `lib/deeptutor/services/memory/document.ts` | parse/serialize/Entry/Section |
| 2.2 | 实现 Ops 操作 | `lib/deeptutor/services/memory/ops.ts` | AddOp/EditOp/DeleteOp + validate + apply |
| 2.3 | 实现 ULID 生成 | `lib/deeptutor/services/memory/ids.ts` | newEntryId/newTraceId |
| 2.4 | 实现 Chunker | `lib/deeptutor/services/memory/chunker.ts` | 字符级分块 + 边界扩展 |
| 2.5 | 编写 L2/L3 提示词（中文） | `lib/deeptutor/services/memory/prompts/zh/` | update_l2.yaml + update_l3.yaml |
| 2.6 | 编写 L2/L3 提示词（英文） | `lib/deeptutor/services/memory/prompts/en/` | update_l2.yaml + update_l3.yaml |
| 2.7 | 实现 Consolidator 核心 | `lib/deeptutor/services/memory/consolidator.ts` | runUpdateL2 + runUpdateL3 |
| 2.8 | 实现 Meta 管理 | `lib/deeptutor/services/memory/meta.ts` | l2-meta.json / l3-meta.json 增量追踪 |
| 2.9 | 实现 preferences 自动引导 | `lib/deeptutor/capabilities/chat/chat-capability.ts` | memoryContext 注入时追加引导文本 |
| 2.10 | 替换 MemoryServiceImpl.consolidate | `lib/deeptutor/services/memory.ts` | 从简单拼接改为 LLM 提取 |
| 2.11 | 扩展 Memory API | `app/api/v1/memory/` | 新增 consolidate/update 端点 |
| 2.12 | 测试验证 | - | 确认 L2/L3 有结构化事实 |

**验收**: 用户聊 10 轮后，`data/memory/{userId}/L2/chat.md` 包含 LLM 提取的事实条目（带 entry ID 和 ref），`L3/recent.md` 包含合成内容。

### 第三阶段：优化、扩展与数据库迁移

**目标**: 去重、审计、更多 surface、Memory Workbench UI、数据库迁移、前端 store 升级

**任务**:

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | 实现 Dedup 模式 | L2/L3 去重（LLM 驱动） |
| 3.2 | 实现 Audit 模式 | L2/L3 审计（LLM 对比原始证据） |
| 3.3 | Quiz Snapshot Adapter | 从 LearningQuizAttempt 采集答题数据 |
| 3.4 | Profile Snapshot Adapter | 从 LearningProfile/LearningSkillMastery 采集 |
| 3.5 | Memory Workbench UI | 前端页面查看/编辑/触发 consolidate |
| 3.6 | 实现 DatabaseMemoryAdapter | Prisma CRUD 替代文件读写 |
| 3.7 | 数据迁移脚本 | 文件 → memory_entries 表 |
| 3.8 | 前端 memory-store V1→V2 | 从 localStorage 改为服务端同步 |
| 3.9 | Notebook/其他 surface 的 Snapshot | 扩展 Snapshot 到 notebook/quiz/kb 等 surface |

## 6.2 阶段依赖关系

```
第一阶段 (1.1-1.13)
    │
    ├── 独立可用: L1 有数据，read_memory 能读到 trace，并发安全
    │
    ▼
第二阶段 (2.1-2.12)
    │
    ├── 独立可用: L2/L3 有结构化记忆，LLM 个性化回复，preferences 有引导
    │
    ▼
第三阶段 (3.1-3.9)
    │
    └── 完整体验: 去重/审计/多 surface/Workbench UI/数据库持久化
```

每个阶段结束都是一个可用状态，不依赖下一阶段即可运行。

## 6.3 回归风险控制

- 第一阶段不修改 `MemoryServiceImpl` 的现有方法签名，只新增 Snapshot 相关方法
- 第二阶段替换 `consolidate` 方法时，保留旧的 `rollupL1ToL2` 和 `synthesizeL3Recent` 作为 fallback，通过环境变量 `MEMORY_CONSOLIDATOR=v1|v2` 切换
- 第三阶段的 Dedup/Audit 不影响核心数据流，可以独立开关
- 数据库迁移通过 `MEMORY_BACKEND=file|database` 环境变量切换，支持回退

## 6.4 新增依赖

| 依赖 | 用途 | 阶段 |
|------|------|------|
| `node:async_hooks` | AsyncLocalStorage（Node.js 内置，无需安装） | 第一阶段 |
| `yaml` | 解析 YAML 提示词模板 | 第二阶段 |
| 无其他外部依赖 | - | - |

所有核心逻辑（AsyncLocalStorage、Document、Ops、Chunker、Consolidator）均为纯 TypeScript 实现或使用 Node.js 内置模块，不引入额外运行时依赖。

## 6.5 现有 anonymous 数据迁移

第一阶段完成后，`data/memory/anonymous/` 目录下可能已有测试阶段积累的文件。迁移策略：

1. **扫描所有 DtSession**，按 userId 分组，获取 `userId → sessionId[]` 映射
2. **检查 `data/memory/anonymous/L1/`** 中的 chat.jsonl，按 sessionId 字段分流到各用户目录
3. **对于无法匹配到 userId 的 sessionId**（测试数据），保留在 `data/memory/anonymous/` 中不迁移
4. 迁移脚本支持 `--dry-run` 模式，先预览再执行

```bash
npx ts-node scripts/migrate-anonymous-memory.ts --dry-run
npx ts-node scripts/migrate-anonymous-memory.ts --execute
```
