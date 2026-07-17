# SmartLearn 三层记忆系统重构计划

## Status
- Created: 2026-07-16
- Last updated: 2026-07-16
- Total sections: 7
- Completion: 100% (修订版)

## Outline
| # | Section | File | Status | Summary |
|---|---------|------|--------|---------|
| 1 | 问题与现状分析 | 01-problem-analysis.md | ✅ Done | 记忆系统 5 个断点的根因分析（含 notebook 工具与 MemoryEntry 表） |
| 2 | 目标架构设计 | 02-target-architecture.md | ✅ Done | 三层架构 + MemoryEntry 迁移策略 + AsyncLocalStorage 并发方案 |
| 3 | Snapshot 自动采集层 | 03-snapshot-layer.md | ✅ Done | 从 PostgreSQL 自动采集聊天数据，含分页与容错 |
| 4 | Consolidator 提取层 | 04-consolidator-layer.md | ✅ Done | LLM 驱动的事实提取与合成，含 preferences 自动引导 |
| 5 | UserId 修复与集成 | 05-userid-integration.md | ✅ Done | AsyncLocalStorage 隔离 + per-turn 注入 + notebook 工具同步修复 |
| 6 | 实施路线图 | 06-implementation-roadmap.md | ✅ Done | 分 3 阶段实施，含数据迁移与前端 store 过渡 |
| 7 | 风险与验收标准 | 07-risks-and-acceptance.md | ✅ Done | 风险缓解（并发已升级为高风险）和独立可测的验收标准 |

## Cross-References
- Section 3 depends on: Section 1, Section 2
- Section 4 depends on: Section 2, Section 3
- Section 5 depends on: Section 1, Section 2
- Section 6 depends on: Section 3, Section 4, Section 5
- Section 7 depends on: Section 1, Section 2, Section 3, Section 4, Section 5, Section 6

## Key Decisions Log
- [2026-07-16] 采用 DeepTutor Python 版的 Snapshot+Consolidator 模式（而非纯 LLM 工具调用）
- [2026-07-16] 第一阶段只实现 chat surface（唯一有数据的 surface）
- [2026-07-16] 记忆文件存储短期内沿用 `data/memory/{userId}/` 目录布局；Prisma `MemoryEntry` 表作为第三阶段迁移目标，届时替换文件存储
- [2026-07-16] 并发隔离采用 `AsyncLocalStorage` 方案（第一阶段即实施），彻底消除模块级 `_userId` 的竞态风险；不再使用 try/finally 覆盖模块变量的不安全方案
- [2026-07-16] Consolidator 保留旧的 `rollupL1ToL2` 作为 fallback，通过环境变量切换
- [2026-07-16] Notebook 工具（`setListNotebookContext` / `setWriteNoteContext`）与 Memory 工具同步修复 userId 注入
- [2026-07-16] 品牌统一：所有提示词和文档使用 "SmartLearn"，不再混用 "DeepTutor"（后者仅在引用 Python 参考实现时出现）

## Revision Notes（修订版变更摘要）

本次修订解决原方案的以下关键问题：

1. **MemoryEntry Prisma 模型被完全忽视** — 新增 §2.7 明确迁移策略：短期文件系统、第三阶段迁移到数据库
2. **并发安全性分析有技术错误** — 原文声称"Node.js 单线程不会竞态"不正确；改用 AsyncLocalStorage 方案
3. **Notebook 工具有同样的 userId 硬编码 bug** — 扩展修复范围覆盖 `setListNotebookContext` / `setWriteNoteContext`
4. **Meta 文件命名混乱** — 统一为 `state.json`（Snapshot 状态）+ `l2-meta.json` / `l3-meta.json`（Consolidator 增量追踪）
5. **`{focus}` 占位符未定义** — 补充每个 surface 的 focus 值
6. **L3/preferences slot 永远为空的隐患** — 增加自动引导机制
7. **品牌混用** — 提示词模板中 "DeepTutor" 改为 "SmartLearn"
8. **验收标准 A4 无法在 Phase 1 独立测试** — 拆分为 A4a（Phase 1 可测）和 A4b（Phase 2 验证）
9. **缺少现有 anonymous 数据的迁移策略** — 新增迁移任务
10. **缺少前端 memory-store V1→V2 过渡方案** — 新增相关讨论
