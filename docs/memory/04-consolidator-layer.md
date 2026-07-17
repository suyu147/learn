# 4. Consolidator 提取层

## 4.1 设计目标

将 L1 trace 事件和 Snapshot Entity 中的原始数据，通过 LLM 提取为结构化的持久记忆。核心区别于当前实现的简单文本拼接。

## 4.2 Document 模型

L2/L3 的 markdown 文档不是自由格式文本，而是有结构的：

```typescript
interface Document {
  title: string;
  sections: Map<string, Entry[]>;
}

interface Entry {
  id: string;        // m_<ULID> 格式，如 m_01HZK4ABCDEFGHJKMNPQRSTVWX
  section: string;   // 所属 section
  text: string;      // ≤240 字符的事实描述
  refs: string[];    // 引用来源 (trace_id 或 surface_name)
}
```

序列化为 markdown 格式：

```markdown
# Chat Memory

## Learning Topics
- User is learning Python decorators [^m_01HZK4...] <!--chat:sess_abc-->

## Difficulties
- Struggles with async/await patterns [^m_01HZK5...] <!--chat:sess_def-->

[^m_01HZK4...]: chat:sess_abc
[^m_01HZK5...]: chat:sess_def
```

这种格式使得：
- 每个 entry 有唯一 ID（支持 edit/delete）
- 有 ref 引用链（可追溯数据来源）
- 去重和审计可基于 entry ID 操作

## 4.3 Ops 操作系统

借鉴 DeepTutor Python 版的 `ops.py`，实现原子操作：

```typescript
type Op = AddOp | EditOp | DeleteOp;

interface AddOp {
  op: 'add';
  section: string;
  text: string;      // ≤240 字符
  refs: string[];    // ≥1 个有效 ref
}

interface EditOp {
  op: 'edit';
  targetId: string;  // 要编辑的 entry ID
  newText: string;
  newRefs: string[];
}

interface DeleteOp {
  op: 'delete';
  targetId: string;
  reason: 'contradicted' | 'superseded' | 'stale' | 'low-signal';
}
```

验证规则（与 Python 版一致）：
- text 长度 1-240 字符
- section 长度 1-80 字符
- refs 不能为空，每个 ref 必须是有效格式
- 同一批次内，同一 entry 不能同时被 edit 和 delete
- edit/delete 的 targetId 必须存在于文档中

## 4.4 L2 Update 流程

```
Snapshot Entity[] (新增的)
       │
       ▼
  renderTracesForConcat()    ← 拼接新 Entity 为文本
       │
       ▼
  chunkWithBoundary()        ← 按 budget 分块 (≤4000 chars)
       │
       ▼
  For each chunk:
    │
    ├── loadPrompt('update_l2', language)    ← 加载 YAML 提示词
    ├── 构建 system + user prompt
    │     system: "你是 SmartLearn 用户 {userLabel} 的记忆管理员..."
    │     user: "现有 L2 文档: {existing}\n新数据块: {chunk}"
    │
    ├── callLLM(system, user, temperature=0.2, maxTokens=1500)
    │
    ├── 解析 LLM 返回: {facts: [{text, section, refs}]}
    │
    ├── validateFactRefs(facts, allowedRefs)  ← 验证 ref 来源
    │
    └── appendFactsToDoc(doc, keptFacts)      ← AddOp 批量写入
          │
          └── writeDocAtomic(l2Path, doc)     ← 原子写入 checkpoint
```

### L2 Update 提示词 (update_l2.yaml)

```yaml
system: |
  你是 SmartLearn 用户 {userLabel} 的记忆管理员。

  角色：阅读用户近期的 {surface} 活动（原始、未截断），提取关于用户的持久事实。

  输出：一个 JSON 对象——不要其他内容，不要散文，不要代码围栏。

      {"facts": [
        {"text":   "<≤240字符；每条一个事实>",
         "section": "<以下之一: {sections}>",
         "refs":   ["<surface>:<entity_id>", ...]}
      ]}

  硬规则
  - 每个事实必须 ≥1 个 ref。每个 ref 必须来自下方"本块可引用 ref"列表
    或你在块中看到的 @entity <surface>:<id> 标记——不要编造 id。
  - text ≤ 240 字符。简洁，动词导向（"在学习 X"，"卡在 Y"）。
  - 禁止绝对化措辞：精通、专家、热爱、总是、从不、完全理解。
  - 本 surface 聚焦: {focus}。
  - 如果本块没有实质性内容，返回 {"facts": []}——这是正确的预期答案。

  今天是 {today}。

user: |
  # 现有 {surface} 记忆（不要重复已捕获的内容）:
  {existing}

  # 数据块 {chunkIndex}/{chunkTotal} (字符 {chunkStart}..{chunkEnd}):
  ----------------------------------------------------------------
  {chunk}
  ----------------------------------------------------------------

  返回 JSON。只引用上方列表中或本块中可见的 ref。
```

### `{focus}` 占位符定义

每个 surface 的 `{focus}` 值在调用 Consolidator 时注入，定义如下：

| Surface | `{focus}` 值 |
|---------|-------------|
| `chat` | 用户的学习话题、遇到的困难、提问模式、理解进展 |
| `quiz` | 答题正确率、薄弱知识点、答题速度变化 |
| `notebook` | 用户记录的笔记主题、知识结构、关注重点 |
| `kb` | 用户上传/收藏的知识材料主题和覆盖范围 |
| `book` | 阅读进度、关注的章节和内容偏好 |
| `cowriter` | 写作主题、文风偏好、修改历史中的关注点 |

第一阶段仅使用 `chat` 的 focus 值。

## 4.5 L3 Update 流程

L3 Update 从所有 L2 文档的新条目中合成：

```
所有 L2 文档的新 Entry
       │
       ▼
  renderL2EntriesForConcat()  ← 按时间排序拼接
       │
       ▼
  chunkWithBoundary()         ← 分块
       │
       ▼
  For each chunk:
    │
    ├── loadPrompt('update_l3', language)
    ├── 构建 system + user prompt
    │     聚焦于对应 slot:
    │     - recent: 近期重要事件
    │     - profile: 用户身份与学习风格
    │     - scope: 知识范围与掌握程度
    │
    ├── callLLM(system, user, temperature=0.2)
    │
    ├── 解析 facts
    │
    └── appendFactsToDoc(doc, keptFacts)
          │
          └── writeDocAtomic(l3Path, doc)
```

### L3/preferences 自动引导机制

**问题**：`preferences` slot 不由 Consolidator 自动更新，仍由 `write_memory` 工具写入。但断点 2 已论证 LLM 几乎不主动调用 `write_memory`，这将导致 preferences 长期为空。

**解决方案**：在 system prompt 中注入 L3 memoryContext 时，追加一段引导文本，提示 LLM 在适当时机调用 `write_memory`：

```typescript
// chat-capability.ts 中组装 memoryContext 时
const memoryContext = await memoryService.readAllL3(userId);
const preferenceGuidance = memoryContext?.length
  ? `\n\n[记忆提示] 以上是用户的已有记忆。如果用户在本轮对话中表达了新的学习偏好、习惯或长期目标，请调用 write_memory 工具更新记忆。`
  : `\n\n[记忆提示] 这是用户的首次对话。如果用户分享了学习偏好（如喜欢的方式、关注的领域、学习目标），请调用 write_memory 工具记录。`;
```

这不是强制调用，而是在 LLM 看到用户表达偏好时给予温和提示。如果用户没有表达偏好，LLM 不会无意义地调用工具。

## 4.6 Meta 管理（增量追踪）

每次 Consolidator 运行后，需要记录"已处理到哪些 Entity/Entry"，下次只处理新增部分。

### L2 Meta（`data/memory/{userId}/L2/l2-meta.json`）

```json
{
  "seenEntityRefs": ["chat:sess_abc", "chat:sess_def"],
  "lastUpdateAt": "2026-07-16T12:00:00Z"
}
```

L2 Consolidator 每次运行时：
1. 读取 `l2-meta.json` 中的 `seenEntityRefs`
2. 从 Snapshot 新 Entity 中过滤出未处理的部分
3. 处理完成后，将新的 entity refs 追加到 `seenEntityRefs`
4. 更新 `lastUpdateAt`

### L3 Meta（`data/memory/{userId}/L3/l3-meta.json`）

```json
{
  "seenL2EntryIds": {
    "chat": ["m_01HZK4...", "m_01HZK5..."]
  },
  "lastUpdateAt": "2026-07-16T12:30:00Z"
}
```

L3 Consolidator 类似，追踪已处理的 L2 entry IDs（按 surface 分组）。

## 4.7 Dedup（去重）

L2 Update 后可选运行 Dedup：

```
L2/L3 文档
    │
    ▼
  loadPrompt('dedup', language)
    │
    ▼
  callLLM → 返回待删除的重复 entry ID 列表
    │
    ▼
  批量 DeleteOp (reason: 'low-signal')
```

第一阶段不实现 Dedup，作为第二阶段优化项。

## 4.8 LLM 调用配置

| 参数 | 值 | 说明 |
|------|---|------|
| model | 用户配置的模型 (同 chat) | 复用 turns route 的模型选择 |
| temperature | 0.2 | 低温度确保输出稳定 |
| maxTokens | 1500 | 每块输出限制 |
| 备选模型 | 由 `DT_TOOL_MODEL` 环境变量配置 | 已在 `bootstrap.ts:132` 使用，默认 `gpt-4o-mini` |
| stream | 支持 | 通过 SSE 传给前端 Workbench |

`DT_TOOL_MODEL` 环境变量**已存在**于 `bootstrap.ts:132`：
```typescript
const modelId = process.env.DT_TOOL_MODEL ?? 'gpt-4o-mini';
```
Consolidator 复用此配置即可，无需新增环境变量。

## 4.9 文件清单

| 文件 | 说明 |
|------|------|
| `lib/deeptutor/services/memory/document.ts` | Document + Entry 类型 + parse/serialize |
| `lib/deeptutor/services/memory/ops.ts` | Add/Edit/Delete Op + validate + apply |
| `lib/deeptutor/services/memory/ids.ts` | ULID 生成 + entry_id/trace_id 验证 |
| `lib/deeptutor/services/memory/consolidator.ts` | runUpdateL2 + runUpdateL3 + callLLM 封装 |
| `lib/deeptutor/services/memory/chunker.ts` | 字符级分块 + 边界扩展 |
| `lib/deeptutor/services/memory/meta.ts` | l2-meta.json / l3-meta.json 的读写与增量判断 |
| `lib/deeptutor/services/memory/prompts/zh/update_l2.yaml` | L2 中文提示词（第一阶段主用） |
| `lib/deeptutor/services/memory/prompts/zh/update_l3.yaml` | L3 中文提示词（第一阶段主用） |
| `lib/deeptutor/services/memory/prompts/en/update_l2.yaml` | L2 英文提示词（第二阶段补充） |
| `lib/deeptutor/services/memory/prompts/en/update_l3.yaml` | L3 英文提示词（第二阶段补充） |

**提示词语言策略**：第一阶段仅实现中文版（SmartLearn 默认语言为 zh-CN），英文版在第二阶段补充。提示词模板中的品牌名统一使用 "SmartLearn"。
