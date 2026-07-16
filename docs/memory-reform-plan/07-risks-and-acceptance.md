# 7. 风险与验收标准

## 7.1 风险识别与缓解

### 风险 1：Consolidator LLM 调用失败

**描述**: LLM 调用可能因 API key 无效、配额耗尽、网络错误等失败。

**概率**: 中

**影响**: L2/L3 无法生成，但 L1 trace 不受影响（Snapshot 是确定性的）。

**缓解**:
- Consolidator 内部 catch 所有异常，失败只影响本次 consolidate，不影响对话流
- L2/L3 写入使用原子操作（先写 .tmp 再 rename），失败不会损坏已有文件
- 保留旧的 `rollupL1ToL2` 作为 fallback（第二阶段）
- 支持配置备选模型（DT_TOOL_MODEL 环境变量）

### 风险 2：Snapshot 采集查询性能

**描述**: `readChatEntities` 查询所有 DtSession + DtMessage，数据量大时可能慢。

**概率**: 低-中（取决于用户聊天量）

**影响**: CAPABILITY_COMPLETE 后的 consolidate 延迟增大。

**缓解**:
- 增量采集：只查询 `updatedAt > lastRefresh` 的新 session
- 限制单次查询的消息数量（如最多 200 条）
- Snapshot 刷新是 fire-and-forget，不阻塞对话响应

### 风险 3：LLM 提取的事实质量低

**描述**: LLM 可能提取低价值事实、编造信息、或重复已有条目。

**概率**: 中

**影响**: L2/L3 记忆质量差，影响个性化效果。

**缓解**:
- 严格的提示词约束（≤240 字符、禁止绝对化措辞、必须有 ref）
- Ops 验证拒绝无效输入
- 第二阶段的 Dedup 模式专门处理重复
- 第一阶段先让系统跑通，质量迭代优化

### 风险 4：并发 userId 竞态

**描述**: 多用户同时请求时，模块级 `_userId` 变量可能被覆盖。

**概率**: 低（Node.js 单线程，agent loop 同步段不切换）

**影响**: 用户 A 的记忆写到用户 B 的目录。

**缓解**:
- 第一阶段：try/finally 中重置 userId
- 第三阶段：改造为 context 参数传递，彻底消除模块级变量

### 风险 5：记忆文件过大

**描述**: 长期使用后 L2/L3 文件可能膨胀到几十 KB。

**概率**: 中

**影响**: 读取延迟增大，context window 占用过多。

**缓解**:
- L2 每个 entry ≤240 字符，自然限制增长
- L3 读取时限制 MAX_READ_CHARS = 16000
- 第三阶段实现 Merge 模式（压缩旧条目）

## 7.2 验收标准

### 第一阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| A1 | L1 trace 自动产生 | 用户聊 3 轮后，检查 `data/memory/{userId}/L1/chat.jsonl` 非空 |
| A2 | userId 正确隔离 | 两个不同用户聊天后，各自的 L1 文件在不同目录 |
| A3 | read_memory 能读到 trace | 调用 `GET /api/v1/memory?layer=trace&surface=chat` 返回事件 |
| A4 | memoryContext 注入生效 | 对话中 LLM 回复体现用户历史信息（需第二阶段 L3 有内容后完整验证） |
| A5 | 现有功能不受影响 | 正常对话、工具调用、代码执行等功能正常 |

### 第二阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| B1 | L2 有结构化事实 | `data/memory/{userId}/L2/chat.md` 包含带 entry ID 的 markdown |
| B2 | 事实有 ref 引用 | 每个 L2 entry 的 footnote 指向 trace_id 或 surface_name |
| B3 | L3 有合成内容 | `data/memory/{userId}/L3/recent.md` 非空 |
| B4 | 增量更新 | 连续 consolidate 只处理新增部分，不重复提取 |
| B5 | 原子写入 | consolidate 中途失败（如 kill 进程），L2/L3 文件不被损坏 |
| B6 | LLM 个性化 | 用户聊过"我在学 Python"后，后续对话 LLM 自动以 Python 为语境 |

### 第三阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| C1 | Dedup 有效 | 手动注入重复事实后，dedup 运行后只保留一条 |
| C2 | Quiz surface 有数据 | 答题后 L2/quiz.md 有条目 |
| C3 | Workbench UI 可用 | 前端页面可查看 L1/L2/L3 内容，可手动触发 update |

## 7.3 回滚策略

每个阶段独立可回滚：

- **第一阶段回滚**: 移除 MemorySubscriber 中的 Snapshot 调用，恢复为仅 `consolidate()` 调用。L1 trace 文件不影响系统运行。
- **第二阶段回滚**: `MemoryServiceImpl.consolidate()` 保留旧的 `rollupL1ToL2` 代码路径，通过环境变量 `MEMORY_CONSOLIDATOR=v1` 切回。
- **第三阶段回滚**: Dedup/Audit 是可选模式，关闭即可。

## 7.4 监控指标

| 指标 | 采集方式 | 告警阈值 |
|------|----------|----------|
| L1 trace 写入频率 | 日志统计 | 连续 24h 无写入 |
| Consolidate 成功率 | 日志统计 | 成功率 < 80% |
| LLM 调用延迟 | 日志统计 | P99 > 30s |
| L2/L3 文件大小 | 文件系统 | 单文件 > 50KB |
| Snapshot 刷新耗时 | 日志统计 | P99 > 10s |
