# Python → TypeScript 转换规范

> 本文件定义 DeepTutor Python 代码迁移为 TypeScript 时的具体映射规则和注意事项。

---

## 1. 数据结构映射

### 1.1 Python dataclass → TS interface/class

| Python | TypeScript | 规则 |
|--------|-----------|------|
| `@dataclass` | `interface` | 纯数据用 interface |
| `@dataclass(frozen=True)` | `interface` + `as const` 或 `Readonly<>` | 不可变数据 |
| `@dataclass` + 方法 | `class` | 有行为用 class |
| `field(default=...)` | `field?: type = defaultValue` | 可选字段用 `?` |
| `field(default_factory=list)` | `field: type[] = []` | 默认值直接赋值 |
| `str \| None` | `string \| null` | Python None → TS null |
| `dict[str, Any]` | `Record<string, unknown>` | 避免用 any |
| `list[SomeType]` | `SomeType[]` | 数组类型 |
| `Enum` | `union type` 或 `const enum` | 优先 union type（更灵活） |

### 1.2 Python Pydantic → TS Zod

```python
# Python (Pydantic)
class AgentDefaults(BaseModel):
    model: str = "claude-opus-4-5"
    max_tokens: int = 8192
    temperature: float = 0.1
```

```typescript
// TypeScript (Zod)
const AgentDefaultsSchema = z.object({
  model: z.string().default("claude-opus-4-5"),
  maxTokens: z.number().default(8192),    // snake_case → camelCase
  temperature: z.number().default(0.1),
});
type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;
```

**规则**：
- 所有 Pydantic 模型用 Zod schema 定义，同时导出类型
- 字段名 snake_case → camelCase
- `camelCase + snake_case 双支持`（Pydantic 的 `alias_generator`）→ Zod 的 `.transform()` 处理

### 1.3 Python Enum → TS Union Type

```python
# Python
class StreamEventType(str, Enum):
    CONTENT = "content"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
```

```typescript
// TypeScript — 优先用 union type
type StreamEventType = "content" | "thinking" | "tool_call";

// 如果需要运行时枚举值列表
const STREAM_EVENT_TYPES = ["content", "thinking", "tool_call"] as const;
type StreamEventType = typeof STREAM_EVENT_TYPES[number];
```

---

## 2. 并发模型映射

### 2.1 asyncio → TS

| Python | TypeScript | 说明 |
|--------|-----------|------|
| `asyncio.Queue` | 不需要 | SSE 流式替代，不需要内存队列 |
| `asyncio.Lock` | 不需要 | Next.js 单线程，无并发竞争 |
| `asyncio.Task` | `Promise` + `AbortController` | 子任务管理 |
| `asyncio.create_task()` | 直接调用 async 函数 | 无需显式创建任务 |
| `asyncio.gather()` | `Promise.all()` | 并行执行 |
| `asyncio.sleep()` | `new Promise(r => setTimeout(r, ms))` | 延迟 |
| `_processing_lock` (全局串行) | 不需要 | SSE 请求天然串行（一个连接一个响应） |

### 2.2 MessageBus 替代方案

DeepTutor 的 `MessageBus`（asyncio.Queue 双向队列）在 Next.js 中不存在。替代方案：

```
DeepTutor:  Channel → inbound Queue → AgentLoop → outbound Queue → Channel
SmartLearn: HTTP POST → SSE 流式响应（单向，ask_user 通过 WAIT_FOR_INPUT + POST 回传）
```

**具体实现**：
- 正向流：SSE（与 SmartLearn 现有模式一致）
- ask_user 回传：SSE 发 `WAIT_FOR_INPUT` → 前端 POST `/api/v1/input` → 服务端 `Map<turnId, PromiseResolver>` resolve
- 跨 handler 状态共享：单 worker 模式 + 模块级 Map

### 2.3 全局状态替代方案

| Python 全局状态 | TypeScript 替代 | 说明 |
|----------------|-----------------|------|
| 模块级变量 | 模块级变量 | 单 worker 下等价 |
| `_instance` 单例 | 模块级变量 + `getXXX()` 函数 | 同 Python 模式 |
| `asyncio.Lock` | 不需要 | 单线程无竞争 |
| `asyncio.Event` | `Promise` + resolve 函数 | 用于等待外部事件 |

---

## 3. kwargs 映射

### 3.1 Python `**kwargs` → TS `config.configurable`

DeepTutor 中工具的私有 kwargs（如 `_sandbox_user_id`）通过 `**kwargs` 动态注入。在 TS 中：

```typescript
// Python: tool.execute(**params, _sandbox_user_id=userId, _workdir=workdir)
// TypeScript: tool.execute(params, { _sandboxUserId: userId, _workdir: workdir })

interface ToolExecutionContext {
  _sandboxUserId?: string;
  _workdir?: string;
  _mounts?: string[];
  _masteryPathId?: string;
  _solveSessionId?: string;
  _vaultPath?: string;
  _toolLoader?: DeferredToolLoader;
  sourceIndex?: Record<string, string>;
  conversationHistory?: Message[];
  currentUserMessage?: string;
}

// 通过 LangGraph config.configurable 传入
graph.invoke(state, { configurable: { context: unifiedContext, sessionId, userId } });

// tool_node 执行时从 configurable 读取
function toolNode(state, config) {
  const ctx = config.configurable as ToolExecutionContext;
  // 传递给工具
}
```

### 3.2 kwargs 命名转换

| Python kwargs | TS 属性 | 说明 |
|---------------|---------|------|
| `_sandbox_user_id` | `_sandboxUserId` | snake_case → camelCase |
| `_workdir` | `_workdir` | 无变化 |
| `_mounts` | `_mounts` | 无变化 |
| `_mastery_path_id` | `_masteryPathId` | snake_case → camelCase |
| `_solve_session_id` | `_solveSessionId` | snake_case → camelCase |
| `_vault_path` | `_vaultPath` | snake_case → camelCase |
| `_tool_loader` | `_toolLoader` | snake_case → camelCase |
| `_cron_owner` | `_cronOwner` | 推迟 |
| `_subagent` | `_subagent` | 推迟 |
| `source_index` | `sourceIndex` | snake_case → camelCase |
| `conversation_history` | `conversationHistory` | snake_case → camelCase |
| `current_user_message` | `currentUserMessage` | snake_case → camelCase |

---

## 4. LangGraph Python → JS 差异

### 4.1 Annotation / Reducer

```python
# Python
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    resources: Annotated[list[Resource], operator.add]
```

```typescript
// TypeScript
const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesReducer,  // 从 @langchain/core/messages 导入
    default: () => [],
  }),
  resources: Annotation<Resource[]>({
    reducer: (prev: Resource[], update: Resource[]) => [...prev, ...update],
    default: () => [],
  }),
});
```

**关键差异**：
- Python 用 `Annotated[type, reducer_fn]`，JS 用 `Annotation<type>({ reducer, default })`
- JS 的 reducer 接收 `(prev, update)` 两个参数（Python 有些 reducer 只接收 update）
- JS 必须提供 `default` 函数
- SmartLearn 现有代码中 reducer 签名为 `(prev, update) => [...prev, ...update]`（三个参数但忽略第一个），需保持一致

### 4.2 图构建

```python
# Python
graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")
app = graph.compile()
```

```typescript
// TypeScript
const graph = new StateGraph(State)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, { tools: "tools", [END]: END })
  .addEdge("tools", "agent");
const app = graph.compile();
```

**关键差异**：
- JS 的 `addConditionalEdges` 的 mapping 对象中用 `[END]` 而非 Python 的 `END` 字符串
- JS 节点函数签名：`(state: StateType, config: RunnableConfig) => Partial<StateType>`
- JS 条件路由函数返回字符串（节点名或 `__end__`）

### 4.3 流式输出

```python
# Python
async for event in app.astream_events(input, config, version="v2"):
    handle_event(event)
```

```typescript
// TypeScript — SmartLearn 的模式
const stream = await app.stream(initialState, { configurable: { writer: write } });
for await (const event of stream) {
  // 事件已由各节点通过 writer 推送
}
```

**SmartLearn 现有模式**：各节点内部通过 `config.writer(event)` 直接推送 SSE 事件，不依赖 LangGraph 的 `streamEvents`。迁移时应沿用此模式。

### 4.4 config.configurable

```typescript
// 传递方式
graph.invoke(state, { configurable: { context, sessionId, userId } });

// 节点内读取
function myNode(state: StateType, config: RunnableConfig) {
  const { context, sessionId, userId } = config.configurable as {
    context: UnifiedContext;
    sessionId: string;
    userId: string;
  };
}
```

---

## 5. Jinja2 → Handlebars 映射

### 5.1 基本语法映射

| Jinja2 | Handlebars | 说明 |
|--------|-----------|------|
| `{{ variable }}` | `{{ variable }}` | 相同 |
| `{% if condition %}...{% endif %}` | `{{#if condition}}...{{/if}}` | 条件 |
| `{% if condition %}...{% else %}...{% endif %}` | `{{#if condition}}...{{else}}...{{/if}}` | 条件+否则 |
| `{% for item in list %}...{% endfor %}` | `{{#each list}}...{{/each}}` | 循环 |
| `{{ item.property }}` | `{{ item.property }}` | 相同 |
| `{{ loop.index }}` | `{{@index}}` | 循环索引（0-based） |
| `{{ loop.index1 }}` | `{{@index_1}}` 或 helper | 循环索引（1-based，需注册 helper） |
| `{{ var \| default('x') }}` | `{{var}}` 或 `{{#if var}}{{var}}{{else}}x{{/if}}` | 默认值 |
| `{{ var \| upper }}` | `{{upper var}}`（需注册 helper） | 过滤器 |
| `{% include 'file.md' %}` | `{{> partial}}` | 部分模板 |
| `{% macro name() %}...{% endmacro %}` | `{{#*inline "name"}}...{{/inline}}` | 宏 |
| `{# comment #}` | `{{! comment }}` | 注释 |
| `{% set x = val %}` | `{{#assign x}}val{{/assign}}`（需 helper） | 赋值 |

### 5.2 需要注册的 Handlebars Helper

```typescript
import Handlebars from 'handlebars';

// 默认值
Handlebars.registerHelper('default', (value, defaultValue) => value ?? defaultValue);

// 大写/小写
Handlebars.registerHelper('upper', (str: string) => str?.toUpperCase());
Handlebars.registerHelper('lower', (str: string) => str?.toLowerCase());

// 1-based 索引
Handlebars.registerHelper('index1', (index: number) => index + 1);

// 条件比较
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('ne', (a, b) => a !== b);
Handlebars.registerHelper('gt', (a, b) => a > b);
Handlebars.registerHelper('lt', (a, b) => a < b);

// 逻辑
Handlebars.registerHelper('and', (a, b) => a && b);
Handlebars.registerHelper('or', (a, b) => a || b);
Handlebars.registerHelper('not', (a) => !a);

// JSON 字符串化
Handlebars.registerHelper('json', (context) => JSON.stringify(context));
```

### 5.3 不兼容特性的替代方案

| Jinja2 特性 | 替代方案 |
|-------------|---------|
| 模板继承 (`{% extends %}` / `{% block %}`) | 用 Handlebars partials + 组合 |
| `{% set %}` 赋值 | 预处理数据，在 JS 层计算好再传入 |
| 自定义过滤器链 | 预处理数据或注册专用 helper |
| `{% for %}` 的 `loop.length` / `loop.first` / `loop.last` | 注册 helper 或在数据中预计算 |
| `{% if %}` 中的复杂表达式 | 简化为简单条件，或注册 comparison helper |

---

## 6. 错误处理模式映射

### 6.1 Python 异常 → TS Error

| Python | TypeScript | 说明 |
|--------|-----------|------|
| `raise ValueError("msg")` | `throw new ToolExecutionError("msg")` | 自定义 Error 类 |
| `try/except Exception` | `try/catch (error: unknown)` | 必须用 unknown 而非 any |
| `except SpecificError as e` | `catch (error) { if (error instanceof SpecificError)` | 类型守卫 |
| `logger.exception("msg")` | `logger.error("msg", { error })` | 结构化日志 |
| `@retry(stop=stop_after_attempt(3))` | 自定义重试逻辑或 `callLLM` 的 `retryOptions` | 复用 SmartLearn 重试 |

### 6.2 工具执行错误格式

DeepTutor 的工具错误模式：
```python
# 成功
return json.dumps({"success": True, "result": ...})

# 失败
return f"Error executing {name}: {e}\n[Analyze the error above and try a different approach.]"
```

TypeScript 迁移：
```typescript
// 成功
return JSON.stringify({ success: true, result: ... });

// 失败
return `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}\n[Analyze the error above and try a different approach.]`;
```

---

## 7. 文件系统操作映射

### 7.1 Python pathlib → TS

| Python | TypeScript | 说明 |
|--------|-----------|------|
| `Path("/data/user/1/memory")` | `path.join(DATA_DIR, "user", userId, "memory")` | 用 `path` 模块 |
| `path.exists()` | `fs.access(path)` 或 `fs.stat().then(() => true).catch(() => false)` | 异步检查 |
| `path.read_text()` | `fs.readFile(path, "utf-8")` | 异步读取 |
| `path.write_text(content)` | `fs.writeFile(path, content, "utf-8")` | 异步写入 |
| `path.mkdir(parents=True, exist_ok=True)` | `fs.mkdir(path, { recursive: true })` | 递归创建 |
| `path.iterdir()` | `fs.readdir(path)` | 列出目录 |
| `path.suffix` | `path.extname(filePath)` | 扩展名 |
| `path.stem` | `path.basename(filePath, path.extname(filePath))` | 无扩展名文件名 |

### 7.2 存储抽象

```typescript
interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

// 本地磁盘实现
class LocalStorageAdapter implements StorageAdapter { ... }

// S3/MinIO/GCS 实现（Phase 5+）
class S3StorageAdapter implements StorageAdapter { ... }
```

---

## 8. 测试模式映射

### 8.1 Python pytest → TS Vitest

| Python | TypeScript | 说明 |
|--------|-----------|------|
| `def test_xxx():` | `test("xxx", () => { ... })` 或 `it("xxx", ...)` | 测试函数 |
| `@pytest.fixture` | `beforeEach` / 共享 setup 函数 | 测试夹具 |
| `@pytest.mark.asyncio` | `test("xxx", async () => { ... })` | 异步测试 |
| `assert x == y` | `expect(x).toBe(y)` | 断言 |
| `assert "msg" in str(e)` | `expect(() => fn()).toThrow("msg")` | 异常断言 |
| `pytest.raises(Error)` | `expect(() => fn()).toThrow()` | 异常捕获 |
| `mocker.patch()` | `vi.fn()` / `vi.spyOn()` | Mock |
| `tmp_path` | `vi.spyOn(fs, ...)` 或临时目录 | 临时文件 |

### 8.2 测试文件位置

```
lib/deeptutor/
  core/
    __tests__/
      types.test.ts
      tool-registry.test.ts
      capability-registry.test.ts
      prompt-manager.test.ts
  tools/
    __tests__/
      brainstorm.test.ts
      reason.test.ts
      ...
```
