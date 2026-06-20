# SmartLearn 项目规则

## 关键架构

- 两套 LangGraph 图：learning-graph（学习流程）和 director-graph（PPT演示），不要混淆
- Agent 注册表在 lib/orchestration/registry/store.ts，当前 10 个 Agent（profile/document/quiz/code/tutor/evaluation/mindmap/video/ppt/reading）
- 资源类型 7 种：document/mindmap/quiz/video/code/reading/ppt
- 前端 store 用 zustand + persist（localStorage）
- 数据库 schema 在 prisma/schema.prisma（8 个模型）但未接入；ResourceType 枚举已补全 ppt
- PrismaClient 单例已存在于 lib/utils/database.ts（lib/db/client.ts 为其重导出）
- 12 家 AI 提供商：lib/ai/providers.ts；统一调用封装：lib/ai/llm.ts
- 资源决策引擎：lib/generation/resource-decision.ts（规则层+反馈层可用，LLM 层是占位）
- 全项目零测试覆盖

## 已知关键问题

- ~~engine.ts 类型缺陷~~ ✅ 已修复（Action 规范化、移除 as any、getTask 语义修正）
- ~~spark-adapter.ts modelPathMap bug~~ ✅ 已修复（路径查找已接入 modelId）
- ~~next build 编译警告~~ ✅ 已清零（零错误零警告）
- ~~资源生成串行~~ ✅ 已修复（分批并行 Promise.allSettled，MAX_CONCURRENCY=3，含 agent_status 事件推送和失败降级）
- ~~评估闭环断裂~~ ✅ 已修复（evaluationFeedback 字段贯通 state→evaluate→plan-resources→resource-decision；plan-node 注入薄弱点提示；决策引擎支持 boostTypes/suppressTypes）
- 设置页语言选择器只展示 2/4 种语言
- stage-api.ts 白板方法仍为空壳实现（运行时白板操作无效）

## 代码规范

- 所有新组件必须支持 i18n（useI18n hook）
- 不硬编码中文文本，翻译 key 放 lib/i18n/locales/ 的 4 个 JSON
- API Key 不传前端，走后端环境变量
- 改完代码后跑 npm run build 验证

## 工作流规则

- 每次修改文件前，先读取本文件（.claude/CLAUDE.md）获取最新上下文
- 对话上下文接近上限时，主动总结本次会话内容保存为 .md 文件，便于新窗口衔接
