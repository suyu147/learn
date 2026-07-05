# DeepTutor 项目架构与模块分析文档（复现指南）

**版本**: 1.4.8 | **许可证**: Apache-2.0 | **Python 要求**: >=3.11
**文档目的**: 为在其他项目中复现 DeepTutor 架构与功能提供完整技术参考。

---

## 目录

- [一、项目整体架构概述](#一项目整体架构概述)
  - [1.1 技术栈选择](#11-技术栈选择)
  - [1.2 系统分层设计](#12-系统分层设计)
  - [1.3 核心业务流程](#13-核心业务流程)
- [二、各重要模块的详细结构说明](#二各重要模块的详细结构说明)
  - [2.1 核心协议层 (deeptutor/core)](#21-核心协议层-deeptutorcore)
  - [2.2 运行时编排层 (deeptutor/runtime)](#22-运行时编排层-deeptutorruntime)
  - [2.3 工具层 (deeptutor/tools)](#23-工具层-deeptutortools)
  - [2.4 能力层 (deeptutor/capabilities 与 deeptutor/agents)](#24-能力层-deeptutorcapabilities-与-deeptutoragents)
  - [2.5 服务层 (deeptutor/services)](#25-服务层-deeptutorservices)
  - [2.6 API 层 (deeptutor/api)](#26-api-层-deeptutorapi)
  - [2.7 多用户与 Partner 系统](#27-多用户与-partner-系统)
  - [2.8 前端层 (web)](#28-前端层-web)
- [三、模块间交互机制](#三模块间交互机制)
  - [3.1 接口定义](#31-接口定义)
  - [3.2 数据流转方式](#32-数据流转方式)
  - [3.3 依赖关系](#33-依赖关系)
  - [3.4 通信协议](#34-通信协议)
- [四、项目复现的关键注意事项](#四项目复现的关键注意事项)
  - [4.1 环境配置要求](#41-环境配置要求)
  - [4.2 第三方依赖版本控制](#42-第三方依赖版本控制)
  - [4.3 核心模块实现优先级](#43-核心模块实现优先级)
  - [4.4 潜在技术难点](#44-潜在技术难点)

---

## 一、项目整体架构概述

DeepTutor 是一个 **Agent-native**（智能体原生）的智能学习伴侣，采用 **两层插件模型**：
- **Level 1 — Tools（工具）**：单次调用的 LLM 函数工具
- **Level 2 — Capabilities（能力）**：多阶段、接管整个对话轮次的智能体流水线

通过 **三个统一入口点** 暴露能力：CLI（Typer）、WebSocket API（FastAPI）、Python SDK（DeepTutorApp facade）。

### 1.1 技术栈选择

#### 后端技术栈

| 类别 | 技术选型 | 版本要求 | 用途 |
|------|---------|---------|------|
| 语言 | Python | >=3.11 | 主开发语言（使用 dataclass slots、Protocol、`from __future__ import annotations` 等现代特性） |
| CLI 框架 | Typer | >=0.9.0 | 命令行接口（含 rich 集成） |
| Web 框架 | FastAPI | >=0.100.0 | REST API + WebSocket |
| ASGI 服务器 | Uvicorn | >=0.24.0 | 后端进程 |
| WebSocket | websockets | >=12.0 | 实时流式通信 |
| 数据校验 | Pydantic | >=2.0.0 | 数据模型（v2 API） |
| 配置管理 | PyYAML + pydantic-settings | >=6.0 / >=2.0.0 | YAML 提示词 + JSON 运行时设置 |
| 模板引擎 | Jinja2 | >=3.1.0 | 提示词模板渲染 |
| 异步存储 | aiosqlite | >=0.19.0 | 会话/消息持久化 |
| 重试机制 | tenacity | >=8.0.0 | LLM 调用重试 |
| 日志 | loguru | 0.7.3~1.0.0 | 结构化日志 |
| JSON 修复 | json-repair | 0.57.0~1.0.0 | LLM 输出 JSON 修复 |

#### LLM 与 AI 相关

| 类别 | 技术选型 | 版本要求 | 用途 |
|------|---------|---------|------|
| OpenAI SDK | openai | >=1.30.0 | 主 LLM 客户端 |
| Anthropic SDK | anthropic | >=0.30.0 | Claude 系列模型 |
| DashScope | dashscope | >=1.14.0 | 阿里通义千问 |
| Perplexity | perplexityai | >=0.1.0 | Perplexity 模型 |
| Tokenizer | tiktoken | >=0.5.0 | Token 计数 |
| RAG 框架 | llama-index | >=0.14.12 | 默认 RAG 引擎 |
| BM25 检索 | llama-index-retrievers-bm25 | 0.7.1~0.8.0 | 混合检索 |
| arXiv | arxiv | >=2.0.0 | 论文搜索 |
| 搜索 | ddgs | >=9.9.1 | DuckDuckGo 搜索 |

#### 文档处理

| 类别 | 技术选型 | 版本要求 | 用途 |
|------|---------|---------|------|
| PDF | PyMuPDF / pypdf / pdfplumber | 多版本 | PDF 文本提取 |
| Office | python-docx / openpyxl / python-pptx | 多版本 | Word/Excel/PPT 解析 |
| 报告生成 | reportlab | >=4.0.0 | PDF 生成 |
| XML 安全 | defusedxml | >=0.7.1 | 安全 XML 解析 |

#### 可选扩展

| 类别 | 技术选型 | 用途 |
|------|---------|------|
| GraphRAG | graphrag>=3.0.0 | 知识图谱 RAG |
| LightRAG | raganything>=1.0.0 | 图+向量 RAG（多模态） |
| Manim | manim>=0.19.0 | 数学动画渲染 |
| Matrix | matrix-nio | Matrix 协议 Partner |
| MCP | mcp>=1.26.0 | Model Context Protocol 客户端 |

#### 前端技术栈

| 类别 | 技术选型 | 版本 | 用途 |
|------|---------|------|------|
| 框架 | Next.js | 16.2.3 | React 全栈框架 |
| UI 库 | React | 19.0.0 | 组件库 |
| 样式 | TailwindCSS | 3.4.17 | 原子化 CSS |
| 状态 | React Context + 自定义 Hooks | - | 客户端状态管理 |
| 国际化 | i18next + react-i18next | 25.8.0 / 16.5.3 | 中英双语 |
| Markdown | react-markdown + remark-gfm + rehype-katex | 多版本 | 富文本渲染 |
| 图表 | Chart.js / Mermaid / Cytoscape | 多版本 | 数据可视化 |
| 动画 | framer-motion | 12.24.0 | UI 动画 |
| 类型 | TypeScript | 5.x | 类型安全 |

### 1.2 系统分层设计

DeepTutor 采用 **清晰的分层架构**，自顶向下分为 7 层：

```
┌─────────────────────────────────────────────────────────────────┐
│  入口层 (Entry Points)                                           │
│  CLI (Typer)  |  WebSocket /api/v1/ws  |  Python SDK (App)       │
└───────────────────────┬─────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  编排层 (Orchestration)                                          │
│  ChatOrchestrator — 路由 UnifiedContext → Capability             │
│  Launcher — 后端+前端生命周期 / 端口发现                          │
└──────────┬───────────────────────────────────┬──────────────────┘
           ↓                                   ↓
┌─────────────────────────┐     ┌─────────────────────────────────┐
│  能力注册表              │     │  工具注册表                      │
│  CapabilityRegistry     │     │  ToolRegistry                    │
│  (Level 2 — 多阶段)     │     │  (Level 1 — 单次调用)            │
└──────────┬──────────────┘     └────────────┬────────────────────┘
           ↓                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│  能力实现层 (Capabilities)                                       │
│  chat | deep_solve | deep_question | deep_research              │
│  visualize | math_animator | mastery_path                       │
└───────────────────────┬─────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  核心协议层 (Core Protocol)                                      │
│  UnifiedContext | StreamEvent | StreamBus | BaseTool            │
│  BaseCapability | UsageTracker | LabelProtocol                  │
└───────────────────────┬─────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  服务层 (Services)                                               │
│  LLM | RAG | Memory | Sandbox | Search | Parsing | Skill |      │
│  MCP | Subagent | Voice | ImageGen | VideoGen | Session | ...   │
└───────────────────────┬─────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  持久化与基础设施 (Persistence & Infra)                          │
│  SQLite (aiosqlite) | JSON Settings | File System (data/user)   │
│  PocketBase (可选) | StreamBus Registry | EventBus              │
└─────────────────────────────────────────────────────────────────┘
```

#### 关键分层原则

1. **入口无关性**：所有入口（CLI/WS/SDK）都通过 `ChatOrchestrator.handle(context)` 进入，保证行为一致
2. **能力即流水线**：每个 Capability 是一个独立的多阶段流水线，通过 `BaseCapability.run(context, stream)` 接口统一
3. **工具即函数**：每个 Tool 实现 `BaseTool.execute(**kwargs) → ToolResult`，可被任何能力调用
4. **流式优先**：所有能力通过 `StreamBus` 发射 `StreamEvent`，消费者（CLI 渲染器/WS 推送器/JSON 写入器）订阅同一事件流
5. **配置外置**：运行时设置存放在 `data/user/settings/*.json`，**项目根的 `.env` 文件被故意忽略**

### 1.3 核心业务流程

#### 1.3.1 一次对话轮次（Turn）的完整流程

```
用户输入
   │
   ↓
[入口点] CLI / WebSocket / SDK
   │
   ↓ 构建 UnifiedContext（包含 session_id, user_message, history, tools, KBs, attachments...）
   │
   ↓
[ChatOrchestrator.handle(context)]
   │
   ├─ 生成 session_id（如未提供）
   ├─ 解析 active_capability（默认 "chat"）
   ├─ 从 CapabilityRegistry 获取 Capability 实例
   ├─ 创建 StreamBus 并注册到 _bus_registry（按 turn_id）
   ├─ 发射 SESSION 事件
   │
   ↓
[Capability.run(context, bus)]
   │
   ├─ ChatCapability: 调用 AgenticChatPipeline
   │   │
   │   ├─ 组装工具列表（用户开关 + 上下文自动挂载）
   │   ├─ 构建 system prompt（ChatPromptAssembler 拼接多个 PromptBlock）
   │   ├─ 检索 KB 种子块（可选）
   │   ├─ 执行 capability.pre_loop 钩子（可选，如 explore_context）
   │   │
   │   ↓
   │   [AgentLoop.run()] — 单循环多轮
   │       │
   │       ├─ Round N: 调用 LLM（流式）
   │       │   ├─ 流式发射 CONTENT 事件（带 call_role: narration|finish）
   │       │   ├─ 解析 tool_calls
   │       │   └─ 若无 tool_calls → finish，循环结束
   │       │
   │       ├─ 若有 tool_calls:
   │       │   ├─ 并行调度工具（最多 MAX_PARALLEL_TOOL_CALLS）
   │       │   ├─ 每个工具发射 TOOL_CALL + TOOL_RESULT 事件
   │       │   ├─ 处理 pause_for_user（ask_user 暂停等待用户回复）
   │       │   └─ 继续 Round N+1
   │       │
   │       └─ 达到 max_rounds → 强制 finish
   │
   ├─ 发射 SOURCES 事件（聚合所有工具的 sources）
   └─ 发射 RESULT 事件（含 response + cost_summary）
   │
   ↓
[StreamBus.close()] — 通知所有订阅者
   │
   ↓
[EventBus.publish(CAPABILITY_COMPLETE)] — 供跨模块监听
   │
   ↓
[TurnRuntimeManager] — 持久化消息到 SQLite，关联 attachments
```

#### 1.3.2 工具调用流程（Function Calling）

```
LLM 返回 tool_calls
   │
   ↓
[dispatch_tool_calls()]
   ├─ 限制并发: MAX_PARALLEL_TOOL_CALLS
   ├─ 对每个 tool_call:
   │   ├─ 从 ToolRegistry 解析工具名（含别名解析）
   │   ├─ 注入服务器私有 kwargs（_sandbox_*, _tool_loader, source_index 等）
   │   ├─ 调用 BaseTool.execute(**kwargs)
   │   ├─ 发射 TOOL_CALL 事件（含 args）
   │   ├─ 发射 TOOL_RESULT 事件（含 result.content, sources）
   │   └─ 处理 pause_for_user / terminate_turn 标志
   └─ 返回 DispatchOutcome（含每个工具的 ToolResult）
```

#### 1.3.3 RAG 检索流程

```
用户启用 KB → RAGTool 自动挂载
   │
   ↓ LLM 调用 rag(query, kb_name)
   │
   ↓
[RAGService.search(query, kb_name)]
   ├─ 解析 KB 绑定的 provider（llamaindex/pageindex/graphrag/lightrag）
   ├─ 获取对应 Pipeline 实例（缓存）
   └─ pipeline.search(query, kb_name)
       │
       ├─ LlamaIndexPipeline:
       │   ├─ 检查 embedding signature → 选择索引版本
       │   ├─ 混合检索: 向量检索 + BM25
       │   ├─ 融合 + 重排
       │   └─ 返回 {query, content, sources, provider}
       │
       ├─ PageIndexPipeline: 调用托管 API
       ├─ GraphRAGPipeline: 知识图谱查询
       └─ LightRAGPipeline: 图+向量混合
```

#### 1.3.4 三层记忆系统流程

```
事件发生（对话/工具调用/用户偏好）
   │
   ↓
[L1: Trace] — 追加到 JSONL（按 surface 分文件，按天滚动）
   │
   ↓ 用户在 Memory 工作台点击"整合"
   │
[L2 Consolidator] — LLM 驱动的去重/合并/更新
   ├─ chunker: 分块
   ├─ dedup: 去重
   ├─ merge: 合并
   └─ update: 更新到 surface 文档（recent/profile/scope/preferences）
   │
   ↓ 定期或手动触发
   │
[L3 Consolidator] — LLM 驱动的跨 surface 摘要
   └─ 更新到 L3 slots（recent/profile/scope/preferences）
```

---

## 二、各重要模块的详细结构说明

### 2.1 核心协议层 (deeptutor/core)

这是整个系统的 **契约层**，定义了所有模块必须遵循的接口。复现时 **必须最先实现**。

#### 2.1.1 模块功能定位

`deeptutor/core/` 定义了流式事件协议、工具/能力基类、统一上下文，是所有上层模块的依赖根。

#### 2.1.2 核心数据结构

**UnifiedContext**（[deeptutor/core/context.py](file:///e:/DeepTutor-main/deeptutor/core/context.py)）— 贯穿整个 turn 的数据载体：

```python
@dataclass
class UnifiedContext:
    session_id: str = ""
    user_message: str = ""
    conversation_history: list[dict[str, Any]] = field(default_factory=list)  # OpenAI 格式
    enabled_tools: list[str] | None = None  # None=未指定, []=禁用全部
    allowed_builtin_tools: list[str] | None = None  # 内置工具白名单（Partner 用）
    active_capability: str | None = None  # None → 默认 "chat"
    knowledge_bases: list[str] = field(default_factory=list)
    attachments: list[Attachment] = field(default_factory=list)
    config_overrides: dict[str, Any] = field(default_factory=dict)
    language: str = "en"  # "en" | "zh"
    memory_context: str = ""  # 注入 system prompt 的记忆快照
    persona_context: str = ""  # 人格指令
    skills_manifest: str = ""  # Skills 清单（一行一个）
    source_manifest: str = ""  # 附加源清单
    metadata: dict[str, Any] = field(default_factory=dict)  # 能力特定扩展
```

**StreamEvent**（[deeptutor/core/stream.py](file:///e:/DeepTutor-main/deeptutor/core/stream.py)）— 统一流式事件：

```python
class StreamEventType(str, Enum):
    STAGE_START = "stage_start"
    STAGE_END = "stage_end"
    THINKING = "thinking"
    OBSERVATION = "observation"
    CONTENT = "content"           # 用户可见的文本流
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    PROGRESS = "progress"
    SOURCES = "sources"           # 引用源聚合
    RESULT = "result"             # 最终结果（含 cost_summary）
    ERROR = "error"
    SESSION = "session"
    SESSION_META = "session_meta"
    DONE = "done"
    WAIT_FOR_INPUT = "wait_for_input"  # ask_user 暂停

@dataclass
class StreamEvent:
    type: StreamEventType
    source: str = ""              # 产生者（capability/tool 名）
    stage: str = ""               # 当前阶段
    content: str = ""             # 文本载荷
    metadata: dict[str, Any] = field(default_factory=dict)
    session_id: str = ""
    turn_id: str = ""
    seq: int = 0
    timestamp: float = field(default_factory=time.time)
```

**ToolResult**（[deeptutor/core/tool_protocol.py](file:///e:/DeepTutor-main/deeptutor/core/tool_protocol.py)）— 工具执行结果：

```python
@dataclass
class ToolResult:
    content: str = ""             # 返回给 LLM 的 role=tool 消息体
    sources: list[dict[str, Any]] = field(default_factory=list)  # 引用源
    metadata: dict[str, Any] = field(default_factory=dict)
    success: bool = True
    terminate_turn: bool = False  # 终止当前 turn
    pause_for_user: dict[str, Any] | None = None  # ask_user 暂停载荷
```

#### 2.1.3 关键协议接口

**BaseTool**（[deeptutor/core/tool_protocol.py](file:///e:/DeepTutor-main/deeptutor/core/tool_protocol.py)）：

```python
class BaseTool(ABC):
    deferred: bool = False  # 渐进式披露标记（schema 不进初始工具列表）

    @abstractmethod
    def get_definition(self) -> ToolDefinition: ...

    @abstractmethod
    async def execute(self, **kwargs: Any) -> ToolResult: ...

    def get_prompt_hints(self, language: str = "en") -> ToolPromptHints: ...
```

**BaseCapability**（[deeptutor/core/capability_protocol.py](file:///e:/DeepTutor-main/deeptutor/core/capability_protocol.py)）：

```python
class BaseCapability(ABC):
    manifest: CapabilityManifest  # 静态元数据

    @abstractmethod
    async def run(self, context: UnifiedContext, stream: StreamBus) -> None: ...
```

**StreamBus**（[deeptutor/core/stream_bus.py](file:///e:/DeepTutor-main/deeptutor/core/stream_bus.py)）— 异步事件总线：

核心机制：
- **多订阅者 fan-out**：通过 `asyncio.Queue` 列表实现
- **历史重放**：新订阅者先接收 `_history` 中的事件，再接实时事件
- **stage 上下文管理器**：自动发射 STAGE_START / STAGE_END
- **wait_for_input**：暂停能力执行，等待用户输入（ask_user 用）
- **per-turn 注册表**：`register_bus(turn_id, bus)` 让 WS 的 user_input 消息能找到对应 bus

#### 2.1.4 Agentic 引擎原语 (deeptutor/core/agentic)

这是 **可复用的智能体循环构建块**，被 chat / solve / research 等能力共享：

| 模块 | 功能 |
|------|------|
| `labels.py` | 协议标签解析（`\`\`LABEL\`\`+content` 格式） |
| `client.py` | OpenAI/Azure 客户端工厂 + completion kwargs 构建 |
| `usage.py` | `UsageTracker` — 跨步骤的 token 用量累加器 |
| `labeled_step.py` | 单次流式 LLM 调用 + 标签路由 |
| `tool_dispatch.py` | 并行工具执行（含 per-tool 子 trace），`MAX_PARALLEL_TOOL_CALLS` 限流 |
| `loop.py` | `run_agentic_loop` — 迭代调度器，组合上述原语 |

### 2.2 运行时编排层 (deeptutor/runtime)

#### 2.2.1 模块功能定位

`deeptutor/runtime/` 是系统的 **中枢神经**，负责路由、注册表管理、进程生命周期。

#### 2.2.2 ChatOrchestrator（[deeptutor/runtime/orchestrator.py](file:///e:/DeepTutor-main/deeptutor/runtime/orchestrator.py)）

```python
class ChatOrchestrator:
    async def handle(self, context: UnifiedContext) -> AsyncIterator[StreamEvent]:
        # 1. 生成 session_id
        # 2. 解析 capability 名（默认 "chat"）
        # 3. 从 CapabilityRegistry 获取实例
        # 4. 创建 StreamBus，注册到 _bus_registry
        # 5. 发射 SESSION 事件
        # 6. asyncio.create_task(capability.run(context, bus))
        # 7. async for event in bus.subscribe(): yield event
        # 8. await task
        # 9. 发布 CAPABILITY_COMPLETE 到 EventBus
```

#### 2.2.3 注册表机制

**ToolRegistry**（[deeptutor/runtime/registry/tool_registry.py](file:///e:/DeepTutor-main/deeptutor/runtime/registry/tool_registry.py)）：

- **单例模式**：`get_tool_registry()` 全局唯一，首次调用时 `load_builtins()`
- **别名解析**：`TOOL_ALIASES` 映射（如 `rag_hybrid` → `rag` + `{"mode": "hybrid"}`）
- **OpenAI Schema 生成**：`build_openai_schemas(names)` 输出 function-calling 格式
- **Prompt 文本组合**：`build_prompt_text(names, format)` 支持 list/table/aliases/phased 格式

**CapabilityRegistry**（[deeptutor/runtime/registry/capability_registry.py](file:///e:/DeepTutor-main/deeptutor/runtime/registry/capability_registry.py)）：

- **延迟导入**：通过 `importlib.import_module` 按需加载能力类
- **插件发现**：`load_plugins()` 调用 `deeptutor.plugins.loader.discover_plugins()`
- **i18n 描述**：`capability_description_i18n()` 提供多语言能力描述

**内置能力清单**（[deeptutor/runtime/bootstrap/builtin_capabilities.py](file:///e:/DeepTutor-main/deeptutor/runtime/bootstrap/builtin_capabilities.py)）：

```python
BUILTIN_CAPABILITY_CLASSES = {
    "chat": "deeptutor.agents.chat.capability:ChatCapability",
    "deep_solve": "deeptutor.capabilities.solve.capability:DeepSolveCapability",
    "deep_question": "deeptutor.agents.question.capability:DeepQuestionCapability",
    "deep_research": "deeptutor.agents.research.capability:DeepResearchCapability",
    "math_animator": "deeptutor.agents.math_animator.capability:MathAnimatorCapability",
    "visualize": "deeptutor.agents.visualize.capability:VisualizeCapability",
    "mastery_path": "deeptutor.capabilities.mastery.capability:MasteryPathCapability",
}
```

#### 2.2.4 Launcher（[deeptutor/runtime/launcher.py](file:///e:/DeepTutor-main/deeptutor/runtime/launcher.py)）

负责本地开发的 **后端 + 前端联合启动**：
- 端口发现（避免冲突）
- 进程管理（`subprocess.Popen` + 进程组）
- 健康检查（`BACKEND_READY_TIMEOUT=60s`, `FRONTEND_READY_TIMEOUT=120s`）
- 前端运行时探测（复用已有实例 vs 启动新实例）

#### 2.2.5 Runtime Home 解析（[deeptutor/runtime/home.py](file:///e:/DeepTutor-main/deeptutor/runtime/home.py)）

```python
def get_runtime_home(home=None) -> Path:
    # 优先级: 显式参数 > DEEPTUTOR_HOME 环境变量 > 当前工作目录
    # 返回值是工作区根目录，运行时数据在 <home>/data 下
```

### 2.3 工具层 (deeptutor/tools)

#### 2.3.1 模块功能定位

`deeptutor/tools/` 实现 **所有内置工具**。每个工具是 `BaseTool` 的子类，通过 `get_definition()` 声明 schema，通过 `execute()` 执行。

#### 2.3.2 工具分类与挂载策略

**用户可切换工具**（`USER_TOGGLEABLE_TOOL_NAMES`，在 /settings/tools 显示）：

| 工具 | 描述 |
|------|------|
| `brainstorm` | 广度优先的创意探索 |
| `web_search` | 网页搜索 + 引用 |
| `paper_search` | arXiv 论文搜索 |
| `reason` | 专门的深度推理 LLM 调用 |
| `geogebra_analysis` | 数学图像分析 → GeoGebra 命令 |
| `imagegen` | 文生图 |
| `videogen` | 文生视频 |

**上下文自动挂载工具**（`CONFIGURABLE_BUILTIN_TOOL_NAMES`，由 chat pipeline 根据条件挂载）：

| 工具 | 挂载条件 |
|------|---------|
| `rag` | `has_kb`（附加了知识库） |
| `code_execution` | `has_code`（沙箱可用） |
| `read_source` | `has_sources`（有附加源） |
| `read_memory` | `has_memory`（用户有记忆） |
| `write_memory` | `has_memory` |
| `read_skill` | `has_skills`（有可见技能） |
| `list_notebook` | `has_notebooks`（用户有笔记本） |
| `write_note` | `has_notebooks` |
| `web_fetch` | 始终挂载 |
| `github` | 始终挂载（gh CLI 不可用时优雅降级） |
| `exec` | `has_exec`（沙箱可用） |
| `load_tools` | `has_deferred_tools`（有延迟工具） |
| `cron` | 始终挂载 |
| `ask_user` | 始终挂载 |

**能力专属工具**（由能力激活时挂载）：
- `mastery_*`：Mastery Path 专用
- `solve_*`：Deep Solve 专用（`solve_plan`, `solve_finish_step`, `solve_replan`）
- Obsidian 工具：Obsidian KB 激活时替换整个工具面
- `subagent_consult`：连接的 agent 作为 KB 时替换工具面

**Partner 专用工具**（Partner 运行时强制挂载，替换 chat 的 read_memory/write_memory）：
- `partner_read`, `partner_memorize`, `partner_search`

#### 2.3.3 工具实现关键模式

**1. Prompt Hints 懒加载**：

```python
class _PromptHintsMixin:
    def get_prompt_hints(self, language: str = "en"):
        return load_prompt_hints(self.name, language=language)
```

**2. 服务器私有 kwargs 注入**：
工具的 `execute(**kwargs)` 会收到 LLM 不提供的私有参数，由 chat pipeline 通过 `_augment_tool_kwargs` 注入：
- `_sandbox_user_id`, `_sandbox_workdir`, `_sandbox_mounts`（code_execution/exec）
- `_tool_loader`（load_tools）
- `_cron_owner`（cron）
- `source_index`（read_source）
- `conversation_history`, `current_user_message`（write_note）
- `language`（geogebra_analysis）

**3. 渐进式披露（Deferred Tools）**：
`BaseTool.deferred = True` 的工具（如所有 MCP 工具）：
- schema **不进** 初始工具列表
- system prompt 携带一行清单
- 模型通过 `load_tools` 工具按需加载 schema

**4. 别名机制**：
```python
TOOL_ALIASES = {
    "rag_hybrid": ("rag", {"mode": "hybrid"}),
    "rag_naive": ("rag", {"mode": "naive"}),
    "code_execute": ("code_execution", {}),
    "run_code": ("code_execution", {}),
}
```

### 2.4 能力层 (deeptutor/capabilities 与 deeptutor/agents)

#### 2.4.1 模块功能定位

能力层实现 **多阶段智能体流水线**。每个能力是一个 `BaseCapability` 子类，通过 `run(context, stream)` 接管整个 turn。

#### 2.4.2 能力分类

**A. 基于 AgentLoop 的能力**（复用 chat 的智能体循环）：

| 能力 | 实现位置 | 阶段 | 说明 |
|------|---------|------|------|
| `chat` | `deeptutor/agents/chat/` | exploring → responding | 默认能力，单循环多轮 |
| `deep_solve` | `deeptutor/capabilities/solve/` | responding | 复用 chat 循环 + solve 工具 + SolveSession 状态机 |
| `mastery_path` | `deeptutor/capabilities/mastery/` | responding | 复用 chat 循环 + mastery 工具 |

**B. 独立流水线能力**（自定义多阶段）：

| 能力 | 实现位置 | 阶段 |
|------|---------|------|
| `deep_question` | `deeptutor/agents/question/` | ideation → generation |
| `deep_research` | `deeptutor/agents/research/` | rephrasing → decomposing → researching → reporting |
| `visualize` | `deeptutor/agents/visualize/` | analyzing → generating → reviewing |
| `math_animator` | `deeptutor/agents/math_animator/` | concept_analysis → concept_design → code_generation → code_retry → summary → render_output |

#### 2.4.3 Chat 能力核心实现

**AgenticChatPipeline**（[deeptutor/agents/chat/agentic_pipeline.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/agentic_pipeline.py)）：

关键常量：
```python
DEFAULT_MAX_ROUNDS = 8                    # 单 turn 最大循环轮数
CONTEXT_WINDOW_GUARD_RATIO = 0.9          # 上下文窗口保护比例
KB_SEED_MAX_KBS = 3                       # KB 种子最大数量
KB_SEED_CHARS_PER_KB = 4000               # 每 KB 种子字符数
```

**AgentLoop**（[deeptutor/agents/chat/agent_loop.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/agent_loop.py)）— 单循环多轮智能体：

核心逻辑：
1. **Round N**：调用 LLM（流式），文本流式发射为 CONTENT 事件
2. **call_role 判定**：
   - `narration`：本轮调用了工具，文本是工具工作的前言
   - `finish`：本轮未调用工具，文本是最终答案 → 循环结束
3. **工具调度**：并行执行 tool_calls，结果作为 `role=tool` 消息追加
4. **ask_user 暂停**：`pause_for_user` 标志触发，发射 `wait_for_input`，等待用户回复后继续同一轮
5. **预算耗尽**：达到 `max_rounds` 强制一次 tool-less finish

**InlineThinkFilter**：流式 `<think>`/`<thinking>` 标签分割器，将内联推理从 content 通道分离到 thinking 通道。

**ChatPromptAssembler**（[deeptutor/agents/chat/prompt_blocks.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/prompt_blocks.py)）：

system prompt 由多个 PromptBlock 拼接：
```
## general
## runtime_policy
## tool_manifest
## kb_note
## deferred_tools_manifest
## notebook_manifest
## workspace_note
## [capability_blocks]  # 来自 LoopCapability.system_block()
## memory_context
## persona_context
## skills_manifest
## source_manifest
```
最后通过 `append_language_directive` 追加语言指令。

#### 2.4.4 LoopCapability 协议（[deeptutor/capabilities/protocol.py](file:///e:/DeepTutor-main/deeptutor/capabilities/protocol.py)）

```python
class LoopCapability(Protocol):
    name: str
    owned_tools: tuple[str, ...]  # 该能力激活时贡献的工具

    def is_active(self, context: UnifiedContext) -> bool: ...
    def system_block(self, context, *, language, prompts) -> PromptBlock | None: ...
    def augment_kwargs(self, tool_name, kwargs, context) -> dict: ...
    def pre_loop_seed(self, context) -> str: ...
    # 可选: async def pre_loop(self, context, stream, *, usage=None) -> PromptBlock | None
```

**KnowledgeCapability**（子类）：设置 `exclusive_tools = True`，激活时 **替换** 整个工具面（而非追加）。Obsidian 和 Subagent 是此类。

#### 2.4.5 Deep Research 流水线（[deeptutor/agents/research/pipeline.py](file:///e:/DeepTutor-main/deeptutor/agents/research/pipeline.py)）

四阶段：
1. **Rephrase**：mini agentic loop，仅 `ask_user` 工具，最多 3 轮（每轮 1-4 问）
2. **Decompose**：一个 `OUTLINE` 标签步骤，生成 N 个子主题；可选用户确认
3. **Research blocks**：对 `DynamicTopicQueue` 中每个 TopicBlock 运行 `run_agentic_loop`（THINK/TOOL/APPEND/FINISH）
4. **Reporting**：OUTLINE → INTRO → 每个 SECTION → CONCLUSION → 组装，通过 `CitationManager` 注入引用

#### 2.4.6 BaseAgent（[deeptutor/agents/base_agent.py](file:///e:/DeepTutor-main/deeptutor/agents/base_agent.py)）

独立流水线能力的基类（research/question/visualize/math_animator 的子 agent 继承）：

```python
class BaseAgent(ABC):
    def __init__(self, module_name, agent_name, api_key=None, base_url=None,
                 model=None, language="zh", binding=None, config=None, ...):
        # 从 agents.yaml 加载参数
        # 从 get_llm_config() 加载 LLM 配置
        # 通过 PromptManager 加载提示词

    async def call_llm(self, user_prompt, system_prompt, messages=None,
                       response_format=None, temperature=None, ...) -> str: ...

    async def stream_llm(self, user_prompt, system_prompt, messages=None, ...) -> AsyncGenerator[str, None]: ...

    @abstractmethod
    async def process(self, *args, **kwargs) -> Any: ...
```

### 2.5 服务层 (deeptutor/services)

服务层是 **可复用的业务能力封装**，被工具层和能力层调用。

#### 2.5.1 LLM 服务 (deeptutor/services/llm)

**架构**：
```
BaseAgent.call_llm() / stream_llm()
        ↓
   LLM Factory (complete / stream)
        ↓
┌───────────────┴───────────────┐
│                               │
CloudProvider              LocalProvider
        ↓
   Provider Factory
        ↓
┌───────────────┬───────────────┬───────────────┐
OpenAICompat   Anthropic      AzureOpenAI    GitHubCopilot
                              OpenAICodex
```

**核心特性**：
- **统一接口**：`complete()` / `stream()` 两个工厂函数
- **自动重试**：指数退避，`DEFAULT_MAX_RETRIES` 来自 `settings.retry.max_retries`
- **能力检测**：`supports_tools()`, `supports_vision()`, `supports_response_format()`, `supports_streaming()`
- **多模态**：`prepare_multimodal_messages()` 将附件转为 OpenAI image_url 格式
- **上下文窗口**：`resolve_effective_context_window()` 按模型解析
- **流量控制**：`TrafficController` 限流（RPM + 并发）
- **Thinking 标签清理**：`clean_thinking_tags()` 处理 `<think>` 标签

**LLMConfig**（[deeptutor/services/llm/config.py](file:///e:/DeepTutor-main/deeptutor/services/llm/config.py)）：
- 从 `data/user/settings/model_catalog.json` 加载
- 支持 ContextVar 实现多用户隔离
- 字段：model, api_key, base_url, binding, provider_name, api_version, reasoning_effort, context_window, max_tokens, temperature, max_concurrency, requests_per_minute

#### 2.5.2 RAG 服务 (deeptutor/services/rag)

**架构**：多引擎可插拔

| Provider | 实现 | 特点 |
|----------|------|------|
| `llamaindex`（默认） | `pipelines/llamaindex/` | 本地向量检索 + BM25 混合融合 |
| `pageindex` | `pipelines/pageindex/` | 托管的 vectorless 推理检索 |
| `graphrag` | `pipelines/graphrag/` | microsoft/graphrag 知识图谱 |
| `lightrag` | `pipelines/lightrag/` | HKUDS/LightRAG + RAG-Anything 多模态 |

**RAGService**（[deeptutor/services/rag/service.py](file:///e:/DeepTutor-main/deeptutor/services/rag/service.py)）：
- 按 KB 解析 provider（创建时绑定，后续检索走同一 pipeline）
- Pipeline 实例缓存（按 `kb_base_dir + provider`）
- 接口：`initialize()`, `add_documents()`, `search()`, `delete()`

**RAGPipeline Protocol**（[deeptutor/services/rag/pipelines/base.py](file:///e:/DeepTutor-main/deeptutor/services/rag/pipelines/base.py)）：
```python
class RAGPipeline(Protocol):
    async def initialize(self, kb_name, file_paths, **kwargs) -> bool: ...
    async def add_documents(self, kb_name, file_paths, **kwargs) -> bool: ...
    async def search(self, query, kb_name, **kwargs) -> Dict[str, Any]: ...
    async def delete(self, kb_name, **kwargs) -> bool: ...
```

**索引版本化**（`index_versioning.py`）：
- LlamaIndex pipeline 按 embedding signature 选择索引版本
- 切换 embedding 模型 → 旧索引标记为 stale → 触发重建
- 其他 pipeline 用合成 signature（`pageindex`/`graphrag`/`lightrag`）

**Embedding 服务**（[deeptutor/services/embedding/](file:///e:/DeepTutor-main/deeptutor/services/embedding/)）：
- 多 adapter：openai_sdk, openai_compatible, ollama, jina, cohere, dashscope_native
- 统一 `EmbeddingClient` 接口
- 配置来自 `data/user/settings/model_catalog.json` 的 embedding 部分

#### 2.5.3 三层记忆系统 (deeptutor/services/memory)

**架构**：
```
L1 (Trace)     — 原始事件捕获，追加式 JSONL，按 surface 分文件，按天滚动
L2 (Document)  — per-surface markdown 文档 + footnote 引用
L3 (Document)  — 跨 surface 摘要，4 个 slot: recent/profile/scope/preferences
```

**MemoryStore**（[deeptutor/services/memory/store.py](file:///e:/DeepTutor-main/deeptutor/services/memory/store.py)）— 无状态 facade：
- `emit(event)` — 追加 L1 trace
- `read_doc(layer, key)` — 读 L2/L3 文档
- `write_preference(op, text, ...)` — 写偏好（chat 模式唯一的写操作）
- `consolidate(...)` — 触发 L1→L2 或 L2→L3 整合

**Consolidator**（`consolidator/`）— LLM 驱动的整合：
- `chunker.py` — 分块
- `modes/dedup.py` — 去重
- `modes/merge.py` — 合并
- `modes/update.py` — 更新
- `modes/audit.py` — 审计（L2→L3）

**Surface 与 Slot**：
- Surface（L2）：`chat`, `partner`, `book`, ...（每个交互表面一个）
- L3 Slot：`recent`, `profile`, `scope`, `preferences`

**多用户安全**：通过 `paths.memory_root` → `PathService` → ContextVar 实现每用户路径隔离。

#### 2.5.4 沙箱服务 (deeptutor/services/sandbox)

**SandboxService**（[deeptutor/services/sandbox/service.py](file:///e:/DeepTutor-main/deeptutor/services/sandbox/service.py)）：
- 后端抽象：`SandboxBackend`（runner sidecar / bwrap / 受限 subprocess）
- 健康检查缓存
- 每用户配额：`UserExecQuota`（并发 + 每分钟次数）
- 隔离级别：`IsolationLevel.SYSTEM` / `IsolationLevel.APPLICATION`
- 接口：`run(request, user_id)`, `isolation_level()`, `exec_capability_available()`

**ExecRequest / ExecResult**（`spec.py`）：
```python
@dataclass
class ExecRequest:
    command: str
    workdir: str
    mounts: tuple[Mount, ...]
    limits: ResourceLimits  # timeout_s, max_output_chars

@dataclass
class ExecResult:
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool
    error: str
```

#### 2.5.5 文档解析服务 (deeptutor/services/parsing)

**多引擎可插拔**：
- `text_only`（默认兜底）
- `mineru`（local / cloud）
- `docling`
- `markitdown`

**ParseService**（[deeptutor/services/parsing/service.py](file:///e:/DeepTutor-main/deeptutor/services/parsing/service.py)）：
- 内容寻址缓存（避免重复解析）
- 模型下载就绪门控
- 拉取式消费（callers 主动请求解析）

#### 2.5.6 搜索服务 (deeptutor/services/search)

**多 provider**：
- Brave, Tavily, Jina, SearXNG, DuckDuckGo（免费兜底）
- Perplexity, Serper, Exa, Baidu, OpenRouter

**自动整合**：`AnswerConsolidator` 对不生成答案的 provider 自动整合（模板或 LLM 合成）。

#### 2.5.7 Skill 服务 (deeptutor/services/skill)

**nanobot 风格的能力技能包**：
- 每个 skill 是一个目录：`SKILL.md` + 可选 `references/`
- 两层：builtin（`deeptutor/skills/builtin/`，只读）+ user（`data/user/workspace/skills/`）
- 渐进式披露：system prompt 只携带一行清单，模型通过 `read_skill` 按需拉取
- `always: true` 的 skill 体被急切注入
- 前置条件门控：`requires.bins` / `requires.env` / `requires.sandbox`

#### 2.5.8 MCP 服务 (deeptutor/services/mcp)

**MCPManager**（[deeptutor/services/mcp/manager.py](file:///e:/DeepTutor-main/deeptutor/services/mcp/manager.py)）：
- 应用级单例，管理所有 MCP server 连接生命周期
- 每个 server 一个专用连接 task（anyio cancel scopes 是 task-bound）
- `ensure_started()` 懒加载（首次 turn 付连接成本）
- `reload()` diff 配置，只重启变更的 server
- 工具适配器标记 `deferred=True`，通过 `load_tools` 渐进式披露

#### 2.5.9 Subagent 服务 (deeptutor/services/subagent)

驱动用户本地 agent CLI（Claude Code / Codex）作为子 agent：
- 后端抽象：`SubagentBackend`
- 流式子进程原语
- consult 工具接口
- 预算控制：`CONSULT_BUDGET_MIN` / `DEFAULT_CONSULT_BUDGET` / `CONSULT_BUDGET_MAX`

#### 2.5.10 Session 服务 (deeptutor/services/session)

**TurnRuntimeManager**（[deeptutor/services/session/turn_runtime.py](file:///e:/DeepTutor-main/deeptutor/services/session/turn_runtime.py)）：
- turn 级运行时管理
- 流式事件 → 持久化消息（区分 narration vs finish）
- 附件聚合（artifact 自动转为 assistant 消息附件）
- 后端：SQLiteSessionStore（默认）/ PocketBaseSessionStore（可选）

#### 2.5.11 其他重要服务

| 服务 | 功能 |
|------|------|
| `services/config` | 运行时设置（JSON 文件）+ 模型目录 + 启动设置 |
| `services/prompt` | PromptManager 单例 + 语言回退 |
| `services/persona` | 人格管理 |
| `services/notebook` | 笔记本管理（Web/CLI 共享格式） |
| `services/cron` | 定时任务执行器 |
| `services/voice` | 语音合成 |
| `services/imagegen` / `videogen` | 多模态生成 |
| `services/partners` | Partner agent 运行时 |
| `services/storage` | 附件存储 |

### 2.6 API 层 (deeptutor/api)

#### 2.6.1 模块功能定位

`deeptutor/api/` 基于 FastAPI，提供 REST + WebSocket 接口。

#### 2.6.2 应用启动（[deeptutor/api/main.py](file:///e:/DeepTutor-main/deeptutor/api/main.py)）

启动序列：
1. `ensure_runtime_settings_files()` — 确保设置文件存在
2. `export_runtime_settings_to_env(overwrite=True)` — 导出到环境变量
3. `configure_logging()` — 配置日志
4. `validate_tool_consistency()` — 校验能力 manifest 引用的工具都已注册
5. 构建 CORS 设置（localhost + 远程 Docker）
6. 挂载静态文件（`SafeOutputStaticFiles` 白名单制）
7. 注册路由

#### 2.6.3 统一 WebSocket 端点（[deeptutor/api/routers/unified_ws.py](file:///e:/DeepTutor-main/deeptutor/api/routers/unified_ws.py)）

`/api/v1/ws` 支持的客户端消息类型：

| type | 用途 |
|------|------|
| `message` / `start_turn` | 启动新 turn |
| `subscribe_turn` | 订阅已有 turn 的事件流（支持 `after_seq`） |
| `subscribe_session` | 订阅 session 的活跃 turn |
| `resume_from` | 重连后恢复 |
| `unsubscribe` | 取消订阅 |
| `cancel_turn` | 取消运行中的 turn |
| `submit_user_reply` | 提交 ask_user 的回复 |
| `regenerate` | 重新运行最后一条用户消息 |
| `check_active_turn` | 检查是否有活跃 turn |
| `user_input` | 提交 learner 答案（解决 wait_for_input） |

#### 2.6.4 路由组织

按功能域划分 router：auth, chat, knowledge, memory, notebook, partners, settings, skills, system, tools, voice, book, co_writer, dashboard, mastery_path, quiz_judge, subagents, mcp_settings, agent_config, capabilities_settings, question_notebook, attachments, imports, personas, plugins_api, question, sessions。

### 2.7 多用户与 Partner 系统

#### 2.7.1 多用户系统 (deeptutor/multi_user)

**后端支持矩阵**：
- **默认 JSON/SQLite 后端**（`integrations.pocketbase_url` 为空）：支持多用户
  - 每用户工作区：`data/users/<uid>/`
  - 账户和授权：`data/system/`
  - 每用户 SQLite session DB
  - JWT 认证
- **PocketBase 模式**：当前仅单用户

**核心组件**：
- `context.py` — ContextVar 持有 `CurrentUser`
- `paths.py` — 每用户路径解析（`user_context()` 上下文管理器）
- `identity.py` — 用户身份
- `grants.py` — 授权
- `tool_access.py` / `skill_access.py` / `model_access.py` — 访问控制
- `router.py` — FastAPI 依赖注入

#### 2.7.2 Partner 系统 (deeptutor/partners + deeptutor/services/partners)

**架构**：IM 连接的伴侣，由 chat agent loop 驱动

```
IM 消息 → Channel (Telegram/Slack/...) → MessageBus → PartnerRuntime
                                                        ↓
                                          ChatOrchestrator → AgenticChatPipeline
                                                        ↓
                                          StreamEvent → OutboundMessage → Channel → IM
```

**Channel 层**（`deeptutor/partners/channels/`）：
支持 16+ IM 平台：Telegram, Slack, Discord, Matrix, Feishu, WeCom, Weixin, QQ, NapCat, DingTalk, MSTeams, WhatsApp, Zulip, Email, MoChat。

**关键设计**：
- Partner **没有自己的 engine**：每条入站消息成为一个 chat turn
- 在 partner 的合成用户 scope 内运行（rag/skills/notebook 工具读 partner workspace）
- 强制挂载 `partner_read`/`partner_memorize`/`partner_search`，抑制 `read_memory`/`write_memory`
- 事件 → IM 映射：
  - `RESULT` → 回复消息
  - `CONTENT` (call_kind=llm_final_response) → 终止符/ask_user 文本
  - narration rounds → 可选 `_progress` 消息
  - `TOOL_CALL` → 可选 `_tool_hint`

### 2.8 前端层 (web)

#### 2.8.1 技术架构

- **Next.js 16** App Router，React 19，TypeScript 5
- **路由组**：`(auth)` / `(admin)` / `(utility)` / `(workspace)`
- **状态管理**：React Context（`UnifiedChatContext`, `AppShellContext` 等）+ 自定义 Hooks
- **i18n**：i18next，中英双语，`locales/{en,zh}/{app,common}.json`
- **样式**：TailwindCSS 3.4 + tailwind-merge + clsx
- **实时通信**：`lib/unified-ws.ts` — WebSocket 客户端，处理 NDJSON 事件流

#### 2.8.2 关键模块

| 模块 | 功能 |
|------|------|
| `lib/unified-ws.ts` | WebSocket 客户端，事件流处理 |
| `lib/stream.ts` | 流式文本平滑渲染 |
| `context/UnifiedChatContext.tsx` | 统一聊天状态 |
| `components/chat/` | 聊天 UI 组件 |
| `components/memory/` | 记忆图谱可视化 |
| `components/space/` | Space（多源工作区） |
| `lib/chat-import/` | 从 Claude Code/Codex 导入对话 |
| `lib/capability-routes.ts` | 能力路由配置 |
| `hooks/useSmoothStreamText.ts` | 流式文本平滑显示 |
| `hooks/useChatAutoScroll.ts` | 自动滚动 |

#### 2.8.3 前后端通信

- **WebSocket**（主通道）：`/api/v1/ws`，NDJSON 格式事件流
- **REST API**（辅助）：CRUD 操作（KB、memory、settings 等）
- **静态资源**：`/api/outputs/*`（沙箱产物），通过 `SafeOutputStaticFiles` 白名单制提供

---

## 三、模块间交互机制

### 3.1 接口定义

#### 3.1.1 核心接口契约

| 接口 | 定义位置 | 签名 |
|------|---------|------|
| `BaseTool.execute` | `core/tool_protocol.py` | `async def execute(self, **kwargs: Any) -> ToolResult` |
| `BaseCapability.run` | `core/capability_protocol.py` | `async def run(self, context: UnifiedContext, stream: StreamBus) -> None` |
| `RAGPipeline.search` | `services/rag/pipelines/base.py` | `async def search(self, query: str, kb_name: str, **kwargs) -> Dict[str, Any]` |
| `SandboxService.run` | `services/sandbox/service.py` | `async def run(self, request: ExecRequest, user_id: str) -> ExecResult` |
| `MemoryStore.read_doc` | `services/memory/store.py` | `def read_doc(self, layer: Layer, key: str) -> Document` |
| `LLMFactory.complete` | `services/llm/factory.py` | `async def complete(prompt, system_prompt, model, ...) -> str` |
| `LoopCapability.is_active` | `capabilities/protocol.py` | `def is_active(self, context: UnifiedContext) -> bool` |

#### 3.1.2 OpenAI Function Calling Schema

工具通过 `ToolDefinition.to_openai_schema()` 生成：

```json
{
  "type": "function",
  "function": {
    "name": "rag",
    "description": "...",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {"type": "string", "description": "..."}
      },
      "required": ["query"]
    }
  }
}
```

`raw_parameters` 字段优先用于 MCP 等任意 JSON Schema 工具。

### 3.2 数据流转方式

#### 3.2.1 主数据流（一次 turn）

```
用户输入
    ↓
[UnifiedContext 构建]  ← session_store 加载 history
    ↓
[ChatOrchestrator.handle(context)]
    ↓
[Capability.run(context, bus)]
    ↓
[AgentLoop] ←→ [LLM Service] ←→ [LLM Provider]
    ↓ ↑
[ToolRegistry.execute(name, **kwargs)] ← 工具调用
    ↓
[BaseTool.execute(**kwargs)] → ToolResult
    ↓
[StreamBus.emit(StreamEvent)] → 订阅者（CLI/WS/SDK）
    ↓
[TurnRuntimeManager] → SQLite 持久化
    ↓
[EventBus.publish(CAPABILITY_COMPLETE)] → 跨模块监听
```

#### 3.2.2 配置数据流

```
data/user/settings/*.json
    ↓
[RuntimeSettingsService.load_*_settings()]
    ↓
[export_runtime_settings_to_env()]  ← 覆盖环境变量
    ↓
[LLMConfig / EmbeddingConfig / ...]  ← 通过 ContextVar 多用户隔离
    ↓
[BaseAgent / Tool / Capability]  ← 运行时读取
```

**关键设置文件**：
- `system.json` — 端口、CORS、沙箱开关
- `auth.json` — 认证开关、用户名、密码哈希、token 过期
- `integrations.json` — PocketBase 配置
- `model_catalog.json` — LLM/Embedding/ImageGen/VideoGen 模型配置
- `document_parsing.json` — 文档解析引擎配置
- `agents.yaml` — Agent 参数（temperature, max_tokens）
- `main.yaml` — 工具配置（web_search 等）

#### 3.2.3 持久化数据布局

```
data/user/
├── chat_history.db              # SQLite（sessions/messages/turns）
├── logs/                        # 日志
├── settings/                    # 运行时设置 JSON/YAML
└── workspace/
    ├── memory/                  # 三层记忆
    │   ├── trace/<surface>/<date>.jsonl
    │   ├── l2/<surface>.md
    │   └── l3/{recent,profile,scope,preferences}.md
    ├── notebook/                # 笔记本
    ├── co-writer/               # 协作写作
    ├── book/                    # Book 引擎产物
    ├── skills/                  # 用户技能
    └── chat/
        ├── chat/                # chat 产物
        ├── deep_solve/
        ├── deep_question/
        ├── deep_research/
        ├── math_animator/
        └── _detached_code_execution/  # 沙箱工作区
```

多用户模式下：`data/users/<uid>/` 镜像上述结构。

### 3.3 依赖关系

#### 3.3.1 模块依赖图（简化）

```
deeptutor_cli  ──→  deeptutor.app  ──→  deeptutor.runtime
                                              ↓
                                    deeptutor.core (协议层)
                                       ↓        ↓
                          deeptutor.tools    deeptutor.capabilities
                                       ↓        ↓
                                    deeptutor.agents
                                       ↓
                                    deeptutor.services
                                       ↓
                                    deeptutor.knowledge / partners / multi_user / book / ...
                                       ↓
                                    deeptutor.api
                                       ↓
                                    web (前端，独立)
```

#### 3.3.2 关键依赖原则

1. **core 无依赖**：`deeptutor/core/` 不依赖任何上层模块
2. **runtime 依赖 core**：编排层依赖协议层
3. **tools 依赖 core + services**：工具实现调用服务
4. **capabilities 依赖 core + tools + agents**：能力组合工具和 agent
5. **agents 依赖 core + services**：agent 实现调用服务
6. **api 依赖 runtime + services**：API 路由调用编排和服务
7. **services 依赖 core**：服务层只依赖协议层，互不依赖（除 facade）

#### 3.3.3 循环依赖规避

- **延迟导入**：工具的 `execute()` 内部 `from deeptutor.tools.xxx import yyy`，避免模块加载时循环
- **Protocol 而非具体类**：`LoopCapability` 是 `Protocol`，chat pipeline 不导入具体能力
- **注册表解耦**：ToolRegistry / CapabilityRegistry 通过字符串路径延迟加载

### 3.4 通信协议

#### 3.4.1 WebSocket 事件协议（NDJSON）

客户端 → 服务端消息：

```json
{
  "type": "start_turn",
  "session_id": "sess_xxx",
  "content": "用户消息",
  "capability": "chat",
  "tools": ["web_search", "rag"],
  "knowledge_bases": ["my-kb"],
  "language": "zh",
  "config": {"temperature": 0.7},
  "attachments": [...],
  "notebook_references": [...],
  "history_references": [...]
}
```

服务端 → 客户端事件（`StreamEvent.to_dict()`）：

```json
{
  "type": "content",
  "source": "chat",
  "stage": "responding",
  "content": "流式文本块...",
  "metadata": {
    "call_id": "call_xxx",
    "call_kind": "agent_loop_round",
    "call_role": "finish"
  },
  "session_id": "sess_xxx",
  "turn_id": "turn_xxx",
  "seq": 42,
  "timestamp": 1718860800.123
}
```

#### 3.4.2 LLM 通信协议

**OpenAI Function Calling**（主协议）：
- 模型返回 `tool_calls` 数组
- 系统执行后追加 `role=tool` 消息
- 支持原生 tool calling 的模型直接使用，否则降级

**Label Protocol**（用于 deep_research 等独立流水线）：
- 模型输出以 ````LABEL```` 开头
- `LABEL_PROBE_MAX_CHARS` 字符内解析标签
- 标签集：`THINK` / `TOOL` / `FINISH` / `OUTLINE` / `INTRO` / `SECTION` / `CONCLUSION` / `APPEND`

#### 3.4.3 MCP 协议

通过 `mcp` SDK 连接 MCP server：
- stdio / SSE 传输
- 工具适配器转为 `BaseTool` 子类
- 标记 `deferred=True`，通过 `load_tools` 渐进式披露

#### 3.4.4 Partner IM 协议

每个 Channel 实现 `base.py` 接口：
- `connect()` / `disconnect()` — 生命周期
- `send_message(outbound)` — 发送
- `receive_message()` → `InboundMessage` — 接收
- 通过 `MessageBus` 解耦

---

## 四、项目复现的关键注意事项

### 4.1 环境配置要求

#### 4.1.1 Python 环境

- **Python >= 3.11**（必须，使用 dataclass slots、Protocol、`from __future__ import annotations`）
- 推荐 3.12 / 3.13
- 虚拟环境：`python -m venv venv`

#### 4.1.2 系统依赖（按需）

| 依赖 | 用途 | 安装方式 |
|------|------|---------|
| LaTeX | Manim 数学动画渲染 | MiKTeX/TeX Live |
| cairo + pkg-config + cmake | Manim 编译 | 系统包管理器 |
| ffmpeg | Manim 视频编码 | 系统包管理器 |
| libolm | Matrix E2EE | 系统包管理器 |
| gh CLI | GitHub 工具 | 系统包管理器 |
| Node.js 18+ | 前端构建 | nvm |

#### 4.1.3 运行时数据目录

**必须创建** `data/user/` 目录结构（首次启动会自动创建，但需写权限）：

```
DEEPTUTOR_HOME=/path/to/workspace
```

环境变量优先级：显式参数 > `DEEPTUTOR_HOME` > 当前工作目录。

#### 4.1.4 配置文件初始化

首次运行需通过 `ensure_runtime_settings_files()` 创建默认设置：
- `data/user/settings/system.json`
- `data/user/settings/auth.json`
- `data/user/settings/integrations.json`
- `data/user/settings/model_catalog.json`（**关键**：需配置至少一个 LLM 模型）
- `data/user/settings/document_parsing.json`

**注意**：项目根的 `.env` 文件 **被故意忽略**，所有配置走 JSON 设置文件。

### 4.2 第三方依赖版本控制

#### 4.2.1 关键版本约束（必须遵守）

| 依赖 | 版本约束 | 原因 |
|------|---------|------|
| `pdfplumber` | `>=0.11.0,<0.11.8` | 0.11.8+ pins `pdfminer.six==20251230`，与 mineru（via raganything）冲突 |
| `numpy` | `>=1.24.0,<3.0.0` | numpy 3.x 有破坏性变更 |
| `loguru` | `>=0.7.3,<1.0.0` | 1.0 可能有 API 变更 |
| `json-repair` | `>=0.57.0,<1.0.0` | 1.0 可能有 API 变更 |
| `llama-index-retrievers-bm25` | `>=0.7.1,<0.8.0` | 0.8.x API 变更 |
| `croniter` | `>=6.0.0,<7.0.0` | 7.0 可能有 API 变更 |
| `mcp` | `>=1.26.0,<2.0.0` | 2.0 可能有 API 变更 |
| `matrix-nio` | `>=0.25.2,<1.0.0` | 1.0 可能有 API 变更 |
| `graphrag` | `>=3.0.0,<4.0.0` | 4.0 API 变更 |
| `python-telegram-bot` | `>=22.6,<23.0` | 23.0 API 变更 |

#### 4.2.2 安装策略

```bash
# 完整安装（CLI + Web/API + 打包的 Web 资源）
pip install deeptutor

# 仅 CLI
pip install deeptutor-cli

# 源码开发安装
pip install -e .

# 可选 extras
pip install -e ".[cli]"          # CLI 依赖集
pip install -e ".[server]"       # Web/API 服务器依赖
pip install -e ".[partners]"     # Partner 渠道 SDK + MCP
pip install -e ".[matrix]"       # Matrix 渠道（非 E2EE）
pip install -e ".[matrix-e2e]"   # Matrix + E2EE（需 libolm）
pip install -e ".[math-animator]" # Manim 数学动画
pip install -e ".[graphrag]"     # GraphRAG 引擎
pip install -e ".[rag-lightrag]" # LightRAG + RAG-Anything
pip install -e ".[parse]"        # 文档解析引擎（markitdown + docling）
pip install -e ".[dev]"          # 测试/lint 工具
pip install -e ".[all]"          # 全部（除 graphrag/lightrag/parse）
```

#### 4.2.3 前端依赖

```bash
cd web
npm install
# 关键依赖（package.json）：
# next: 16.2.3, react: 19.0.0, typescript: 5.x
# tailwindcss: 3.4.17, i18next: 25.8.0
```

### 4.3 核心模块实现优先级

复现时建议按以下顺序实现（每层完成后可独立测试）：

#### Phase 1: 协议层（必须最先）

**优先级：P0（阻断一切）**

1. `deeptutor/core/context.py` — `UnifiedContext`, `Attachment`
2. `deeptutor/core/stream.py` — `StreamEvent`, `StreamEventType`
3. `deeptutor/core/stream_bus.py` — `StreamBus`（含 `register_bus`/`unregister_bus`/`get_bus`）
4. `deeptutor/core/tool_protocol.py` — `BaseTool`, `ToolDefinition`, `ToolParameter`, `ToolResult`, `ToolPromptHints`
5. `deeptutor/core/capability_protocol.py` — `BaseCapability`, `CapabilityManifest`
6. `deeptutor/core/agentic/` — `UsageTracker`, `LLMClientConfig`, `dispatch_tool_calls`, `run_agentic_loop`
7. `deeptutor/core/trace.py` — trace metadata 工具
8. `deeptutor/core/i18n.py` — 国际化基础

#### Phase 2: 基础设施层

**优先级：P0（阻断服务层）**

1. `deeptutor/runtime/home.py` — `get_runtime_home()`, `get_runtime_data_root()`
2. `deeptutor/services/path_service.py` — `PathService`（单例，路径管理）
3. `deeptutor/services/config/` — `RuntimeSettingsService`, `loader.py`
4. `deeptutor/services/prompt/manager.py` — `PromptManager`（单例，YAML 加载）
5. `deeptutor/logging/` — 日志配置

#### Phase 3: LLM 服务层

**优先级：P0（阻断所有能力）**

1. `deeptutor/services/llm/config.py` — `LLMConfig`（ContextVar 隔离）
2. `deeptutor/services/llm/capabilities.py` — provider 能力检测
3. `deeptutor/services/llm/multimodal.py` — 多模态消息准备
4. `deeptutor/services/llm/factory.py` — `complete()` / `stream()` 工厂
5. `deeptutor/services/llm/provider_factory.py` — provider 实例化
6. `deeptutor/services/llm/provider_core/` — 各 provider 实现
7. `deeptutor/services/provider_registry.py` — provider 注册表

#### Phase 4: 运行时编排层

**优先级：P0（阻断入口点）**

1. `deeptutor/runtime/registry/tool_registry.py` — `ToolRegistry`
2. `deeptutor/runtime/registry/capability_registry.py` — `CapabilityRegistry`
3. `deeptutor/runtime/bootstrap/builtin_capabilities.py` — 能力类路径表
4. `deeptutor/runtime/orchestrator.py` — `ChatOrchestrator`
5. `deeptutor/events/event_bus.py` — `EventBus`

#### Phase 5: 核心 Tools + Chat 能力

**优先级：P0（最小可用产品）**

1. `deeptutor/tools/builtin/__init__.py` — 工具注册
2. 最小工具集：`RAGTool`, `WebSearchTool`, `WebFetchTool`, `AskUserTool`
3. `deeptutor/agents/chat/` — `ChatCapability`, `AgenticChatPipeline`, `AgentLoop`, `ChatPromptAssembler`
4. `deeptutor/agents/_shared/tool_composition.py` — 工具挂载策略

**至此达到最小可用：CLI 可跑 chat 能力。**

#### Phase 6: 服务层扩展

**优先级：P1**

1. `deeptutor/services/rag/` — RAG 多引擎
2. `deeptutor/services/memory/` — 三层记忆
3. `deeptutor/services/sandbox/` — 沙箱
4. `deeptutor/services/search/` — 网页搜索
5. `deeptutor/services/parsing/` — 文档解析
6. `deeptutor/services/session/` — 会话持久化
7. `deeptutor/services/skill/` — 技能系统
8. `deeptutor/services/mcp/` — MCP 客户端
9. `deeptutor/services/embedding/` — Embedding 服务

#### Phase 7: 其他能力

**优先级：P2**

1. `deep_solve`, `deep_question`, `deep_research`
2. `visualize`, `math_animator`
3. `mastery_path`

#### Phase 8: API + 前端

**优先级：P2**

1. `deeptutor/api/` — FastAPI 路由
2. `web/` — Next.js 前端

#### Phase 9: 扩展系统

**优先级：P3**

1. `deeptutor/multi_user/` — 多用户
2. `deeptutor/partners/` — Partner IM 渠道
3. `deeptutor/book/` — Book 引擎
4. `deeptutor/co_writer/` — 协作写作
5. `deeptutor/learning/` — 学习系统

### 4.4 潜在技术难点

#### 4.4.1 异步流式架构

**难点**：`StreamBus` 的多订阅者 fan-out + 历史重放 + 实时事件的无缝衔接。

**关键实现细节**（[deeptutor/core/stream_bus.py](file:///e:/DeepTutor-main/deeptutor/core/stream_bus.py)）：
```python
async def subscribe(self) -> AsyncIterator[StreamEvent]:
    q: asyncio.Queue[StreamEvent | None] = asyncio.Queue()
    self._subscribers.append(q)
    replay_count = len(self._history)  # 关键：同步快照
    try:
        for event in self._history[:replay_count]:  # 先重放历史
            yield event
        if self._closed and q.empty():
            return
        while True:  # 再接实时
            event = await q.get()
            if event is None:
                break
            yield event
    finally:
        self._subscribers.remove(q)
```

**陷阱**：若不快照 `replay_count`，重放期间新发射的事件会被重复投递（list-append + queue copy）。

#### 4.4.2 ask_user 暂停-恢复机制

**难点**：在 agentic loop 中暂停等待用户回复，恢复后继续 **同一轮** 迭代。

**实现**：
1. 工具返回 `ToolResult(pause_for_user=payload)`
2. Chat pipeline 检测到 `pause_for_user`，发射 `wait_for_input` 事件
3. Loop 暂停，等待 `StreamBus.wait_for_input()` 返回
4. WS 客户端发送 `submit_user_reply` → `bus.submit_input(content)`
5. 用户回复被替换为工具的 `role=tool` 消息体
6. Loop 继续下一轮

**陷阱**：超时处理（CLI 无法发送输入时用 `timeout` 参数）、bus 注册表清理。

#### 4.4.3 多用户 ContextVar 隔离

**难点**：每个请求需隔离 `CurrentUser`、`LLMConfig`、`PathService` 实例。

**实现**：
- `contextvars.ContextVar` 持有当前用户
- `user_context()` 上下文管理器设置/重置
- `PathService` 按 user_id 解析路径
- `LLMConfig` 通过 ContextVar 实现每用户配置

**陷阱**：异步任务的 ContextVar 继承（`asyncio.create_task` 自动复制 context）。

#### 4.4.4 工具并发调度

**难点**：LLM 一次返回多个 tool_calls，需并行执行但限制并发。

**实现**（`deeptutor/core/agentic/tool_dispatch.py`）：
- `MAX_PARALLEL_TOOL_CALLS` 限制
- `asyncio.gather` 并行
- 每个工具有独立的子 trace（call_id）

**陷阱**：工具异常隔离（一个失败不影响其他）、`pause_for_user` 的短路（遇到立即停止其他）。

#### 4.4.5 RAG 索引版本化

**难点**：切换 embedding 模型时，旧索引失效但不删除。

**实现**（`deeptutor/services/rag/index_versioning.py`）：
- Embedding signature = hash(model + endpoint + dim)
- 索引目录按 signature 命名
- 检测到 signature 不匹配 → 标记 stale → 触发重建
- 旧索引保留（回滚能力）

**陷阱**：signature 算法需稳定、跨平台一致。

#### 4.4.6 渐进式工具披露（Deferred Tools）

**难点**：MCP 工具数量可能很多，全塞进初始 schema 会爆上下文。

**实现**：
1. `BaseTool.deferred = True` 的工具不进初始工具列表
2. system prompt 携带一行清单（`render_deferred_tools_manifest`）
3. `load_tools` 工具按需加载 schema
4. `DeferredToolLoader` 管理 loaded 状态

**陷阱**：loaded 状态是 per-turn 的（不跨 turn 持久化）、未知工具名的错误处理。

#### 4.4.7 LLM Provider 多态

**难点**：不同 provider（OpenAI/Anthropic/Azure/Codex/Copilot）的 API 差异。

**实现**：
- `LLMProvider` 基类 + 多个子类
- `provider_factory.get_runtime_provider(config)` 按 `binding` 选择
- `capabilities.py` 检测各 provider 的能力（tools/vision/streaming/response_format）
- `multimodal.py` 处理不同 provider 的图片格式差异

**陷阱**：Anthropic 的 system prompt 在 messages 外、Azure 的 api_version、Codex 的特殊认证。

#### 4.4.8 Inline Think 标签流式过滤

**难点**：部分 provider 将推理内联在 content 通道（`<think>...</think>`），需流式分离。

**实现**（`InlineThinkFilter`）：
- 增量状态机（`_in_think` 标志）
- 部分标签 holdback（`_TAG_HOLDBACK_CHARS=24`）
- `feed(chunk)` 返回 `(kind, text)` 段列表
- `flush()` 释放末尾缓冲

**陷阱**：标签跨 chunk 边界、不完整标签的延迟决策。

#### 4.4.9 Partner 运行时的合成用户 scope

**难点**：Partner 是 IM 连接的，但需复用 chat 的 agent loop，且工具读 partner workspace。

**实现**：
- `partner_user()` 创建合成 `CurrentUser`
- `user_context()` 设置 ContextVar
- 工具通过 `PathService` 间接读路径（自动走 partner workspace）
- 强制挂载 partner_* 工具，抑制 read_memory/write_memory

**陷阱**：ContextVar 在异步任务间的传播、partner 的 memory surface 隔离。

#### 4.4.10 配置漂移检测

**难点**：能力 manifest 引用的工具可能未注册（插件缺失/拼写错误）。

**实现**（`deeptutor/api/main.py:validate_tool_consistency`）：
- 启动时校验 `manifest.tools_used` ⊆ `tool_registry.list_tools()`
- 漂移则 `raise RuntimeError`，阻止启动

**陷阱**：可选依赖的工具（如 manim 相关）需优雅跳过。

#### 4.4.11 前端流式渲染

**难点**：NDJSON 事件流 → 平滑文本渲染 + 多种 call_role 的 UI 差异。

**实现**：
- `useSmoothStreamText` hook — 平滑字符显示
- `useChatAutoScroll` — 自动滚动
- `message-branches.ts` — 消息分支（regenerate）
- `think-segments.ts` — thinking 段分离
- `message-content.ts` — 内容块解析

**陷阱**：narration vs finish 的 UI 区分、取消 turn 的清理、重连后的事件回放。

#### 4.4.12 沙箱安全

**难点**：执行用户代码需隔离，但又要能读写工作区文件。

**实现**：
- 多后端：runner sidecar（最强）/ bwrap（中等）/ 受限 subprocess（最弱，默认）
- `Mount` 机制：只挂载工作区目录
- `ResourceLimits`：timeout + max_output_chars
- `UserExecQuota`：每用户并发 + RPM 限制
- `IsolationLevel`：SYSTEM（所有人可用）/ APPLICATION（仅管理员）
- `collect_public_artifacts`：白名单制产物收集

**陷阱**：Windows 上 bwrap 不可用、路径权限、符号链接逃逸。

---

## 附录：关键文件索引

| 文件 | 用途 |
|------|------|
| [deeptutor/core/context.py](file:///e:/DeepTutor-main/deeptutor/core/context.py) | `UnifiedContext` 数据载体 |
| [deeptutor/core/stream.py](file:///e:/DeepTutor-main/deeptutor/core/stream.py) | `StreamEvent` 协议 |
| [deeptutor/core/stream_bus.py](file:///e:/DeepTutor-main/deeptutor/core/stream_bus.py) | `StreamBus` 异步事件总线 |
| [deeptutor/core/tool_protocol.py](file:///e:/DeepTutor-main/deeptutor/core/tool_protocol.py) | `BaseTool` 工具协议 |
| [deeptutor/core/capability_protocol.py](file:///e:/DeepTutor-main/deeptutor/core/capability_protocol.py) | `BaseCapability` 能力协议 |
| [deeptutor/core/agentic/](file:///e:/DeepTutor-main/deeptutor/core/agentic/) | Agentic 引擎原语 |
| [deeptutor/runtime/orchestrator.py](file:///e:/DeepTutor-main/deeptutor/runtime/orchestrator.py) | `ChatOrchestrator` 统一入口 |
| [deeptutor/runtime/registry/tool_registry.py](file:///e:/DeepTutor-main/deeptutor/runtime/registry/tool_registry.py) | 工具注册表 |
| [deeptutor/runtime/registry/capability_registry.py](file:///e:/DeepTutor-main/deeptutor/runtime/registry/capability_registry.py) | 能力注册表 |
| [deeptutor/runtime/bootstrap/builtin_capabilities.py](file:///e:/DeepTutor-main/deeptutor/runtime/bootstrap/builtin_capabilities.py) | 内置能力清单 |
| [deeptutor/runtime/home.py](file:///e:/DeepTutor-main/deeptutor/runtime/home.py) | 运行时根目录解析 |
| [deeptutor/tools/builtin/__init__.py](file:///e:/DeepTutor-main/deeptutor/tools/builtin/__init__.py) | 所有内置工具实现 |
| [deeptutor/agents/chat/agentic_pipeline.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/agentic_pipeline.py) | Chat 能力流水线 |
| [deeptutor/agents/chat/agent_loop.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/agent_loop.py) | 单循环多轮智能体 |
| [deeptutor/agents/chat/prompt_blocks.py](file:///e:/DeepTutor-main/deeptutor/agents/chat/prompt_blocks.py) | System prompt 组装 |
| [deeptutor/agents/base_agent.py](file:///e:/DeepTutor-main/deeptutor/agents/base_agent.py) | 独立流水线 agent 基类 |
| [deeptutor/agents/_shared/tool_composition.py](file:///e:/DeepTutor-main/deeptutor/agents/_shared/tool_composition.py) | 工具挂载策略 |
| [deeptutor/capabilities/protocol.py](file:///e:/DeepTutor-main/deeptutor/capabilities/protocol.py) | `LoopCapability` 协议 |
| [deeptutor/services/llm/factory.py](file:///e:/DeepTutor-main/deeptutor/services/llm/factory.py) | LLM 工厂 |
| [deeptutor/services/llm/config.py](file:///e:/DeepTutor-main/deeptutor/services/llm/config.py) | `LLMConfig` |
| [deeptutor/services/rag/service.py](file:///e:/DeepTutor-main/deeptutor/services/rag/service.py) | RAG 服务 |
| [deeptutor/services/rag/factory.py](file:///e:/DeepTutor-main/deeptutor/services/rag/factory.py) | RAG pipeline 工厂 |
| [deeptutor/services/memory/store.py](file:///e:/DeepTutor-main/deeptutor/services/memory/store.py) | `MemoryStore` 记忆 facade |
| [deeptutor/services/sandbox/service.py](file:///e:/DeepTutor-main/deeptutor/services/sandbox/service.py) | 沙箱服务 |
| [deeptutor/services/session/turn_runtime.py](file:///e:/DeepTutor-main/deeptutor/services/session/turn_runtime.py) | Turn 运行时管理 |
| [deeptutor/services/config/runtime_settings.py](file:///e:/DeepTutor-main/deeptutor/services/config/runtime_settings.py) | 运行时设置服务 |
| [deeptutor/services/path_service.py](file:///e:/DeepTutor-main/deeptutor/services/path_service.py) | 路径服务 |
| [deeptutor/services/prompt/manager.py](file:///e:/DeepTutor-main/deeptutor/services/prompt/manager.py) | Prompt 管理器 |
| [deeptutor/api/main.py](file:///e:/DeepTutor-main/deeptutor/api/main.py) | FastAPI 应用入口 |
| [deeptutor/api/routers/unified_ws.py](file:///e:/DeepTutor-main/deeptutor/api/routers/unified_ws.py) | 统一 WebSocket 端点 |
| [deeptutor/app/facade.py](file:///e:/DeepTutor-main/deeptutor/app/facade.py) | `DeepTutorApp` SDK facade |
| [deeptutor_cli/main.py](file:///e:/DeepTutor-main/deeptutor_cli/main.py) | CLI 入口 |
| [pyproject.toml](file:///e:/DeepTutor-main/pyproject.toml) | Python 项目配置 + 依赖 |
| [web/package.json](file:///e:/DeepTutor-main/web/package.json) | 前端依赖 |
| [AGENTS.md](file:///e:/DeepTutor-main/AGENTS.md) | Agent-native 架构总览 |

---

**文档结束**

本文档基于 DeepTutor 1.4.8 源码分析生成，覆盖架构、模块、交互、复现四个维度。复现时建议从 Phase 1（协议层）开始，逐步叠加，每层完成后通过 `pytest` 验证（测试套件见 `tests/`）。
