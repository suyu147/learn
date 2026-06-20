# SmartLearn 会话总结 - 2026-06-17

## 本次会话完成的工作

### 1. 项目全面分析
对 `D:\python\docment\smartlearn` 做了完整的代码审查，包括：
- 技术栈识别：Next.js 15 + React 19 + TypeScript + LangGraph + Vercel AI SDK + Zustand + Prisma
- 两套 LangGraph 图系统分析（learning-graph 和 director-graph）
- 12 家 AI 提供商、80+ 模型的适配层验证
- 8 维学习画像、7 种资源类型、资源决策引擎的架构梳理
- 4 个页面（首页/profile/workspace/settings）的功能审查

### 2. 重构计划书审查（核心工作）
对照实际代码逐项验证了 `项目重构.md` 中的每个声明，发现以下问题：

#### 事实性错误（3 处）
1. **3.1 节"模块缺失"误判**：`whiteboard-history.ts`、`media-generation.ts`、`audio-player.ts`、`stage-api.ts` 四个文件全部存在且可工作。真正问题是 `stage-api.ts` 是空壳实现（白板方法全是 no-op）
2. **3.6 节 PrismaClient 路径**：建议新建 `lib/db/client.ts`，但单例已存在于 `lib/utils/database.ts`
3. **1.1 节多模型适配**：只列了 4 家提供商，实际支持 12 家

#### 遗漏的真实问题（4 处）
1. **spark-adapter 内部 bug**：`modelPathMap` 定义后从未使用，所有模型走硬编码 `/v1/chat` 路径
2. **Prisma ResourceType 枚举缺少 ppt**：应用层用 7 种类型，DB 枚举只有 6 种
3. **全项目零测试覆盖**：无 `__tests__`、`.test.*`、`.spec.*` 文件，`package.json` 无 test 脚本
4. **resource-decision LLM 层纯占位**：`allowLLM` 从未检查，`llmUsed` 硬编码 false

### 3. 对 `项目重构.md` 的具体修改
| 修改位置 | 修改内容 |
|:---|:---|
| 1.1 已有能力表 | 多模型适配改为 12 家；i18n 标注语言选择器不完整 |
| 1.2 核心问题表 | #1 改为类型设计缺陷；#5 补充已有 database.ts 和枚举问题；#9 改为有内部 bug；新增 #11-#13 |
| 3.1 节 | 整体重写：engine.ts 类型缺陷 + stage-api.ts 空壳，删除"模块缺失"描述 |
| 新增 3.1.5 节 | 核心逻辑单元测试方案（Vitest），覆盖 resource-decision/evaluate/learning-profile/engine |
| 3.3 节 | 补充 write() 并发安全性讨论和两种缓解措施 |
| 3.4 节 | 去掉"新增 evaluationFeedback 字段"，改为复用已有 evaluationResult |
| 3.6 节 | 引用已有 database.ts；补充 Prisma ResourceType 枚举修复前置项 |
| 第八节 | 新增"模型路径映射"行标注 modelPathMap bug |
| 第五节 | 依赖说明改为"仅需新增 vitest" |
| 第六节 | Phase 1 路线图同步更新 |
| 第九节 | 总结表新增编译错误诊断、讯飞 bug、测试覆盖 3 个维度 |

### 4. .claude/CLAUDE.md 更新
补充了已知关键问题、关键文件路径、工作流规则等内容。

## 用户偏好（已存入记忆）
- 每次修改文件前先读取 `.claude/CLAUDE.md`
- 对话接近上下文上限时主动总结并保存为 .md 文件

## 待做事项（下次会话可继续）
- 按重构计划执行 Phase 1 的实际代码修改（3.1 修复 TS 编译错误 → 3.1.5 补测试 → 3.2 补 Agent 注册 → 3.3 并行化 → 3.4 评估闭环 → 3.5 降级）
- 修复 spark-adapter.ts 的 modelPathMap bug
- 修复 Prisma schema 的 ResourceType 枚举
- 补全设置页语言选择器
