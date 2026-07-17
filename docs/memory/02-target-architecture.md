# 2. 目标架构设计

## 2.1 设计原则

1. **数据入口不依赖 LLM 配合** — 采用 Snapshot 自动采集，而非等待 LLM 主动调 write_memory
2. **LLM 只用于信息提取，不用于信息入口** — Consolidator 用 LLM 提取事实，但数据来源是确定性的
3. **渐进式实现** — 先做 chat surface，再扩展其他 surface
4. **复用现有代码** — 尽量在现有 MemoryServiceImpl 上扩展，而非重写
5. **并发安全优先** — 从第一阶段就使用 AsyncLocalStorage 做 userId 隔离，不依赖模块级变量的 try/finally 方案
6. **品牌统一** — 全部使用 "SmartLearn" 品牌名，仅在引用 Python 参考实现时使用 "DeepTutor"

## 2.2 新的三层数据流

```
┌─────────────────────────────────────────────────────────┐
│  Snapshot Layer (新增)                                    │
│                                                          │
│  PostgreSQL (DtMessage) ──→ SnapshotAdapter ──→ Entity[] │
│         ↑                      ↑                         │
│    用户自然聊天          自动采集，无需LLM配合              │
└──────────────────────────┬──────────────────────────────┘
                           │ 新实体 (增量)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  L1 — Trace (保留，改为 Snapshot 驱动写入)                 │
│                                                          │
│  data/memory/{userId}/L1/chat.jsonl                      │
│  每个 Entity 变更自动 emitTrace                           │
└──────────────────────────┬──────────────────────────────┘
                           │ 新 trace 事件
                           ▼
┌─────────────────────────────────────────────────────────┐
│  L2 — Summary (改造：纯文本拼接 → LLM事实提取)             │
│                                                          │
│  data/memory/{userId}/L2/chat.md                         │
│  Consolidator L2 Update:                                 │
│    chunk → LLM → {facts: [{text, section, refs}]}        │
│    → AddOp → Document → 原子写入                          │
└──────────────────────────┬──────────────────────────────┘
                           │ 新 L2 条目
                           ▼
┌─────────────────────────────────────────────────────────┐
│  L3 — Synthesis (改造：截断拼接 → LLM跨surface合成)       │
│                                                          │
│  data/memory/{userId}/L3/recent.md    近期重要事件        │
│  data/memory/{userId}/L3/profile.md   用户画像与学习风格  │
│  data/memory/{userId}/L3/scope.md     知识范围与掌握程度  │
│  data/memory/{userId}/L3/preferences.md  用户偏好         │
│                                                          │
│  Consolidator L3 Update:                                 │
│    L2 新条目 → chunk → LLM → 合成到对应 slot              │
│  write_memory 工具:                                      │
│    仍可写 L3/preferences（保留）                          │
│  L3 注入 system prompt:                                  │
│    引导 LLM 识别偏好并调用 write_memory                   │
└─────────────────────────────────────────────────────────┘
```

## 2.3 触发时机

| 触发点 | 动作 | 说明 |
|--------|------|------|
| 每轮对话结束 (CAPABILITY_COMPLETE) | Snapshot 采集 → emitTrace | 自动采集新消息作为 L1 事件 |
| 每轮对话结束 (CAPABILITY_COMPLETE) | consolidate (L1→L2→L3) | 仅在 L1 新事件 ≥ 3 条时触发 L2 Update |
| 用户在 Memory 页面点击 "Update" | 手动触发 consolidate | 提供预算和模型选择 |
| write_memory 工具被调用 | 写 L3/preferences + emitTrace | 保留现有行为 |
| L3 memoryContext 注入 system prompt | 引导 LLM 主动调用 write_memory | 解决 preferences 长期为空的问题 |

## 2.4 新增模块清单

| 模块 | 文件路径 | 说明 |
|------|----------|------|
| SnapshotAdapter | `lib/deeptutor/services/memory/snapshot.ts` | 从 Prisma 采集 DtMessage |
| Entity 类型 | `lib/deeptutor/services/memory/snapshot.ts` | Entity, ChangeEntry 类型 |
| Diff 算法 | `lib/deeptutor/services/memory/snapshot.ts` | 快照差分检测新增/修改 |
| Document 模型 | `lib/deeptutor/services/memory/document.ts` | L2/L3 的 markdown 文档模型 |
| Consolidator | `lib/deeptutor/services/memory/consolidator.ts` | L2/L3 Update 主逻辑 |
| Prompt 模板 | `lib/deeptutor/services/memory/prompts/` | update_l2, update_l3 的 YAML 提示词 |
| Ops 操作 | `lib/deeptutor/services/memory/ops.ts` | Add/Edit/Delete 原子操作 |
| Meta 管理 | `lib/deeptutor/services/memory/meta.ts` | L2/L3 Consolidator 增量追踪 |
| Memory API 扩展 | `app/api/v1/memory/` | 新增 snapshot/consolidate 端点 |
| AsyncLocalStorage 上下文 | `lib/deeptutor/context/tool-context.ts` | 请求级 userId 隔离 |

## 2.5 保留不变的部分

| 组件 | 文件 | 保留原因 |
|------|------|----------|
| MemoryServiceImpl | `lib/deeptutor/services/memory.ts` | 在其上扩展，不重写 |
| WriteMemoryTool | `lib/deeptutor/tools/write-memory.ts` | 仍可作为 LLM 主动写入 preferences 的路径 |
| ReadMemoryTool | `lib/deeptutor/tools/read-memory.ts` | 读取逻辑不变 |
| MemorySubscriber | `lib/deeptutor/services/memory-subscriber.ts` | 触发逻辑不变，增强 consolidate 调用 |
| Memory API Route | `app/api/v1/memory/route.ts` | 扩展端点，不破坏现有 API |
| memory-store.ts | `lib/store/memory-store.ts` | 前端状态管理不变（V1→V2 过渡见 §5.5 及路线图第三阶段任务 3.8） |

## 2.6 目录布局（改造后）

```
data/memory/{userId}/
  L1/
    chat.jsonl              ← 由 Snapshot 自动写入
  L2/
    chat.md                 ← Consolidator L2 Update 输出
    l2-meta.json            ← L2 Consolidator 增量追踪 { seenEntityRefs, lastUpdateAt }
  L3/
    recent.md               ← Consolidator L3 Update 输出
    profile.md              ← Consolidator L3 Update 输出
    scope.md                ← Consolidator L3 Update 输出
    preferences.md          ← write_memory 工具写入 + Consolidator 引导
    l3-meta.json            ← L3 Consolidator 增量追踪 { seenL2EntryIds, lastUpdateAt }
  snapshot/
    chat/
      state.json            ← 快照状态 { fingerprints: {entityId → hash}, labels, lastRefresh }
      changes.jsonl         ← 变更日志
```

**Meta 文件命名规范**：
- `state.json` — Snapshot 层的状态追踪文件，位于 `snapshot/{surface}/state.json`
- `l2-meta.json` — L2 Consolidator 的增量追踪，位于 `L2/l2-meta.json`
- `l3-meta.json` — L3 Consolidator 的增量追踪，位于 `L3/l3-meta.json`

三者职责清晰：`state.json` 追踪 Entity fingerprint 变化，`l2-meta.json` 追踪已处理的 Entity refs，`l3-meta.json` 追踪已处理的 L2 entry IDs。

## 2.7 MemoryEntry 数据库迁移策略

### 现状

Prisma schema 中 `MemoryEntry` 模型（`prisma/schema.prisma:534-554`）已定义了完善的表结构，含 `userId`、`layer`、`surface`、`slot`、`content`、`payload`、`tags`、索引等。但当前完全未使用，`MemoryServiceImpl` 仅操作文件系统。

### 分阶段策略

| 阶段 | 策略 | 说明 |
|------|------|------|
| 第一阶段 | **仅文件系统** | Snapshot + L1 trace 写入 `data/memory/{userId}/`。降低实现复杂度，快速验证数据流 |
| 第二阶段 | **仅文件系统** | Consolidator L2/L3 写入文件。与第一阶段一致 |
| 第三阶段 | **迁移到数据库** | 实现 `DatabaseMemoryAdapter`，将文件读写替换为 Prisma CRUD。迁移现有文件数据到 `memory_entries` 表 |

### 第三阶段迁移方案（概要）

1. 实现 `DatabaseMemoryAdapter` 实现与文件版相同的接口（`readL1`, `writeL1`, `readL2`, `writeL2` 等）
2. 编写数据迁移脚本：扫描 `data/memory/` 下所有 userId 目录，将 L1 jsonl / L2 md / L3 md 解析后写入 `memory_entries`
3. 通过环境变量 `MEMORY_BACKEND=file|database` 切换后端
4. 迁移完成后默认切到 `database`，保留 `file` 模式作为回退

### 迁移收益

- 原子写入和事务支持（文件系统 `.tmp` + rename 在 Windows 上不完全原子）
- 与 DtSession/DtMessage 在同一数据库，简化备份和查询
- `userId+layer+surface` 复合索引支持高效查询
- 消除文件系统路径依赖，方便容器化部署
