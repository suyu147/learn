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
    │     system: "你是用户 {userLabel} 的记忆管理员..."
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
  你是 DeepTutor 用户 {userLabel} 的记忆管理员。

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

**L3/preferences 特殊处理**: preferences slot 不由 Consolidator 自动更新，仍由 `write_memory` 工具写入。这与 DeepTutor Python 版一致。

## 4.6 Meta 管理（增量追踪）

每次 Consolidator 运行后，需要记录"已处理到哪些 Entity/Entry"，下次只处理新增部分：

```
data/memory/{userId}/snapshot/chat/
  meta.json           ← L2 meta: { seenEntityRefs: Set<string>, lastUpdateAt: string }
data/memory/{userId}/
  L3-meta.json         ← L3 meta: { seenL2EntryIds: { chat: Set<string> }, lastUpdateAt }
```

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
| 备选模型 | gpt-4o-mini | 可配置 DT_TOOL_MODEL 环境变量 |
| stream | 支持 | 通过 SSE 传给前端 Workbench |

## 4.9 文件清单

| 文件 | 说明 |
|------|------|
| `lib/deeptutor/services/memory/document.ts` | Document + Entry 类型 + parse/serialize |
| `lib/deeptutor/services/memory/ops.ts` | Add/Edit/Delete Op + validate + apply |
| `lib/deeptutor/services/memory/ids.ts` | ULID 生成 + entry_id/trace_id 验证 |
| `lib/deeptutor/services/memory/consolidator.ts` | runUpdateL2 + runUpdateL3 + callLLM 封装 |
| `lib/deeptutor/services/memory/chunker.ts` | 字符级分块 + 边界扩展 |
| `lib/deeptutor/services/memory/prompts/en/update_l2.yaml` | L2 英文提示词 |
| `lib/deeptutor/services/memory/prompts/en/update_l3.yaml` | L3 英文提示词 |
| `lib/deeptutor/services/memory/prompts/zh/update_l2.yaml` | L2 中文提示词 |
| `lib/deeptutor/services/memory/prompts/zh/update_l3.yaml` | L3 中文提示词 |
