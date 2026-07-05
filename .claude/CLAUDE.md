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



## 代码规范

- 所有新组件必须支持 i18n（useI18n hook）
- 不硬编码中文文本，翻译 key 放 lib/i18n/locales/ 的 4 个 JSON
- API Key 不传前端，走后端环境变量
- 改完代码后跑 npm run build 验证

## 工作流规则

- 每次修改文件前，先读取本文件（.claude/CLAUDE.md）获取最新上下文
- 对话上下文接近上限时，主动总结本次会话内容保存为 .md 文件，便于新窗口衔接
