# 7. 风险与验收标准

## 7.1 风险识别与缓解

### 风险 1：Consolidator LLM 调用失败

**描述**: LLM 调用可能因 API key 无效、配额耗尽、网络错误等失败。

**概率**: 中

**影响**: L2/L3 无法生成，但 L1 trace 不受影响（Snapshot 是确定性的）。

**缓解**:
- Consolidator 内部 catch 所有异常，失败只影响本次 consolidate，不影响对话流
- L2/L3 写入使用原子操作（先写 .tmp 再 rename），失败不会损坏已有文件
- 保留旧的 `rollupL1ToL2` 作为 fallback，通过 `MEMORY_CONSOLIDATOR=v1` 切回
- 复用已有的 `DT_TOOL_MODEL` 环境变量（`bootstrap.ts:132`）配置备选模型，默认 `gpt-4o-mini`

### 风险 2：Snapshot 采集查询性能

**描述**: `readChatEntities` 查询 DtSession + DtMessage，数据量大时可能慢。

**概率**: 低-中（取决于用户聊天量）

**影响**: CAPABILITY_COMPLETE 后的 consolidate 延迟增大。

**缓解**:
- 分页查询：每次最多 `SNAPSHOT_PAGE_SIZE = 50` 个 session
- 消息截断：每个 session 最多 `MAX_MESSAGES_PER_SESSION = 500` 条消息
- 增量采集：只查询 `updatedAt > lastRefresh` 的新 session
- 超时保护：单次查询 10s 超时
- Snapshot 刷新是 fire-and-forget，不阻塞对话响应
- 单个 session 查询失败不影响其他 session 的采集

### 风险 3：LLM 提取的事实质量低

**描述**: LLM 可能提取低价值事实、编造信息、或重复已有条目。

**概率**: 中

**影响**: L2/L3 记忆质量差，影响个性化效果。

**缓解**:
- 严格的提示词约束（≤240 字符、禁止绝对化措辞、必须有 ref）
- Ops 验证拒绝无效输入
- 第二阶段的 Dedup 模式专门处理重复
- 第一阶段先让系统跑通，质量迭代优化

### 风险 4：并发 userId 竞态（已升级为高风险）

**描述**: 多用户同时请求时，如果使用模块级 `_userId` 变量，在 `await` 点会被其他请求覆盖。

**概率**: **高（多用户并发时必然发生）**

**影响**: 用户 A 的记忆写到用户 B 的目录，导致数据错乱和隐私泄漏。

**缓解**:
- **第一阶段即采用 AsyncLocalStorage**（见 §5.2），从架构上消除模块级变量的竞态
- 每个请求在独立的异步上下文中运行，`getCurrentUserId()` 始终返回该请求自己的 userId
- 即使一个 agent loop 在 `await` 点暂停，恢复后仍从自己的 AsyncLocalStorage 上下文读取 userId
- 第三阶段可进一步考虑将 userId 改为 tool execute 方法的显式参数，实现类型安全

**原方案 "try/finally 重置模块变量" 的风险评估（已废弃）**:

Node.js 的 `await` 会释放控制权给事件循环。在多用户并发场景下：
```
T1: 请求A设置 _userId = "user-A"
T2: 请求A进入 await (LLM API 调用)
T3: 事件循环处理请求B，设置 _userId = "user-B"  ← 覆盖了请求A的值
T4: 请求A从 await 恢复，调用 writeMemory(_userId) → 写到了 user-B 的目录
```
这不是理论风险，而是 async 编程的基本特性。因此本方案在第一阶段就使用 AsyncLocalStorage。

### 风险 5：记忆文件过大

**描述**: 长期使用后 L2/L3 文件可能膨胀到几十 KB。

**概率**: 中

**影响**: 读取延迟增大，context window 占用过多。

**缓解**:
- L2 每个 entry ≤240 字符，自然限制增长
- L3 读取时限制 MAX_READ_CHARS = 16000
- 第三阶段实现 Merge 模式（压缩旧条目）

### 风险 6：Windows 文件系统原子写入不可靠

**描述**: 方案使用 `.tmp` + `rename` 实现原子写入，但 Windows 上 `rename` 不保证原子性（与 Linux `mv` 不同）。

**概率**: 低（SmartLearn 当前开发环境为 Windows，但生产部署可能在 Linux）

**影响**: 极端情况下（写入中途系统崩溃）文件可能损坏。

**缓解**:
- `.tmp` 写入完成后 rename，即使 rename 非原子，最坏情况是 `.tmp` 文件残留
- 启动时扫描 `data/memory/` 下的 `.tmp` 文件，有则删除或恢复
- 第三阶段迁移到数据库后，利用 PostgreSQL 的事务保证原子性

### 风险 7：Snapshot 回滚后的孤儿文件

**描述**: 如果第一阶段需要回滚，已创建的 `state.json`、`changes.jsonl`、L1 trace 文件会成为孤儿文件。

**概率**: 低

**影响**: 磁盘空间浪费，可能影响后续重新部署时的 diff 判断。

**缓解**:
- 回滚时清除 `data/memory/{userId}/snapshot/` 目录
- 重新部署时，如果 `state.json` 不存在则视为首次采集（全部标记为 `added`）
- L1 trace 文件是追加式的，重新部署后 Snapshot 会自然续写

## 7.2 验收标准

### 第一阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| A1 | L1 trace 自动产生 | 用户聊 3 轮后，检查 `data/memory/{userId}/L1/chat.jsonl` 非空 |
| A2 | userId 正确隔离 | 两个不同用户聊天后，各自的 L1 文件在不同目录 |
| A3 | read_memory 能读到 trace | 调用 `GET /api/v1/memory?layer=trace&surface=chat` 返回事件 |
| A4a | memoryContext 注入到 system prompt | 检查 turns route 的 system prompt 中包含 memoryContext 块（可通过日志验证） |
| A4b | LLM 回复体现历史信息 | 对话中 LLM 回复体现用户历史信息（需第二阶段 L3 有内容后完整验证，第一阶段仅验证注入机制） |
| A5 | 现有功能不受影响 | 正常对话、工具调用、代码执行等功能正常 |
| A6 | 并发安全 | 两个用户同时发起请求，各自的 memory 写入不交叉（可通过并行请求测试） |
| A7 | Notebook 工具 userId 正确 | 用户创建笔记存入自己的 userId 目录，非 `anonymous` |

### 第二阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| B1 | L2 有结构化事实 | `data/memory/{userId}/L2/chat.md` 包含带 entry ID 的 markdown |
| B2 | 事实有 ref 引用 | 每个 L2 entry 的 footnote 指向 trace_id 或 surface_name |
| B3 | L3 有合成内容 | `data/memory/{userId}/L3/recent.md` 非空 |
| B4 | 增量更新 | 连续 consolidate 只处理新增部分，不重复提取（检查 `l2-meta.json` 的 `seenEntityRefs` 增量） |
| B5 | 原子写入 | consolidate 中途失败（如 kill 进程），L2/L3 文件不被损坏 |
| B6 | LLM 个性化 | 用户聊过"我在学 Python"后，后续对话 LLM 自动以 Python 为语境 |
| B7 | preferences 引导生效 | 用户表达偏好后，system prompt 中出现引导文本（通过日志验证） |

### 第三阶段验收

| # | 验收项 | 验证方法 |
|---|--------|----------|
| C1 | Dedup 有效 | 手动注入重复事实后，dedup 运行后只保留一条 |
| C2 | Quiz surface 有数据 | 答题后 L2/quiz.md 有条目 |
| C3 | Workbench UI 可用 | 前端页面可查看 L1/L2/L3 内容，可手动触发 update |
| C4 | 数据库迁移完成 | `memory_entries` 表有数据，API 返回与文件模式一致 |
| C5 | 前端 store V2 | memory-store 从服务端同步，不再依赖 localStorage |

## 7.3 回滚策略

每个阶段独立可回滚：

- **第一阶段回滚**: 移除 MemorySubscriber 中的 Snapshot 调用，恢复为仅 `consolidate()` 调用。清除 `data/memory/{userId}/snapshot/` 目录中的孤儿文件。L1 trace 文件保留不影响系统运行。
- **第二阶段回滚**: `MemoryServiceImpl.consolidate()` 保留旧的 `rollupL1ToL2` 代码路径，通过环境变量 `MEMORY_CONSOLIDATOR=v1` 切回。
- **第三阶段回滚**: Dedup/Audit 是可选模式，关闭即可。数据库迁移通过 `MEMORY_BACKEND=file` 切回文件模式。

## 7.4 监控指标

| 指标 | 采集方式 | 告警阈值 |
|------|----------|----------|
| L1 trace 写入频率 | 日志统计 | 连续 24h 无写入 |
| Consolidate 成功率 | 日志统计 | 成功率 < 80% |
| LLM 调用延迟 | 日志统计 | P99 > 30s |
| L2/L3 文件大小 | 文件系统 | 单文件 > 50KB |
| Snapshot 刷新耗时 | 日志统计 | P99 > 10s |
| Snapshot 单 session 失败率 | 日志统计 | 连续 3 次同一 session 失败 |
| AsyncLocalStorage 上下文丢失 | 断言检查 | 任何 `getCurrentUserId()` 返回 `anonymous` 但请求携带有效 userId |
| `.tmp` 残留文件数 | 文件系统扫描 | 存在超过 1h 的 `.tmp` 文件 |
