# 3. Snapshot 自动采集层

## 3.1 设计目标

Snapshot 层的核心作用：**不依赖 LLM 配合，从已有数据源自动采集用户交互数据**，作为记忆系统的确定性数据入口。

在 DeepTutor Python 版中，Snapshot 通过读取文件系统/SQLite 采集 7 个 surface 的数据。SmartLearn 的数据存储在 PostgreSQL 中，需要用 Prisma 替代文件读取。

## 3.2 数据源分析

### 当前可用的 Prisma 模型

| 模型 | 对应 Surface | 数据内容 | 优先级 |
|------|-------------|---------|--------|
| DtMessage | chat | 用户/助手对话消息 | **P0 (第一阶段)** |
| DtSession | chat | 会话元数据 | P0 |
| LearningQuizAttempt | quiz | 答题记录 | P1 (第二阶段) |
| LearningSkillMastery | profile | 知识掌握度 | P1 |
| LearningProfile | profile | 学习画像维度 | P1 |
| Resource | scope | 学习资源 | P2 (第三阶段) |
| LearningPath | scope | 学习路径 | P2 |

### DtMessage 结构（P0 核心数据源）

```prisma
model DtMessage {
  id               Int             @id @default(autoincrement())
  sessionId        String
  role             DtMessageRole   // user | assistant | system | tool
  content          String
  capability       String?
  turnId           String?
  userId           String
  createdAt        DateTime
  // ... attachments, metadata, parentMessageId
}
```

这是最丰富的数据源：每条用户消息和助手回复都是潜在的记忆素材。

## 3.3 Entity 模型

```typescript
interface Entity {
  id: string;          // 实体唯一 ID (sessionId)
  label: string;       // 人类可读标题
  ts: string;          // ISO 时间戳
  content: string;     // 实体正文内容 (拼接后的消息)
  metadata: Record<string, unknown>;
  fingerprint: string; // SHA-1 内容指纹 (用于变更检测)
}
```

```typescript
interface ChangeEntry {
  ts: string;
  kind: 'added' | 'modified' | 'removed';
  entityId: string;
  label: string;
  prevFingerprint: string | null;
  newFingerprint: string | null;
}
```

## 3.4 Chat Snapshot Adapter

### 读取逻辑

```typescript
const SNAPSHOT_PAGE_SIZE = 50;      // 每次查询的 session 数量
const MAX_MESSAGES_PER_SESSION = 500; // 每个 session 最多采集的消息数
const SNAPSHOT_QUERY_TIMEOUT = 10000; // 查询超时 10s

async function readChatEntities(userId: string): Promise<Entity[]> {
  // 1. 分页查询该用户的 DtSession（避免大量 session 时一次性加载）
  const sessions = await prisma.dtSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: SNAPSHOT_PAGE_SIZE,
  });

  // 2. 对每个 session，查询其 DtMessage（限量 + 超时保护）
  const entities: Entity[] = [];
  for (const session of sessions) {
    let messages: DtMessage[];
    try {
      messages = await prisma.dtMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: MAX_MESSAGES_PER_SESSION,
      });
    } catch (err) {
      // 单个 session 查询失败不影响其他 session
      console.warn(`[Snapshot] Failed to read messages for session ${session.id}:`, err);
      continue;
    }

    // 3. 拼接消息为 Entity.content
    const blocks: string[] = [];
    let lastMessageId: number | null = null;
    for (const msg of messages) {
      const body = msg.content?.trim();
      if (!body) continue;
      blocks.push(`### ${msg.role}\n${body}`);
      lastMessageId = msg.id; // 取最后一条非空消息的自增 ID
    }

    if (blocks.length === 0) continue;

    // 4. 计算 fingerprint:
    //    使用最后一条非空消息的 ID + session.updatedAt 作为变更标识
    //    - lastMessageId: 该 session 中最后一条有内容的消息的自增主键 (DtMessage.id)
    //    - session.updatedAt: session 的最后更新时间
    //    两者组合可检测新消息追加和已有消息修改两种变更
    const fingerprintInput = `${lastMessageId ?? 'none'}:${session.updatedAt.toISOString()}`;
    const fingerprint = sha1(fingerprintInput);

    entities.push({
      id: session.id,
      label: session.title || session.id,
      ts: session.updatedAt.toISOString(),
      content: blocks.join('\n\n'),
      metadata: {
        sessionId: session.id,
        messageCount: messages.length,
        lastMessageId,
      },
      fingerprint,
    });
  }

  return entities;
}
```

### 增量查询优化

对于已经采集过的 session，只查询 `updatedAt > lastRefresh` 的部分：

```typescript
async function readChatEntitiesIncremental(
  userId: string,
  lastRefresh: Date
): Promise<Entity[]> {
  // 只查询自上次采集以来有更新的 session
  const sessions = await prisma.dtSession.findMany({
    where: {
      userId,
      updatedAt: { gt: lastRefresh },
    },
    orderBy: { updatedAt: 'desc' },
    take: SNAPSHOT_PAGE_SIZE,
  });

  // ... 同 readChatEntities 的消息处理逻辑
}
```

### 增量检测（Diff）

Snapshot 系统维护一个 `state.json`（位于 `data/memory/{userId}/snapshot/chat/state.json`），记录每个 Entity 的 fingerprint：

```json
{
  "fingerprints": { "session_abc123": "a1b2c3d4...", "session_def456": "e5f6g7h8..." },
  "labels": { "session_abc123": "Python 学习", "session_def456": "算法讨论" },
  "lastRefresh": "2026-07-16T12:00:00Z"
}
```

每次 Snapshot 刷新时：
1. 读取当前 Entity 列表，计算每个 Entity 的 fingerprint
2. 与 `state.json` 中的旧 fingerprint 比较
3. fingerprint 变化 = `modified`，新 Entity = `added`，消失 = `removed`
4. 将变更记录到 `changes.jsonl`
5. 更新 `state.json`

### 自动 emitTrace

当 Diff 检测到新/修改的 Entity 时，对每个变更自动调用：

```typescript
await memoryService.emitTrace(userId, {
  surface: 'chat',
  kind: 'snapshot_change',  // 'added' | 'modified' | 'removed'
  payload: { entityId, label, changeKind },
  sessionId: entityId,
});
```

这确保了 L1 trace **不依赖 LLM 调用 write_memory**，而是由 Snapshot 驱动自动写入。

## 3.5 快照刷新时机

| 触发点 | 方式 | 说明 |
|--------|------|------|
| CAPABILITY_COMPLETE 事件 | 自动 | MemorySubscriber 中触发 |
| 用户打开 Memory 页面 | 自动 | 前端加载时触发 |
| 手动点击 "Refresh" 按钮 | 手动 | Memory 页面提供 |

## 3.6 错误处理

Snapshot 层采用 **fire-and-forget** 模式，任何失败不应阻塞对话响应：

```typescript
async function refreshSnapshotSafe(userId: string, surface: Surface): Promise<ChangeEntry[]> {
  try {
    return await refreshSnapshot(userId, surface);
  } catch (err) {
    console.error(`[Snapshot] refreshSnapshot failed for user=${userId} surface=${surface}:`, err);
    return []; // 返回空变更，不影响后续流程
  }
}
```

具体的容错策略：

| 场景 | 处理方式 |
|------|----------|
| 数据库连接失败 | catch 后返回空变更，下次 CAPABILITY_COMPLETE 自动重试 |
| 单个 session 查询超时 | 跳过该 session（`continue`），处理其他 session |
| `state.json` 文件损坏 | 视为首次采集（全部 Entity 标记为 `added`） |
| 消息量超大（单 session 上千条） | `take: MAX_MESSAGES_PER_SESSION` 截断，`metadata` 中标记 `truncated: true` |

## 3.7 文件清单

| 文件 | 说明 |
|------|------|
| `lib/deeptutor/services/memory/snapshot.ts` | Entity/ChangeEntry 类型 + readChatEntities + readChatEntitiesIncremental + diffSnapshots + refreshSnapshot |
| `lib/deeptutor/services/memory/snapshot-store.ts` | state.json / changes.jsonl 的读写持久化 |

## 3.8 与 DeepTutor Python 版的对应关系

| Python | TS SmartLearn | 差异 |
|--------|---------------|------|
| `snapshot/adapters.py::read_chat_entities()` | `snapshot.ts::readChatEntities()` | Python 读 SQLite，TS 读 Prisma；TS 增加了分页和超时 |
| `snapshot/diff.py::diff_snapshots()` | `snapshot.ts::diffSnapshots()` | 逻辑相同 |
| `snapshot/store.py` | `snapshot-store.ts` | 逻辑相同 |
| `snapshot/entity.py` | `snapshot.ts` (类型定义) | 合并到同一文件 |
| 7 个 Surface Adapter | 仅 chat adapter | 第一阶段只做 chat |
