# 6. 实施路线图

## 6.1 三阶段实施

### 第一阶段：数据入口修复 + Snapshot 采集（核心突破）

**目标**: 让记忆系统有数据进来，不再依赖 LLM 主动调用

**任务**:

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 修复 userId 动态注入 | `app/api/v1/turns/route.ts` | per-turn 设置 memory 工具的 userId |
| 1.2 | 添加 reset 上下文函数 | `write-memory.ts`, `read-memory.ts` | finally 块中重置为 anonymous |
| 1.3 | 注入 memoryContext | `app/api/v1/turns/route.ts` | 预读 L3 并传入 context |
| 1.4 | 实现 Entity 类型 | `lib/deeptutor/services/memory/snapshot.ts` | Entity, ChangeEntry 接口 |
| 1.5 | 实现 Chat Snapshot Adapter | `lib/deeptutor/services/memory/snapshot.ts` | readChatEntities (Prisma) |
| 1.6 | 实现 Diff 算法 | `lib/deeptutor/services/memory/snapshot.ts` | diffSnapshots |
| 1.7 | 实现 Snapshot Store | `lib/deeptutor/services/memory/snapshot-store.ts` | state.json / changes.jsonl 读写 |
| 1.8 | 集成 Snapshot 到 MemorySubscriber | `lib/deeptutor/services/memory-subscriber.ts` | CAPABILITY_COMPLETE → refreshSnapshot → emitTrace |
| 1.9 | 测试验证 | - | 确认 L1 trace 自动产生 |

**验收**: 用户聊 3 轮后，`data/memory/{userId}/L1/chat.jsonl` 有自动写入的 trace 事件。

### 第二阶段：Consolidator LLM 提取（质量提升）

**目标**: L1 trace → L2 结构化事实 → L3 跨 surface 合成

**任务**:

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | 实现 Document 模型 | `lib/deeptutor/services/memory/document.ts` | parse/serialize/Entry/Section |
| 2.2 | 实现 Ops 操作 | `lib/deeptutor/services/memory/ops.ts` | AddOp/EditOp/DeleteOp + validate + apply |
| 2.3 | 实现 ULID 生成 | `lib/deeptutor/services/memory/ids.ts` | newEntryId/newTraceId |
| 2.4 | 实现 Chunker | `lib/deeptutor/services/memory/chunker.ts` | 字符级分块 + 边界扩展 |
| 2.5 | 编写 L2 Update 提示词 | `lib/deeptutor/services/memory/prompts/zh/update_l2.yaml` | 中文版 |
| 2.6 | 编写 L3 Update 提示词 | `lib/deeptutor/services/memory/prompts/zh/update_l3.yaml` | 中文版 |
| 2.7 | 实现 Consolidator 核心 | `lib/deeptutor/services/memory/consolidator.ts` | runUpdateL2 + runUpdateL3 |
| 2.8 | 实现 Meta 管理 | `lib/deeptutor/services/memory/meta.ts` | 增量追踪 seenEntityRefs |
| 2.9 | 替换 MemoryServiceImpl.consolidate | `lib/deeptutor/services/memory.ts` | 从简单拼接改为 LLM 提取 |
| 2.10 | 扩展 Memory API | `app/api/v1/memory/` | 新增 consolidate/update 端点 |
| 2.11 | 测试验证 | - | 确认 L2/L3 有结构化事实 |

**验收**: 用户聊 10 轮后，`data/memory/{userId}/L2/chat.md` 包含 LLM 提取的事实条目（带 entry ID 和 ref），`L3/recent.md` 包含合成内容。

### 第三阶段：优化与扩展

**目标**: 去重、审计、更多 surface、Memory Workbench UI

**任务**:

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | 实现 Dedup 模式 | L2/L3 去重（LLM 驱动） |
| 3.2 | 实现 Audit 模式 | L2/L3 审计（LLM 对比原始证据） |
| 3.3 | Quiz Snapshot Adapter | 从 LearningQuizAttempt 采集答题数据 |
| 3.4 | Profile Snapshot Adapter | 从 LearningProfile/LearningSkillMastery 采集 |
| 3.5 | Memory Workbench UI | 前端页面查看/编辑/触发 consolidate |
| 3.6 | 改造 tool context 为参数传递 | 消除模块级变量的并发风险 |

## 6.2 阶段依赖关系

```
第一阶段 (1.1-1.9)
    │
    ├── 独立可用: L1 有数据，read_memory 能读到 trace
    │
    ▼
第二阶段 (2.1-2.11)
    │
    ├── 独立可用: L2/L3 有结构化记忆，LLM 个性化回复
    │
    ▼
第三阶段 (3.1-3.6)
    │
    └── 完整体验: 去重/审计/多 surface/Workbench UI
```

每个阶段结束都是一个可用状态，不依赖下一阶段即可运行。

## 6.3 回归风险控制

- 第一阶段不修改 `MemoryServiceImpl` 的现有方法签名，只新增 Snapshot 相关方法
- 第二阶段替换 `consolidate` 方法时，保留旧的 `rollupL1ToL2` 和 `synthesizeL3Recent` 作为 fallback
- 第三阶段的 Dedup/Audit 不影响核心数据流，可以独立开关

## 6.4 新增依赖

| 依赖 | 用途 | 阶段 |
|------|------|------|
| yaml | 解析 YAML 提示词模板 | 第二阶段 |
| 无其他外部依赖 | - | - |

所有核心逻辑（Document, Ops, Chunker, Consolidator）均为纯 TypeScript 实现，不引入额外运行时依赖。
