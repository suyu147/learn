# 迁移验收标准

> 本文件定义每个 Phase 的完成标准（Definition of Done），确保迁移质量可验证。

---

## 通用验收标准（所有 Phase）

- [ ] TypeScript 编译通过（`npx tsc --noEmit` 无错误）
- [ ] ESLint 通过（`npx eslint lib/deeptutor/` 无错误）
- [ ] 无 `any` 类型（除非标注 `// TODO: remove any` 并有 issue 跟踪）
- [ ] 所有新增 async 函数有错误处理
- [ ] 所有新增 API 路由有输入校验（Zod schema）
- [ ] 新增文件在 `lib/deeptutor/` 下
- [ ] import 路径使用 `@/lib/deeptutor/...` 别名

---

## Phase 0：架构定义

### DoD

- [ ] 所有类型定义文件创建完成且编译通过
- [ ] MockTool 可注册、查找、执行、生成 schema
- [ ] ToolComposition 四层挂载逻辑可运行
- [ ] MockCapability（Loop/Agent/Graph 三种类型）可注册和路由
- [ ] PromptManager 可加载 YAML 模板、渲染 Handlebars、i18n 回退
- [ ] LangGraph JS 技术验证通过：最简 AgentLoop（2 节点 + 1 个 Tool）可运行

### 验证命令

```bash
npx tsc --noEmit
npx vitest run lib/deeptutor/core/__tests__/
```

### 验证场景

1. **MockTool 注册测试**：
   ```typescript
   const registry = new ToolRegistry();
   registry.register(new MockTool("test", "Test tool", { type: "object", properties: { input: { type: "string" } } }));
   expect(registry.has("test")).toBe(true);
   expect(registry.get_definitions()).toHaveLength(1);
   const result = await registry.execute("test", { input: "hello" });
   expect(result).toBeDefined();
   ```

2. **Capability 路由测试**：
   ```typescript
   const capRegistry = new CapabilityRegistry();
   capRegistry.register(new MockLoopCapability("chat", ...));
   capRegistry.register(new MockGraphCapability("smartlearn", ...));
   expect(capRegistry.route("chat")).toBeDefined();
   expect(capRegistry.route("smartlearn")).toBeDefined();
   ```

3. **PromptManager 测试**：
   ```typescript
   const pm = new PromptManager();
   const rendered = pm.render("test_template", { variable: "value" }, "zh");
   expect(rendered).toContain("value");
   // i18n 回退：zh 模板不存在时回退到 en
   ```

4. **LangGraph JS 验证**：
   ```typescript
   // 最简 AgentLoop：agent_node → tool_node 循环
   const graph = new StateGraph(TestState)
     .addNode("agent", agentNode)
     .addNode("tools", toolNode)
     .addEdge(START, "agent")
     .addConditionalEdges("agent", shouldUseTool, { tools: "tools", [END]: END })
     .addEdge("tools", "agent");
   const result = await graph.invoke({ messages: [...] });
   expect(result.messages.length).toBeGreaterThan(0);
   ```

---

## Phase 1：核心基础设施

### DoD

- [ ] Prisma schema 扩展完成，`prisma migrate` 成功
- [ ] Session/Turn/Message CRUD 可用
- [ ] 三种认证模式可切换（无认证/单用户/多用户）
- [ ] 17 种 StreamEvent 定义完成，SSE 可发送所有事件类型
- [ ] input-handler 的 ask_user 可用（SSE WAIT_FOR_INPUT → POST 回传 → Promise resolve）
- [ ] ask_user 超时降级可用（60s 后自动转普通回复）
- [ ] Turn 取消可用（POST /api/v1/turns/:id/cancel + SSE 断开检测）
- [ ] 本地磁盘存储适配器可用
- [ ] UsageTracker 可从 AI SDK response 提取 usage 并累加
- [ ] TrafficController 信号量限流可用
- [ ] API Key 可服务端存储和读取（加密）
- [ ] 模型目录 JSON 可加载和查询

### 验证场景

1. **会话持久化**：
   ```
   创建 Session → 创建 Turn → 添加 Message → 查询 → 验证数据完整
   ```

2. **认证流程**：
   ```
   无认证模式: 请求直接通过
   单用户模式: 首次访问自动创建用户，后续请求自动认证
   多用户模式: 注册 → 登录 → 获取 JWT → 带 JWT 请求受保护路由
   ```

3. **ask_user 流程**：
   ```
   SSE 连接 → 发送消息 → 收到 WAIT_FOR_INPUT → POST /api/v1/input → 收到后续响应
   ```

4. **ask_user 超时**：
   ```
   SSE 连接 → 发送消息 → 收到 WAIT_FOR_INPUT → 60s 不响应 → 收到降级文本回复
   ```

5. **Turn 取消**：
   ```
   SSE 连接 → 发送消息 → 收到部分响应 → POST /api/v1/turns/:id/cancel → SSE 关闭
   ```

---

## Phase 2a：AgentLoop + Chat + 简单 Tools

### DoD

- [ ] AgentLoop 子图可运行（agent_node → tool_node 循环）
- [ ] ToolComposition 四层挂载可用
- [ ] 私有 kwargs 可通过 config.configurable 注入
- [ ] LabelProtocol (THINK/TOOL/FINISH/OUTLINE) 可用
- [ ] InlineThinkFilter 可过滤 `<think>...</think>` 块
- [ ] ChatPromptAssembler 可按 13 块顺序组装系统提示
- [ ] Context Window 保护可用（0.9 阈值截断历史）
- [ ] 5 个简单 Tools 可用：brainstorm, reason, web_fetch, ask_user, web_search
- [ ] Chat Capability 可用（LoopCapability）
- [ ] Regenerate Last Turn 可用
- [ ] Chat 前端页面可交互
- [ ] 附件上传和处理可用

### 验证场景

1. **Chat 基本对话**：
   ```
   打开 Chat 页面 → 输入消息 → 收到 AI 回复 → 回复内容合理
   ```

2. **Tool 调用**：
   ```
   输入 "帮我头脑风暴关于量子计算的应用" → AI 调用 brainstorm 工具 → 返回 5-8 个方向
   ```

3. **ask_user 交互**：
   ```
   AI 调用 ask_user → 前端显示选项 → 用户选择 → AI 继续处理
   ```

4. **多轮 Tool 调用**：
   ```
   输入复杂问题 → AI 调用 reason → 再调用 web_search → 综合回答
   ```

5. **Regenerate**：
   ```
   点击重新生成 → 上一 Turn 重新运行 → 新回复
   ```

6. **附件处理**：
   ```
   上传图片 → AI 识别图片内容 → 回复
   ```

---

## Phase 2b：RAG + Search + Embedding

### DoD

- [ ] pgvector 扩展安装并可用
- [ ] 文档分块可用（chunk_size=1024, overlap=200）
- [ ] 基本向量检索可用
- [ ] 基本重排序可用
- [ ] KB 管理器可用（创建/删除/添加文档/进度追踪）
- [ ] KB Seed 机制可用（3 KB × 4000 chars 注入 system prompt）
- [ ] markitdown 解析可用
- [ ] rag Tool 和 read_source Tool 可用
- [ ] 知识库管理前端可用

### 验证场景

1. **KB 创建和检索**：
   ```
   创建 KB → 上传 PDF → 等待索引完成 → 搜索 → 返回相关段落
   ```

2. **RAG Tool**：
   ```
   在 Chat 中选择 KB → 输入问题 → AI 调用 rag 工具 → 返回基于 KB 的回答
   ```

3. **KB Seed**：
   ```
   选择 3 个 KB → 开始对话 → system prompt 中包含 top-K 段落摘要
   ```

---

## Phase 2c：Sandbox + Memory + Notebook

### DoD

- [ ] Piston API 适配器可用（复用现有）
- [ ] 配额管理可用
- [ ] code_execution Tool 可用
- [ ] exec Tool 可用（受限）
- [ ] L1/L2/L3 三层记忆可用
- [ ] 记忆整合器可用（token 压力触发 + save_memory 工具）
- [ ] 记忆快照可用
- [ ] read_memory / write_memory Tool 可用
- [ ] 笔记本管理器可用
- [ ] list_notebook / write_note Tool 可用
- [ ] paper_search Tool 可用
- [ ] DeferredToolLoader 机制可用
- [ ] load_tools Tool 可用

### 验证场景

1. **代码执行**：
   ```
   在 Chat 中输入 "计算斐波那契数列前 10 项" → AI 调用 code_execution → 返回结果
   ```

2. **记忆读写**：
   ```
   AI 调用 write_memory 写入偏好 → 新对话中 AI 调用 read_memory → 读取到之前写入的偏好
   ```

3. **记忆整合**：
   ```
   长对话超过 context_window_tokens/2 → 触发整合 → MEMORY.md 更新 → HISTORY.md 追加
   ```

4. **笔记本**：
   ```
   AI 调用 write_note 创建笔记 → AI 调用 list_notebook 列出 → 笔记存在
   ```

5. **DeferredToolLoader**：
   ```
   AI 调用 load_tools 加载延迟工具 → 工具 schema 注入 system prompt → 后续可用
   ```

---

## Phase 2d：SmartLearn Capability 改造

### DoD

- [ ] SmartLearn GraphCapability 包装完成
- [ ] LearnEvent → StreamEvent 映射正确
- [ ] /api/v1/smartlearn 可用
- [ ] 旧 API 全部迁移到新路由
- [ ] 旧 API 废弃（返回 410 Gone 或重定向）
- [ ] SmartLearn 前端页面可正常使用
- [ ] 画像构建 → 学习路径 → 资源生成 → 评估闭环可运行
- [ ] useSettingsStore 扩展完成
- [ ] useSessionsStore 数据模型扩展完成
- [ ] 侧边栏新增 SmartLearn 导航项

### 验证场景

1. **SmartLearn 完整流程**：
   ```
   打开 SmartLearn → 构建画像 → 生成学习路径 → 查看资源 → 完成测验 → 画像更新
   ```

2. **API 迁移验证**：
   ```
   调用 /api/v1/smartlearn → 返回学习事件流
   调用旧 /api/learn → 返回 410 或重定向
   ```

3. **前端无回归**：
   ```
   所有 SmartLearn 现有功能（PPT/Stage/7种资源查看器）正常工作
   ```

---

## Phase 3a：核心 Capabilities（Loop 类型）

### DoD

- [ ] deep_solve Capability 可用（solve_plan/solve_finish_step/solve_replan）
- [ ] mastery_path Capability 可用（5 个专属工具）
- [ ] explore_context Capability 可用
- [ ] Persona 服务可用
- [ ] Skill 服务可用
- [ ] Learning 服务可用
- [ ] github Tool 可用
- [ ] read_skill Tool 可用

### 验证场景

1. **deep_solve**：
   ```
   切换到 solve 模式 → 输入数学问题 → AI 制定计划 → 逐步执行 → 给出最终答案
   ```

2. **mastery_path**：
   ```
   切换到 mastery 模式 → AI 创建掌握路径 → 测验 → 评分 → 评估 → 更新技能地图
   ```

---

## Phase 3b：核心 Capabilities（Agent 类型）+ 前端页面

### DoD

- [ ] deep_question Capability 可用
- [ ] deep_research Capability 可用
- [ ] visualize Capability 可用
- [ ] MCP 服务可用
- [ ] 6 个前端页面可用：/knowledge, /memory, /notebook, /settings, /space, /agents
- [ ] 18 个设置子页面可用

### 验证场景

1. **deep_question**：
   ```
   切换到 question 模式 → 输入主题 → AI 生成测验题目
   ```

2. **deep_research**：
   ```
   切换到 research 模式 → 输入研究主题 → AI 多阶段研究 → 生成报告
   ```

3. **前端页面**：
   ```
   访问 /knowledge → 创建 KB → 上传文档 → 检索
   访问 /memory → 查看记忆 → 编辑
   访问 /settings → 修改 LLM 配置 → 保存
   ```

---

## Phase 4：Book + Co-Writer

### DoD

- [ ] Book Engine 可用（14 种 Block + 5 个子代理）
- [ ] Co-Writer 可用
- [ ] /book, /co-writer, /playground 页面可用

### 验证场景

1. **Book 创建**：
   ```
   创建书籍 → 选择主题 → AI 生成大纲 → 逐页编译 → 阅读
   ```

2. **Co-Writer**：
   ```
   创建文档 → AI 辅助写作 → 编辑 → 保存
   ```

---

## Phase 5：高级功能

### DoD

- [ ] BM25 混合检索可用
- [ ] math_animator Capability 可用
- [ ] vision_solver Capability 可用
- [ ] obsidian Capability 可用（9 个专属工具）
- [ ] notebook Capability 可用
- [ ] 媒体生成工具可用（imagegen/videogen/voice）
- [ ] 5 个内置技能包可用
- [ ] Chat Import 可用
- [ ] i18n 扩展完成
- [ ] Auth 前端页面可用
- [ ] Logging 系统可用

---

## Phase 6：Docker 部署

### DoD

- [ ] Dockerfile 构建成功
- [ ] docker-compose.yml 可一键启动
- [ ] 所有功能在 Docker 环境中可用

### 验证场景

```bash
docker compose up -d
# 等待启动完成
curl http://localhost:3000/api/v1/health
# 返回 { status: "ok", version: "..." }
```

---

## 测试框架配置

### 框架选择

- **单元测试**：Vitest（与 SmartLearn 现有配置一致）
- **测试文件位置**：`lib/deeptutor/**/__tests__/*.test.ts`
- **覆盖率**：核心模块（types, registry, prompt）≥ 80%

### 运行命令

```bash
# 全部测试
npx vitest run

# 特定模块
npx vitest run lib/deeptutor/core/__tests__/

# 覆盖率
npx vitest run --coverage
```

---

## 错误处理规范

### 每个 Phase 必须处理的错误类型

| 错误类型 | 处理方式 | 示例 |
|----------|---------|------|
| LLM 调用失败 | 重试 3 次 + 降级 | `callLLM` 的 `retryOptions` |
| 工具执行失败 | 返回错误字符串 + 提示 | `Error executing {name}: {e}\n[Analyze the error...]` |
| SSE 连接中断 | 静默关闭，不发送错误事件 | `try { writer(event) } catch { /* closed */ }` |
| 数据库操作失败 | 日志 + 返回 500 | `logger.error("DB error", { error })` |
| 输入校验失败 | 返回 400 + Zod 错误详情 | `schema.parse()` 抛出 ZodError |
| 认证失败 | 返回 401 | JWT 过期或无效 |
| 权限不足 | 返回 403 | 非管理员访问管理接口 |
| 资源不存在 | 返回 404 | Session/Turn/Message 不存在 |
| 超时 | 降级处理 | ask_user 60s 超时 → 普通回复 |

### 安全检查项

| 检查项 | Phase | 说明 |
|--------|-------|------|
| API Key 加密存储 | Phase 1 | 使用 AES-256-GCM 加密，密钥从环境变量读取 |
| 输入校验 | Phase 1 | 所有 API 路由使用 Zod schema 校验 |
| SSRF 防护 | Phase 2a | web_fetch 工具禁止内网 IP |
| 沙箱安全 | Phase 2c | code_execution 使用 Piston API，不自建沙箱 |
| SQL 注入 | Phase 1 | Prisma 参数化查询，不拼接 SQL |
| XSS | 全程 | React 自动转义，SSE 内容 JSON 编码 |
