# SmartLearn 三层记忆系统重构计划

## Status
- Created: 2026-07-16
- Last updated: 2026-07-16
- Total sections: 7
- Completion: 100%

## Outline
| # | Section | File | Status | Summary |
|---|---------|------|--------|---------|
| 1 | 问题与现状分析 | 01-problem-analysis.md | ✅ Done | 记忆系统4个断点的根因分析 |
| 2 | 目标架构设计 | 02-target-architecture.md | ✅ Done | 模仿DeepTutor的新三层架构 |
| 3 | Snapshot自动采集层 | 03-snapshot-layer.md | ✅ Done | 从PostgreSQL自动采集聊天数据 |
| 4 | Consolidator提取层 | 04-consolidator-layer.md | ✅ Done | LLM驱动的事实提取与合成 |
| 5 | UserId修复与集成 | 05-userid-integration.md | ✅ Done | 修复userId硬编码与per-turn注入 |
| 6 | 实施路线图 | 06-implementation-roadmap.md | ✅ Done | 分3阶段实施的具体步骤 |
| 7 | 风险与验收标准 | 07-risks-and-acceptance.md | ✅ Done | 风险缓解和验收测试标准 |

## Cross-References
- Section 3 depends on: Section 1, Section 2
- Section 4 depends on: Section 2, Section 3
- Section 5 depends on: Section 1
- Section 6 depends on: Section 3, Section 4, Section 5

## Key Decisions Log
- [2026-07-16] 采用DeepTutor Python版的Snapshot+Consolidator模式（而非纯LLM工具调用）
- [2026-07-16] 第一阶段只实现chat surface（唯一有数据的surface）
- [2026-07-16] 记忆文件存储沿用现有的data/memory/{userId}/目录布局
- [2026-07-16] 第一阶段userId修复采用try/finally重置模式，第三阶段再改为context参数传递
- [2026-07-16] Consolidator保留旧的rollupL1ToL2作为fallback，通过环境变量切换
