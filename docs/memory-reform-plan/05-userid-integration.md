# 5. UserId 修复与集成

## 5.1 当前问题

`bootstrap.ts:252-255` 中：

```ts
const defaultUserId = 'anonymous';
setReadMemoryContext(memoryService, defaultUserId);
setWriteMemoryContext(memoryService, defaultUserId);
```

`_userId` 在 bootstrap 时设为 `'anonymous'`，之后**再无更新**。`WriteMemoryTool.execute()` 和 `ReadMemoryTool.execute()` 始终使用 `'anonymous'`。

## 5.2 修复方案：per-turn 动态注入

参照 `setSandboxToolContext` 的模式，在每轮对话开始时（`executeTurn`）动态更新 memory 工具的 userId。

### 当前模式参考（SandboxTool）

`setSandboxToolContext` 没有 userId 参数（sandbox 不需要用户隔离），但模式类似。

### 修改点

**1. turns route 中注入 userId**

在 `app/api/v1/turns/route.ts` 的 `executeTurn` 流程中，获取到 userId 后，立即调用：

```ts
import { setReadMemoryContext } from '@/lib/deeptutor/tools/read-memory';
import { setWriteMemoryContext } from '@/lib/deeptutor/tools/write-memory';

// 在构建 context 之前
const userId = req.headers.get('x-user-id') ?? 'anonymous';
setReadMemoryContext(memoryService, userId);
setWriteMemoryContext(memoryService, userId);
```

**2. MemorySubscriber 中传递 userId**

`memory-subscriber.ts` 的 `CapabilityCompletePayload` 已经包含 `userId` 字段。当前 `consolidate` 调用已正确传递：

```ts
memoryService.consolidate(payload.userId, surface)
```

**3. Snapshot 采集时使用 userId**

新增的 Snapshot 适配器也需要接收 userId：

```ts
async readChatEntities(userId: string): Promise<Entity[]>
async refreshSnapshot(userId: string, surface: Surface): Promise<ChangeEntry[]>
```

## 5.3 并发安全

### 问题

如果多个用户同时发起请求，`setWriteMemoryContext` 修改的是模块级变量 `_userId`，会产生竞态条件：用户 A 的请求可能读到用户 B 的 userId。

### 解决方案

**方案 A（简单，推荐第一阶段）**: 在 agent loop 入口处设置 userId，在 loop 结束后重置为 `'anonymous'`。由于 Node.js 是单线程事件循环，只要在 await 之间不发生用户切换就是安全的。实际场景中，单个 agent loop 的同步段不会被其他用户的请求打断。

```ts
try {
  setReadMemoryContext(memoryService, userId);
  setWriteMemoryContext(memoryService, userId);
  // ... run agent loop
} finally {
  setReadMemoryContext(memoryService, 'anonymous');
  setWriteMemoryContext(memoryService, 'anonymous');
}
```

**方案 B（完全安全，第二阶段）**: 改造 tool 的 execute 方法，接收 context 参数（包含 userId），不再依赖模块级变量。这需要修改 `BaseTool` 接口，影响面更大。

### 推荐

第一阶段使用方案 A，快速修复。第二阶段再考虑方案 B 的接口重构。

## 5.4 memoryContext 注入

当前 `chat-capability.ts:105` 调用 `assembleSystemPrompt` 时传入了 `memoryContext`，但 turns route 中 `createUnifiedContext` 没有设置它。

### 修改

在 turns route 构建 context 时，预读 L3 记忆并注入：

```ts
const memoryService = getMemoryService();
const memoryContext = await memoryService.readAllL3(userId);

const context: UnifiedContext = {
  // ... 现有字段
  memoryContext: memoryContext || undefined,
};
```

这使 LLM 在对话中能看到用户的已有记忆，并据此个性化回复。同时，有了 `memoryContext`，系统提示词中就有了记忆上下文，间接引导 LLM 在合适时调用 `write_memory` 更新偏好。

## 5.5 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `app/api/v1/turns/route.ts` | 注入 userId 到 memory 工具 + 预读 memoryContext |
| `lib/deeptutor/tools/write-memory.ts` | 添加 resetWriteMemoryContext 函数 |
| `lib/deeptutor/tools/read-memory.ts` | 添加 resetReadMemoryContext 函数 |
