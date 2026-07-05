# DeepTutor 项目代码结构说明

**版本**: 1.4.8 | **许可证**: Apache-2.0 | **Python要求**: >=3.11

DeepTutor 是一个 **Agent-native** 智能学习伴侣，具备多智能体协作和 RAG 能力，采用两层插件模型——单次 **Tools**（Level 1）和多阶段 **Capabilities**（Level 2），通过 CLI、WebSocket API、Python SDK 三个入口点提供服务。

***

## 目录

- [顶层目录与文件](#顶层目录与文件)
- [deeptutor/ 主包](#deeptutor-主包)
  - [核心层 core/](#核心层-core)
  - [运行时层 runtime/](#运行时层-runtime)
  - [应用门面 app/](#应用门面-app)
  - [API 层 api/](#api-层-api)
  - [能力层 capabilities/](#能力层-capabilities)
  - [工具层 tools/](#工具层-tools)
  - [智能体层 agents/](#智能体层-agents)
  - [服务层 services/](#服务层-services)
  - [知识库层 knowledge/](#知识库层-knowledge)
  - [Book 引擎 book/](#book-引擎-book)
  - [协作写作 co\_writer/](#协作写作-co_writer)
  - [学习系统 learning/](#学习系统-learning)
  - [Partner 系统 partners/](#partner-系统-partners)
  - [多用户系统 multi\_user/](#多用户系统-multi_user)
  - [其他子包](#其他子包)
- [deeptutor\_cli/ CLI 包](#deeptutor_cli-cli-包)
- [web/ 前端](#web-前端)
- [tests/ 测试套件](#tests-测试套件)
- [配置与依赖文件](#配置与依赖文件)
- [架构总结](#架构总结)

***

## 顶层目录与文件

| 路径                                                                          | 用途                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `deeptutor/`                                                                | Python 主包，核心业务逻辑                                           |
| `deeptutor_cli/`                                                            | CLI 命令行接口包（Typer）                                          |
| `deeptutor_web/`                                                            | Web 前端打包桥接（仅含 `__init__.py`）                               |
| `web/`                                                                      | Next.js 前端源码（TypeScript/React）                             |
| `tests/`                                                                    | Python 测试套件                                                |
| `scripts/`                                                                  | 运维/部署脚本                                                    |
| `requirements/`                                                             | 分组依赖文件                                                     |
| `assets/`                                                                   | 文档图片、Logo、发布说明                                             |
| `packaging/`                                                                | 打包配置（含 deeptutor-cli 的独立 README）                           |
| `.github/`                                                                  | GitHub Actions CI/CD、Issue 模板、PR 模板                        |
| `pyproject.toml`                                                            | 项目构建配置（setuptools + Black + Ruff + pytest + mypy + bandit） |
| `Dockerfile` / `Dockerfile.runner`                                          | Docker 镜像定义                                                |
| `docker-compose.yml` / `docker-compose.dev.yml` / `docker-compose.ghcr.yml` | Docker Compose 编排                                          |
| `AGENTS.md`                                                                 | Agent 架构说明文档                                               |
| `SKILL.md`                                                                  | Skill 系统说明                                                 |
| `MANIFEST.in`                                                               | setuptools 打包清单                                            |
| `.pre-commit-config.yaml`                                                   | pre-commit 钩子                                              |
| `.secrets.baseline`                                                         | detect-secrets 基线                                          |

***

## deeptutor/ 主包

### 核心层 core/

项目的基础协议和数据结构定义。

| 文件                         | 用途                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context.py`               | `UnifiedContext` 数据类——贯穿整个系统的统一上下文对象，包含 session\_id、user\_message、conversation\_history、enabled\_tools、knowledge\_bases、attachments、memory\_context、persona\_context 等          |
| `stream.py`                | `StreamEvent` + `StreamEventType`——流式事件协议，定义了 stage\_start/end、thinking、observation、content、tool\_call/result、progress、sources、result、error、session、done、wait\_for\_input 等事件类型 |
| `stream_bus.py`            | `StreamBus`——异步扇出事件总线，支持多消费者订阅、历史回放、stage 上下文管理器、用户输入等待                                                                                                                         |
| `tool_protocol.py`         | `BaseTool` + `ToolDefinition` + `ToolParameter` + `ToolResult`——Level 1 工具协议基类，定义了 get\_definition()、execute()、deferred 标记、pause\_for\_user 机制                                  |
| `capability_protocol.py`   | `BaseCapability` + `CapabilityManifest`——Level 2 能力协议基类，定义了 manifest 和 run()                                                                                                    |
| `errors.py`                | 统一错误定义                                                                                                                                                                          |
| `i18n.py`                  | 国际化基础设施                                                                                                                                                                         |
| `trace.py`                 | 追踪元数据合并                                                                                                                                                                         |
| `agentic/loop.py`          | Agentic 循环——LLM 调用的核心循环逻辑                                                                                                                                                       |
| `agentic/client.py`        | Agentic 客户端——LLM 客户端封装                                                                                                                                                          |
| `agentic/labels.py`        | 步骤标签系统                                                                                                                                                                          |
| `agentic/usage.py`         | 用量追踪（UsageTracker）                                                                                                                                                              |
| `agentic/tool_dispatch.py` | 工具调度逻辑                                                                                                                                                                          |
| `agentic/labeled_step.py`  | 标记步骤（think/tool/finish）                                                                                                                                                         |

### 运行时层 runtime/

系统的编排和启动逻辑。

| 文件                                | 用途                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `orchestrator.py`                 | `ChatOrchestrator`——统一入口，将 UnifiedContext 路由到对应 Capability，管理 StreamBus 生命周期 |
| `launcher.py`                     | 后端+前端启动器——端口发现、进程管理、冲突解决、打包 Web 部署                                           |
| `home.py`                         | 运行时主目录解析（DEEPTUTOR\_HOME 环境变量）                                               |
| `banner.py`                       | 启动横幅打印                                                                       |
| `mode.py`                         | 运行模式（CLI/SERVER）                                                             |
| `registry/tool_registry.py`       | ToolRegistry——Level 1 工具注册表                                                  |
| `registry/capability_registry.py` | CapabilityRegistry——Level 2 能力注册表                                            |

### 应用门面 app/

| 文件          | 用途                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `facade.py` | `DeepTutorApp`——Python SDK 门面类，封装 runtime/session/notebook/capability 操作；`TurnRequest` 数据类定义标准 turn 请求 |

### API 层 api/

FastAPI Web 服务，提供 REST 和 WebSocket 接口。

| 文件                        | 用途                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.py`                 | FastAPI 应用定义——CORS、路由注册、生命周期管理（启动 LLM 客户端/EventBus/Partners/Cron，关闭时逆序清理）                                                                      |
| `run_server.py`           | uvicorn 服务器启动                                                                                                                                  |
| `routers/unified_ws.py`   | 统一 WebSocket 端点 `/api/v1/ws`——支持 start\_turn、subscribe\_turn、cancel\_turn、submit\_user\_reply、regenerate、check\_active\_turn、user\_input 等消息类型 |
| `routers/auth.py`         | JWT 认证路由                                                                                                                                       |
| `routers/chat.py`         | 聊天 REST 路由                                                                                                                                     |
| `routers/knowledge.py`    | 知识库管理路由                                                                                                                                        |
| `routers/memory.py`       | 记忆系统路由                                                                                                                                         |
| `routers/book.py`         | Book 引擎路由                                                                                                                                      |
| `routers/co_writer.py`    | 协作写作路由                                                                                                                                         |
| `routers/mastery_path.py` | 掌握路径/学习路由                                                                                                                                      |
| `routers/question.py`     | 深度提问路由                                                                                                                                         |
| `routers/sessions.py`     | 会话管理路由                                                                                                                                         |
| `routers/settings.py`     | 设置路由                                                                                                                                           |
| `routers/skills.py`       | 技能 Hub 路由                                                                                                                                      |
| `routers/subagents.py`    | 子智能体路由                                                                                                                                         |
| `routers/personas.py`     | 人格设置路由                                                                                                                                         |
| `routers/voice.py`        | 语音路由                                                                                                                                           |
| `routers/tools.py`        | 工具配置路由                                                                                                                                         |
| `routers/system.py`       | 系统状态路由                                                                                                                                         |
| `routers/partners.py`     | Partner 管理路由（admin-gated）                                                                                                                      |
| `routers/attachments.py`  | 文件附件路由                                                                                                                                         |
| `routers/notebook.py`     | 笔记本路由                                                                                                                                          |
| `routers/quiz_judge.py`   | AI 评判 WebSocket                                                                                                                                |
| `routers/mcp_settings.py` | MCP 配置路由                                                                                                                                       |
| `routers/agent_config.py` | 智能体配置路由                                                                                                                                        |
| `routers/imports.py`      | 导入路由                                                                                                                                           |
| `routers/dashboard.py`    | 仪表盘路由                                                                                                                                          |
| `routers/plugins_api.py`  | 插件 API 路由                                                                                                                                      |

### 能力层 capabilities/

Level 2 多阶段能力管线，每个能力接管整个 turn。

| 文件/目录              | 用途                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `protocol.py`      | `LoopCapability`——循环能力协议，含 is\_active()、owned\_tools、exclusive\_tools                                          |
| `registry.py`      | 内置循环能力注册表——MasteryLoop、SolveLoop、Obsidian、Subagent、ExploreContext                                              |
| `solve/`           | Deep Solve 能力——多智能体问题求解（planning -> reasoning -> writing），含 loop.py、capability.py、tools.py、session.py、prompts/ |
| `mastery/`         | Mastery Path 能力——引导式学习，含 loop.py、capability.py、tools.py、prompts/                                               |
| `obsidian/`        | Obsidian 知识库能力——Obsidian Vault 集成，含 capability.py、tools.py、vault.py、binding.py、prompts/                        |
| `subagent/`        | 子智能体能力——连接外部智能体（Claude Code/Codex），含 capability.py、tools.py、binding.py                                         |
| `explore_context/` | 上下文探索能力——探索用户上下文，含 capability.py、explorer.py、prompts/                                                          |

### 工具层 tools/

Level 1 单次工具调用，LLM 按需选择。

| 文件                     | 用途                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `builtin/__init__.py`  | **核心文件**——所有内置工具的 BaseTool 实现类定义，包含 BrainstormTool、RAGTool、WebSearchTool、CodeExecutionTool、ReasonTool、PaperSearchToolWrapper、GeoGebraAnalysisTool、ReadSourceTool、ReadMemoryTool、WriteMemoryTool、WebFetchTool、ListNotebookTool、WriteNoteTool、GithubTool、AskUserTool、ReadSkillTool、LoadToolsTool、CronTool、ExecTool、ImagegenTool、VideogenTool、PartnerReadTool/MemorizeTool/SearchTool 等 |
| `brainstorm.py`        | 头脑风暴工具实现                                                                                                                                                                                                                                                                                                                                                                             |
| `web_search.py`        | Web 搜索实现                                                                                                                                                                                                                                                                                                                                                                             |
| `web_fetch.py`         | URL 抓取 + Markdown 提取                                                                                                                                                                                                                                                                                                                                                                 |
| `rag_tool.py`          | RAG 检索实现                                                                                                                                                                                                                                                                                                                                                                             |
| `reason.py`            | 深度推理 LLM 调用                                                                                                                                                                                                                                                                                                                                                                          |
| `paper_search_tool.py` | arXiv 论文搜索                                                                                                                                                                                                                                                                                                                                                                           |
| `ask_user.py`          | 暂停 turn 等待用户回复                                                                                                                                                                                                                                                                                                                                                                       |
| `exec_tool.py`         | 沙盒命令执行                                                                                                                                                                                                                                                                                                                                                                               |
| `cron_tool.py`         | 定时任务调度                                                                                                                                                                                                                                                                                                                                                                               |
| `file_tools.py`        | 文件操作工具                                                                                                                                                                                                                                                                                                                                                                               |
| `github_query.py`      | GitHub 只读查询                                                                                                                                                                                                                                                                                                                                                                          |
| `list_notebook.py`     | 笔记本列表发现                                                                                                                                                                                                                                                                                                                                                                              |
| `write_note.py`        | 笔记本记录写入                                                                                                                                                                                                                                                                                                                                                                              |
| `mastery_tool.py`      | 掌握路径工具                                                                                                                                                                                                                                                                                                                                                                               |
| `media_gen_tool.py`    | 图像/视频生成工具                                                                                                                                                                                                                                                                                                                                                                            |
| `partner_memory.py`    | Partner 专用记忆工具                                                                                                                                                                                                                                                                                                                                                                       |
| `tex_downloader.py`    | LaTeX 源码下载                                                                                                                                                                                                                                                                                                                                                                           |
| `tex_chunker.py`       | LaTeX 分块                                                                                                                                                                                                                                                                                                                                                                             |
| `solve_tool.py`        | 求解工具                                                                                                                                                                                                                                                                                                                                                                                 |
| `prompting/`           | 工具提示词 YAML（en/zh 双语 hints）                                                                                                                                                                                                                                                                                                                                                           |
| `question/`            | 题目提取与模拟考试工具                                                                                                                                                                                                                                                                                                                                                                          |
| `vision/`              | 视觉分析工具（image\_utils、ggb\_validator、coord\_transform、block\_parser）                                                                                                                                                                                                                                                                                                                   |

### 智能体层 agents/

智能体实现，封装 LLM 交互逻辑。

| 文件/目录                  | 用途                                                                       |
| ---------------------- | ------------------------------------------------------------------------ |
| `base_agent.py`        | `BaseAgent`——统一智能体基类，提供 LLM 配置管理、参数加载、PromptManager、统一 LLM 调用接口、Token 追踪 |
| `chat/chat_agent.py`   | `ChatAgent`——轻量对话智能体，多轮历史管理、RAG/Web 搜索增强、流式响应                            |
| `chat/agent_loop.py`   | Agentic 聊天循环                                                             |
| `chat/capability.py`   | Chat 能力实现                                                                |
| `question/pipeline.py` | 深度提问管线                                                                   |
| `question/history.py`  | 提问历史                                                                     |
| `research/pipeline.py` | 深度研究管线                                                                   |
| `visualize/models.py`  | 可视化模型                                                                    |
| `visualize/utils.py`   | 可视化工具                                                                    |
| `notebook/`            | 笔记本智能体                                                                   |

### 服务层 services/

最大的子包，包含所有后端服务。

#### LLM 服务 (`services/llm/`)

| 文件                       | 用途                                                                            |
| ------------------------ | ----------------------------------------------------------------------------- |
| `client.py`              | `LLMClient`——统一 LLM 客户端（遗留接口，新代码应使用 factory 函数）                               |
| `config.py`              | `LLMConfig`——LLM 配置模型                                                         |
| `factory.py`             | LLM 工厂函数——complete()、stream()                                                 |
| `registry.py`            | LLM 提供者注册表                                                                    |
| `provider_factory.py`    | 提供者工厂                                                                         |
| `provider_registry.py`   | 提供者注册                                                                         |
| `capabilities.py`        | LLM 能力检测（vision 等）                                                            |
| `multimodal.py`          | 多模态消息处理                                                                       |
| `telemetry.py`           | LLM 遥测                                                                        |
| `traffic_control.py`     | 流量控制                                                                          |
| `reasoning_params.py`    | 推理参数处理                                                                        |
| `context_window.py`      | 上下文窗口管理                                                                       |
| `executors.py`           | 执行器                                                                           |
| `exceptions.py`          | 异常定义                                                                          |
| `error_mapping.py`       | 错误映射                                                                          |
| `providers/open_ai.py`   | OpenAI 提供者                                                                    |
| `providers/anthropic.py` | Anthropic 提供者                                                                 |
| `providers/routing.py`   | 路由提供者                                                                         |
| `provider_core/`         | 核心提供者实现（openai\_compat、anthropic、azure\_openai、github\_copilot、openai\_codex） |

#### RAG 服务 (`services/rag/`)

| 文件/目录                    | 用途                                               |
| ------------------------ | ------------------------------------------------ |
| `service.py`             | `RAGService`——统一 RAG 服务门面，按 KB 路由到绑定管线           |
| `factory.py`             | 管线工厂——get\_pipeline()、list\_pipelines()          |
| `pipelines/llamaindex/`  | LlamaIndex RAG 管线（默认）——文档加载、嵌入适配、摄取、检索、存储        |
| `pipelines/graphrag/`    | Microsoft GraphRAG 管线——图谱知识库引擎                   |
| `pipelines/lightrag/`    | LightRAG 管线——HKUDS/LightRAG + RAG-Anything 多模态解析 |
| `pipelines/pageindex/`   | PageIndex 管线——外部索引服务                             |
| `kb_paths.py`            | 知识库路径管理                                          |
| `linked_kb.py`           | 关联知识库管理                                          |
| `preflight.py`           | 预检逻辑                                             |
| `index_probe.py`         | 索引探测                                             |
| `index_versioning.py`    | 索引版本控制                                           |
| `file_routing.py`        | 文件路由                                             |
| `smart_retriever.py`     | 智能检索器                                            |
| `embedding_signature.py` | 嵌入签名                                             |
| `provider_binding.py`    | 提供者绑定                                            |

#### 记忆服务 (`services/memory/`)

| 文件              | 用途                                                                                   |
| --------------- | ------------------------------------------------------------------------------------ |
| `store.py`      | `MemoryStore`——三层记忆子系统门面（L1 事件/L2 表面/L3 跨表面），支持 emit、read\_doc、write\_preference 等操作 |
| `document.py`   | `Document`——记忆文档模型，含 parse/serialize                                                 |
| `ops.py`        | AddOp/EditOp/ApplyReport——记忆操作定义                                                     |
| `ids.py`        | 记忆 ID 生成                                                                             |
| `paths.py`      | 记忆路径解析（Surface/L3Slot）                                                               |
| `settings.py`   | 记忆设置                                                                                 |
| `trace.py`      | `TraceEvent`——L1 追踪事件                                                                |
| `consolidator/` | 记忆整合器——audit/dedup/merge/update 模式，含 prompts/                                        |
| `snapshot/`     | 记忆快照——diff/entity/store/adapters                                                     |

#### 会话服务 (`services/session/`)

| 文件                           | 用途                                          |
| ---------------------------- | ------------------------------------------- |
| `turn_runtime.py`            | `TurnRuntimeManager`——Turn 级运行时管理器，统一聊天流式处理 |
| `unified_session_manager.py` | 统一会话管理器                                     |
| `sqlite_store.py`            | SQLite 会话存储                                 |
| `pocketbase_store.py`        | PocketBase 会话存储（多用户模式）                      |
| `context_builder.py`         | 上下文构建器                                      |
| `source_inventory.py`        | 源清单管理                                       |
| `protocol.py`                | 会话存储协议                                      |
| `base_session_manager.py`    | 基础会话管理器                                     |

#### 配置服务 (`services/config/`)

| 文件                            | 用途                                           |
| ----------------------------- | -------------------------------------------- |
| `loader.py`                   | 配置加载器——运行时 JSON 设置加载                         |
| `runtime_settings.py`         | `RuntimeSettingsService`——JSON 设置 + 进程环境变量覆盖 |
| `model_catalog.py`            | 模型目录服务                                       |
| `launch_settings.py`          | 启动设置                                         |
| `capabilities_settings.py`    | 能力设置                                         |
| `embedding_endpoint.py`       | 嵌入端点配置                                       |
| `knowledge_base_config.py`    | 知识库配置                                        |
| `origins.py`                  | CORS 源规范化                                    |
| `provider_runtime.py`         | 提供者运行时配置                                     |
| `context_window_detection.py` | 上下文窗口检测                                      |
| `test_runner.py`              | 测试运行器配置                                      |

#### 其他服务

| 目录/文件                           | 用途                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `services/auth.py`              | JWT 认证服务——默认关闭，支持单用户/多用户模式                                                              |
| `services/path_service.py`      | `PathService`——集中式运行时存储路径布局（data/user/）                                                 |
| `services/pocketbase_client.py` | PocketBase 客户端                                                                          |
| `services/generation_http.py`   | HTTP 生成服务                                                                               |
| `services/provider_registry.py` | 提供者注册表                                                                                  |
| `services/cron/`                | 定时任务服务——executor.py + service.py                                                        |
| `services/embedding/`           | 嵌入服务——多适配器（OpenAI/Jina/Cohere/DashScope/Ollama）                                         |
| `services/imagegen/`            | 图像生成服务——chat\_completions/openai\_compat 适配器                                            |
| `services/videogen/`            | 视频生成服务——async\_task 适配器                                                                 |
| `services/voice/`               | 语音服务——openai\_compat 适配器                                                                |
| `services/mcp/`                 | MCP（Model Context Protocol）服务——config/manager/network/session\_state                    |
| `services/sandbox/`             | 沙盒执行服务——runner/server、backends、config、quota、artifacts                                   |
| `services/search/`              | 搜索服务——多提供者（Brave/DuckDuckGo/Exa/Jina/Perplexity/SearXNG/Serper/Tavily/Baidu/OpenRouter） |
| `services/parsing/`             | 文档解析服务——多引擎（MinerU/Docling/MarkItDown/text\_only）                                       |
| `services/partners/`            | Partner 运行时——manager/runtime/sessions/commands/workspace/model\_runtime/scope           |
| `services/persona/`             | 人格服务                                                                                    |
| `services/prompt/`              | 提示词管理——PromptManager + 语言指令                                                             |
| `services/notebook/`            | 笔记本服务                                                                                   |
| `services/skill/`               | 技能服务——hub/service/taxonomy/credentials                                                  |
| `services/subagent/`            | 子智能体服务——base/claude\_code/codex/process/registry/sessions/images                        |
| `services/setup/`               | 初始化服务——init.py                                                                          |
| `services/storage/`             | 附件存储                                                                                    |
| `services/model_selection/`     | 模型选择——llm/runtime                                                                       |
| `services/settings/`            | 界面设置                                                                                    |

### 知识库层 knowledge/

| 文件                    | 用途                    |
| --------------------- | --------------------- |
| `manager.py`          | 知识库管理器——列表/创建/删除/状态查询 |
| `initializer.py`      | 知识库初始化                |
| `add_documents.py`    | 文档添加                  |
| `kb_types.py`         | 知识库类型定义               |
| `naming.py`           | 知识库命名规则               |
| `progress_tracker.py` | 摄取进度追踪                |

### Book 引擎 book/

交互式书籍生成与编译系统。

| 文件             | 用途                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `engine.py`    | `BookEngine`——顶层编排器，与 ChatOrchestrator 平行，管理 Book 生命周期（创建->确认->编译）                                             |
| `compiler.py`  | `BookCompiler`——页面编译器                                                                                          |
| `models.py`    | Book 数据模型（Book/Page/Block 等）                                                                                   |
| `storage.py`   | Book 存储                                                                                                        |
| `streaming.py` | Book 流式输出                                                                                                      |
| `context.py`   | Book 上下文                                                                                                       |
| `inputs.py`    | Book 输入构建                                                                                                      |
| `kb_health.py` | 知识库健康检查                                                                                                        |
| `agents/`      | Book 专用智能体（page\_planner、spine\_agent）                                                                         |
| `blocks/`      | 内容块类型（text/code/quiz/figure/animation/interactive/callout/deep\_dive/flash\_cards/timeline/section/user\_note） |
| `prompts/`     | 双语提示词（en/zh）                                                                                                   |

### 协作写作 co\_writer/

| 文件              | 用途                                  |
| --------------- | ----------------------------------- |
| `edit_agent.py` | `EditAgent`——协作写作编辑智能体，继承 BaseAgent |
| `storage.py`    | 协作写作存储                              |
| `prompts/`      | 双语提示词（en/zh）                        |

### 学习系统 learning/

| 文件             | 用途                                                  |
| -------------- | --------------------------------------------------- |
| `service.py`   | `LearningService`——学习进度管理、模块初始化、掌握度计算               |
| `mastery.py`   | 掌握度计算                                               |
| `grading.py`   | 答案评分与错误分类                                           |
| `models.py`    | 学习模型（LearningProgress/LearningModule/QuizAttempt 等） |
| `policy.py`    | 学习策略                                                |
| `scheduler.py` | 间隔重复调度器                                             |
| `storage.py`   | 学习数据存储                                              |
| `prompts.py`   | 学习提示词                                               |
| `prompts/`     | 双语 YAML 提示词                                         |

### Partner 系统 partners/

IM 渠道适配，让 DeepTutor 作为聊天机器人接入各种即时通讯平台。

| 文件/目录              | 用途                                                                           |
| ------------------ | ---------------------------------------------------------------------------- |
| `channels/`        | IM 渠道适配器——base/email/feishu/matrix/mochat/napcat/qq/slack/wecom/weixin/zulip |
| `bus/`             | 消息总线——events/queue                                                           |
| `config/`          | Partner 配置——schema/paths                                                     |
| `helpers.py`       | Partner 辅助函数                                                                 |
| `network.py`       | 网络工具                                                                         |
| `transcription.py` | 语音转写                                                                         |

### 多用户系统 multi\_user/

| 文件                | 用途         |
| ----------------- | ---------- |
| `context.py`      | 多用户上下文变量   |
| `identity.py`     | 用户身份管理     |
| `paths.py`        | 多用户路径服务    |
| `grants.py`       | 权限授予       |
| `audit.py`        | 审计日志       |
| `models.py`       | 多用户模型      |
| `router.py`       | 多用户 API 路由 |
| `model_access.py` | 模型访问控制     |
| `skill_access.py` | 技能访问控制     |
| `tool_access.py`  | 工具访问控制     |

### 其他子包

| 目录                | 用途                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/`         | Pydantic 配置模型——settings/schema/defaults/constants/accessors                                                                                              |
| `i18n/`           | 国际化——status\_i18n/metadata\_i18n                                                                                                                         |
| `events/`         | 事件总线——event\_bus.py                                                                                                                                      |
| `logging/`        | 日志系统——config/configure/context/formatters/loguru\_bridge/process\_stream/stats/llm\_stats                                                                |
| `skills/builtin/` | 内置技能包——pdf/docx/pptx/xlsx/skill-creator（各含 SKILL.md）                                                                                                     |
| `utils/`          | 工具函数——archive\_extractor/config\_manager/error\_utils/json\_parser/document\_validator/document\_extractor/error\_rate\_tracker/network/circuit\_breaker |

***

## deeptutor\_cli/ CLI 包

基于 Typer 的命令行接口。

| 文件                 | 用途                                                               |
| ------------------ | ---------------------------------------------------------------- |
| `main.py`          | **Typer CLI 入口**——定义 `deeptutor` 命令及其子命令（run/start/serve），注册各子应用 |
| `chat.py`          | 交互式聊天 REPL                                                       |
| `kb.py`            | 知识库管理命令                                                          |
| `memory.py`        | 记忆查看/管理命令                                                        |
| `book.py`          | Book 管理命令                                                        |
| `notebook.py`      | 笔记本管理命令                                                          |
| `partner.py`       | Partner 管理命令                                                     |
| `skill.py`         | 技能管理命令                                                           |
| `skill_login.py`   | 技能 Hub 登录                                                        |
| `skill_prompts.py` | 技能提示词                                                            |
| `plugin.py`        | 插件列表命令                                                           |
| `config_cmd.py`    | 配置检查命令                                                           |
| `provider_cmd.py`  | 提供者 OAuth 登录命令                                                   |
| `session_cmd.py`   | 会话管理命令                                                           |
| `init_cmd.py`      | 初始化命令                                                            |
| `init_wizard.py`   | 交互式初始化向导                                                         |
| `common.py`        | 共享工具函数（build\_turn\_request、run\_turn\_and\_render 等）            |
| `_tool_result.py`  | 工具结果渲染                                                           |

***

## web/ 前端

Next.js + React + TypeScript + Tailwind CSS 前端应用。

| 目录            | 用途                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------ |
| `app/`        | Next.js App Router 页面——(admin)/(auth)/(utility)/(workspace) 路由组                            |
| `components/` | React 组件——agents/auth/chat/common/memory/quiz/settings/sidebar/space/ui/visualize/research |
| `context/`    | React Context——AppShell/GeogebraTab/QuizFollowup/UnifiedChat                               |
| `features/`   | 功能模块——multi-user                                                                           |
| `hooks/`      | 自定义 Hooks——useChatAutoScroll/useKnowledgeBases/useSmoothStreamText/useVoiceRecorder 等      |
| `i18n/`       | 国际化——I18nClientBridge/I18nProvider                                                         |
| `lib/`        | 核心库——api/auth/knowledge-api/memory-graph/stream/unified-ws 等 60+ 模块                        |
| `locales/`    | 翻译文件——en/zh                                                                                |
| `public/`     | 静态资源——provider-icons/logo/favicon                                                          |
| `scripts/`    | 构建脚本——i18n 审计/奇偶校验/路由预算                                                                    |
| `tests/`      | 前端测试——15+ 测试文件                                                                             |
| `types/`      | TypeScript 类型定义                                                                            |

***

## tests/ 测试套件

| 目录                    | 测试范围                                                                          | 关键文件数 |
| --------------------- | ----------------------------------------------------------------------------- | ----- |
| `tests/agents/`       | 智能体测试（chat/question/research）                                                 | \~5   |
| `tests/api/`          | API 路由测试（auth/CORS/knowledge/memory/notebook/partners/sessions/tools/voice 等） | \~20  |
| `tests/book/`         | Book 引擎测试                                                                     | 3     |
| `tests/capabilities/` | 能力测试（solve/obsidian/explore\_context/status\_i18n/rag\_consistency）           | \~6   |
| `tests/cli/`          | CLI 测试（chat/config/kb/notebook/provider/turn\_renderer 等）                     | \~9   |
| `tests/core/`         | 核心测试（agentic/builtin\_tools/config/context/prompt/stream\_bus 等）              | \~12  |
| `tests/knowledge/`    | 知识库测试（manager/naming/obsidian/linked\_kb/progress 等）                          | \~10  |
| `tests/logging/`      | 日志测试                                                                          | 5     |
| `tests/multi_user/`   | 多用户测试（identity/grants/tool\_access/capability\_access 等）                      | \~10  |
| `tests/runtime/`      | 运行时测试（orchestrator/launcher/registry）                                         | \~5   |
| `tests/scripts/`      | 脚本测试                                                                          | 5     |
| `tests/services/`     | 服务测试（llm/memory/rag/session/skill/cron/sandbox/search/persona 等）              | \~40+ |
| `tests/tools/`        | 工具测试（ask\_user/file\_tools/github\_query/rag/web\_search/web\_fetch 等）        | \~10  |
| `tests/utils/`        | 工具函数测试                                                                        | 5     |
| `conftest.py`         | 全局 pytest 配置                                                                  | 1     |

***

## 配置与依赖文件

| 文件                               | 用途                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pyproject.toml`                 | 项目元数据 + 构建配置 + 工具配置（Black/Ruff/pytest/mypy/bandit），定义了 cli/server/partners/matrix/math-animator/dev/all 等可选依赖组 |
| `requirements.txt`               | 主依赖文件                                                                                                          |
| `requirements/cli.txt`           | CLI-only 依赖                                                                                                    |
| `requirements/server.txt`        | Web/API 服务器依赖                                                                                                  |
| `requirements/partners.txt`      | Partner 渠道 SDK 依赖                                                                                              |
| `requirements/matrix.txt`        | Matrix 渠道依赖                                                                                                    |
| `requirements/matrix-e2e.txt`    | Matrix E2EE 依赖                                                                                                 |
| `requirements/math-animator.txt` | Manim 动画依赖                                                                                                     |
| `requirements/dev.txt`           | 开发/测试依赖                                                                                                        |

***

## 架构总结

### 两层插件模型

1. **Level 1——Tools（单次工具调用）**: LLM 按需选择，包括用户可切换的 4 个工具（brainstorm/web\_search/paper\_search/reason）和上下文自动挂载的 13+ 个工具（rag/code\_execution/read\_memory/write\_memory 等）
2. **Level 2——Capabilities（多阶段管线）**: 接管整个 turn，包括 chat/mastery\_path/solve/obsidian/subagent/explore\_context 等能力

### 三个入口点

- **CLI** (Typer) -> `deeptutor_cli/main.py`
- **WebSocket API** -> `deeptutor/api/routers/unified_ws.py`
- **Python SDK** -> `deeptutor/app/facade.py` (DeepTutorApp)

### 核心数据流

```
UnifiedContext -> ChatOrchestrator -> Capability.run() -> StreamBus -> 消费者（CLI 渲染器/WebSocket 推送/JSON 写入器）
```

