# 1. 问题与现状分析

## 1.1 用户报告的问题

用户使用系统半天，三层记忆系统没有任何数据存入。`data/memory/` 目录完全不存在。

## 1.2 现有架构

SmartLearn 当前的三层记忆系统位于 `lib/deeptutor/services/memory.ts`，设计如下：

| 层级 | 存储路径 | 内容 | 写入方式 |
|------|----------|------|----------|
| L1 (Trace) | `data/memory/{userId}/L1/{surface}.jsonl` | 追加式事件日志 | `write_memory` 工具调用时写入 |
| L2 (Summary) | `data/memory/{userId}/L2/{surface}.md` | Surface 级摘要 | consolidate 时简单拼接 |
| L3 (Synthesis) | `data/memory/{userId}/L3/{slot}.md` | 跨 Surface 合成 (4 slot) | `write_memory` 写 preferences / consolidate 写 recent |

数据流设计：

```
用户聊天 → LLM 调用 write_memory → 写 L1 trace + L3/preferences
能力结束 → CAPABILITY_COMPLETE 事件 → MemorySubscriber 触发 consolidate()
consolidate: L1 trace 简单拼接为 L2 → L2 截断拼入 L3/recent
```

### 已有的 MemoryEntry 数据库模型（未使用）

Prisma schema 中已定义 `MemoryEntry` 模型（`prisma/schema.prisma:534-554`），设计了完整的 `memory_entries` 表结构：

```prisma
model MemoryEntry {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  layer     String   // 'L1' | 'L2' | 'L3'
  surface   String?
  slot      String?
  kind      String?
  content   String
  payload   Json?
  tags      String[] @default([])
  sessionId String?  @map("session_id")
  turnId    String?  @map("turn_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId, layer])
  @@index([userId, layer, surface])
  @@map("memory_entries")
}
```

该模型含 `userId` 过滤、`layer+surface` 复合索引、`payload` JSON 字段，设计合理，**但当前完全未被使用**。现有的 `MemoryServiceImpl` 仅使用文件系统，本方案短期内继续文件系统路线（降低第一阶段风险），在第三阶段规划向数据库迁移（详见 §2.7）。

## 1.3 五个断点

### 断点 1：userId 硬编码为 'anonymous'

**位置**: `lib/deeptutor/bootstrap.ts:252-258`

```ts
// Set tool contexts (user defaults to 'anonymous' — overridden per-turn by agent loop)
const defaultUserId = 'anonymous';
setSandboxToolContext(sandboxService);
setReadMemoryContext(memoryService, defaultUserId);
setWriteMemoryContext(memoryService, defaultUserId);
setListNotebookContext(notebookService, defaultUserId);
setWriteNoteContext(notebookService, defaultUserId);
```

`write_memory`、`read_memory`、`list_notebook`、`write_note` 四个工具的 `_userId` 在 bootstrap 时设为 `'anonymous'`，之后**没有任何代码更新它**。代码注释声称 "overridden per-turn by agent loop"，但 `orchestrator.ts` 中**并未实现这个覆盖逻辑**。

即使用户已登录、turns route 拿到了真实 userId，工具仍然使用 `'anonymous'`。

**影响**: 所有记忆写入 `data/memory/anonymous/`，notebook 笔记也写入 `anonymous` 用户目录。

### 断点 2：LLM 从未主动调用 write_memory

这是最根本的问题。`write_memory` 和 `read_memory` 被列为 `CONTEXT_AUTO_TOOLS`（见 `lib/deeptutor/tools/composition.ts`），出现在每次对话的工具列表中。但：

1. **系统提示词中没有引导 LLM 使用记忆工具**。`chat-capability.ts:101-108` 调用 `assembleSystemPrompt` 时，`memoryContext` 参数来自 `context.memoryContext`，而 turns route 中的 `createUnifiedContext` **没有设置 `memoryContext`**。
2. **LLM 在实际对话中几乎不会主动判断"这个信息值得存入长期记忆"**。工具的 description 说"当用户分享重要偏好时使用"，但大多数模型倾向于直接回答而非主动存储。

**影响**: `data/memory/` 目录完全不存在，说明 `write_memory` 从未被成功调用过。

### 断点 3：consolidate 是简单文本拼接，无 LLM 参与

**位置**: `lib/deeptutor/services/memory.ts:247-281`

当前的 `rollupL1ToL2` 和 `synthesizeL3Recent` 是纯文本操作：
- L1→L2：将事件 JSON 直接拼接为 markdown 列表
- L2→L3：截取每个 L2 最后 800 字符拼接

对比 DeepTutor Python 版的 consolidator：
- L2 Update：用 LLM 从新实体中提取结构化事实 `{facts: [{text, section, refs}]}`
- L3 Update：用 LLM 从 L2 条目合成跨 surface 洞察
- 有 ref 引用链（L3→L2→L1）、去重（dedup）、审计（audit）

**影响**: 即使 L1 有数据，consolidate 产出的 L2/L3 也只是原始日志的复制粘贴，没有信息提取和压缩。

### 断点 4：CAPABILITY_COMPLETE → consolidate 链路存在但 L1 为空

`lib/deeptutor/core/orchestrator.ts` 在 capability 完成时 emit `CAPABILITY_COMPLETE` 事件，payload 包含 `{turnId, sessionId, userId, capability}`。`memory-subscriber.ts` 确实监听了该事件并传递 `payload.userId` 给 `consolidate()`。但 consolidate 的前提是 L1 有 trace 事件——而 L1 trace 只在 `write_memory` 被调用时写入。如果 `write_memory` 从未被调用（断点 2），L1 就是空的，consolidate 无数据可处理。

### 断点 5：Notebook 工具有相同的 userId 硬编码问题

`bootstrap.ts:257-258` 中 `setListNotebookContext` 和 `setWriteNoteContext` 同样接收 `defaultUserId = 'anonymous'`，且无任何后续覆盖。这意味着用户的笔记也会存到 `anonymous` 用户下，与断点 1 完全相同的根因。原方案仅关注 Memory 工具，遗漏了 Notebook 工具。

## 1.4 与 DeepTutor Python 版的核心差异

| 维度 | Python DeepTutor | TS SmartLearn |
|------|------------------|---------------|
| **L1 数据来源** | Snapshot 自动采集工作区数据 | 仅靠 LLM 调用 write_memory |
| **L2 生成方式** | Consolidator LLM 提取结构化事实 | 纯文本拼接 |
| **L3 生成方式** | Consolidator LLM 从 L2 合成 | 仅 preferences 由 write_memory 写 |
| **触发方式** | Workbench 手动 / TutorBot token 压力自动 | CAPABILITY_COMPLETE 事件（但 L1 为空） |
| **数据质量** | 有 ref 引用链、去重、审计 | 无引用链、无去重 |
| **userId** | PathService 按用户隔离 | 硬编码 'anonymous'（memory + notebook 均受影响） |
| **核心机制** | **被动采集 + 主动提取** | **被动等待 LLM 自觉调用** |
| **数据库模型** | N/A | 有 MemoryEntry 表但未使用 |

## 1.5 根因总结

**根因链**: LLM 几乎不主动调用 write_memory → L1 trace 为空 → consolidate 无数据 → L2/L3 均为空 → `data/memory/` 目录不存在。

**加剧因素**:
1. userId 硬编码为 'anonymous'，memory 和 notebook 工具均受影响，即使有数据也存错位置
2. consolidate 是简单文本拼接，即使有数据质量也低
3. 没有任何自动采集机制确保数据入口不依赖 LLM 配合
4. 已有 MemoryEntry 数据库模型但未被任何代码消费，造成"设计就绪、实现缺失"的断层
