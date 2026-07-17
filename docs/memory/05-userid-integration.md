# 5. UserId 修复与集成

## 5.1 当前问题

`bootstrap.ts:252-258` 中：

```ts
// Set tool contexts (user defaults to 'anonymous' — overridden per-turn by agent loop)
const defaultUserId = 'anonymous';
setSandboxToolContext(sandboxService);
setReadMemoryContext(memoryService, defaultUserId);
setWriteMemoryContext(memoryService, defaultUserId);
setListNotebookContext(notebookService, defaultUserId);
setWriteNoteContext(notebookService, defaultUserId);
```

`_userId` 在 bootstrap 时设为 `'anonymous'`，之后**再无更新**。`WriteMemoryTool.execute()`、`ReadMemoryTool.execute()`、`ListNotebookTool.execute()`、`WriteNoteTool.execute()` 始终使用 `'anonymous'`。

代码注释声称 "overridden per-turn by agent loop"，但 `orchestrator.ts` 中并未实现该覆盖逻辑。

## 5.2 修复方案：AsyncLocalStorage 请求级隔离

### 为什么不用模块级变量 + try/finally

原方案提议在 agent loop 入口设置模块级 `_userId`，在 `finally` 块中重置。**这在并发场景下不安全**。

Node.js 虽然是单线程事件循环，但 `agent-loop.ts` 中有大量 `await` 点（LLM API 调用、工具执行、流式传输）。在任何一个 `await` 点，事件循环都可以暂停当前请求、去服务另一个用户的请求。此时另一个请求的 `setWriteMemoryContext` 会覆盖模块级 `_userId`，当原请求从 `await` 恢复时，读到的就是错误的 userId。

```
时间线：
  请求A: setUserId("user-A") → await llmCall() → ...暂停...
  请求B:                                    setUserId("user-B") → await llmCall() → ...
  请求A:                                    ...恢复→ writeMemory()  ← 用的是 "user-B"！
```

这不是"低概率"事件——在多用户并发时是**必然发生**的。

### 正确方案：AsyncLocalStorage

Node.js 内置的 `AsyncLocalStorage` 可以在整个异步调用链中传递上下文，不受并发请求干扰。每个请求在自己的异步上下文中运行，互不影响。

```typescript
// lib/deeptutor/context/tool-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface ToolContext {
  userId: string;
  sessionId?: string;
  turnId?: string;
}

const toolContextStore = new AsyncLocalStorage<ToolContext>();

export function runWithToolContext<T>(context: ToolContext, fn: () => T): T {
  return toolContextStore.run(context, fn);
}

export function getToolContext(): ToolContext | undefined {
  return toolContextStore.getStore();
}

export function getCurrentUserId(): string {
  return getToolContext()?.userId ?? 'anonymous';
}
```

### 修改点

**1. turns route 中包裹 agent loop**

在 `app/api/v1/turns/route.ts` 中，用 `runWithToolContext` 包裹整个 agent loop：

```typescript
import { runWithToolContext } from '@/lib/deeptutor/context/tool-context';

// 在 executeTurn 中
const userId = req.headers.get('x-user-id') ?? 'anonymous';

await runWithToolContext({ userId, sessionId, turnId }, async () => {
  // 整个 agent loop 在此闭包内运行
  // 所有工具调用都能通过 getCurrentUserId() 拿到正确的 userId
  await runAgentLoop(context);
});
```

**2. 工具内部读取 userId**

修改 `write-memory.ts`、`read-memory.ts`、`list-notebook.ts`、`write-note.ts`，将模块级 `_userId` 替换为 `getCurrentUserId()`：

```typescript
// write-memory.ts (修改前)
let _userId = 'anonymous';
export function setWriteMemoryContext(svc: MemoryService, userId: string) {
  _service = svc;
  _userId = userId;
}
async function execute(...) {
  await _service.writeL1(_userId, ...);  // 不安全
}

// write-memory.ts (修改后)
import { getCurrentUserId } from '@/lib/deeptutor/context/tool-context';

let _service: MemoryService;
export function setWriteMemoryContext(svc: MemoryService) {
  _service = svc;
  // 不再设置 userId，由 AsyncLocalStorage 提供
}
async function execute(...) {
  const userId = getCurrentUserId();  // 从 AsyncLocalStorage 读取，并发安全
  await _service.writeL1(userId, ...);
}
```

**3. 向后兼容**

保留 `setWriteMemoryContext` 和 `setReadMemoryContext` 的函数签名（只传 service，不传 userId），避免破坏 bootstrap.ts 的调用。`setSandboxToolContext` 不涉及 userId，无需修改。

```typescript
// bootstrap.ts (修改后)
setSandboxToolContext(sandboxService);
setReadMemoryContext(memoryService);   // 不再传 defaultUserId
setWriteMemoryContext(memoryService);  // 不再传 defaultUserId
setListNotebookContext(notebookService);  // 不再传 defaultUserId
setWriteNoteContext(notebookService);     // 不再传 defaultUserId
```

**4. MemorySubscriber 中传递 userId**

`memory-subscriber.ts` 的 `CapabilityCompletePayload` 已经包含 `userId` 字段。当前 `consolidate` 调用已正确传递：

```typescript
memoryService.consolidate(payload.userId, surface)
```

此处无需修改，但 Consolidator 内部的 LLM 调用也需要包裹在 `runWithToolContext` 中（如果它调用了依赖 userId 的服务方法）。

**5. Snapshot 采集时使用 userId**

新增的 Snapshot 适配器通过参数接收 userId，不依赖模块级变量：

```typescript
async readChatEntities(userId: string): Promise<Entity[]>
async refreshSnapshot(userId: string, surface: Surface): Promise<ChangeEntry[]>
```

## 5.3 修复范围总结

| 工具 | 文件 | 修改内容 |
|------|------|----------|
| write_memory | `lib/deeptutor/tools/write-memory.ts` | `_userId` → `getCurrentUserId()` |
| read_memory | `lib/deeptutor/tools/read-memory.ts` | `_userId` → `getCurrentUserId()` |
| list_notebook | `lib/deeptutor/tools/list-notebook.ts` | `_userId` → `getCurrentUserId()` |
| write_note | `lib/deeptutor/tools/write-note.ts` | `_userId` → `getCurrentUserId()` |
| turns route | `app/api/v1/turns/route.ts` | 用 `runWithToolContext` 包裹 agent loop |
| bootstrap | `lib/deeptutor/bootstrap.ts` | 移除 `defaultUserId` 参数传递 |
| 新增 | `lib/deeptutor/context/tool-context.ts` | AsyncLocalStorage 基础设施 |

## 5.4 memoryContext 注入

当前 `chat-capability.ts:105` 调用 `assembleSystemPrompt` 时传入了 `memoryContext`，但 turns route 中 `createUnifiedContext` 没有设置它。

### 修改

在 turns route 构建 context 时，预读 L3 记忆并注入：

```typescript
const memoryService = getMemoryService();
const userId = getCurrentUserId(); // 此时已在 runWithToolContext 内
const memoryContext = await memoryService.readAllL3(userId);

const context: UnifiedContext = {
  // ... 现有字段
  memoryContext: memoryContext || undefined,
};
```

这使 LLM 在对话中能看到用户的已有记忆，并据此个性化回复。结合 §4.5 的自动引导机制，还能引导 LLM 在合适时调用 `write_memory` 更新偏好。

## 5.5 前端 memory-store 过渡

当前 `memory-store.ts` 使用 Zustand `persist` 中间件以 localStorage 方式存储（key: `sl-memory-storage`），属于 V1 store 模式（无 userId 隔离）。

**第一阶段**：不修改 memory-store，后端 API 通过 `x-user-id` header 自动隔离数据。

**第三阶段**：将 memory-store 迁移到 V2 模式（经 `/api/v1/memory` 端点读写、按 userId 过滤），与 session-store / settings-store 的 V2 模式对齐。具体方案：
1. 新增 `syncFromServer()` 方法，调用 `GET /api/v1/memory` 获取当前用户的记忆
2. 移除 `persist` 中间件的 localStorage 存储，改为每次页面加载时从服务端同步
3. 前端展示组件改为读取 V2 store 数据
