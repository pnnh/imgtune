<!--
SYNC IMPACT REPORT
版本变更：[UNVERSIONED] → 1.0.0
新增章节：
  - Core Principles > I. 文档语言规范（NON-NEGOTIABLE）[初始批准]
  - 开发约定 [存根，待后续补充]
  - Governance [初始批准]
修改原则：无（初始版本）
删除章节：移除了模板中未使用的 PRINCIPLE_2 至 PRINCIPLE_5 占位符及 SECTION_3 占位符
模板同步状态：
  - .specify/templates/spec-template.md ✅ 无需修改（语言原则约束 AI 输出行为，与模板结构无关）
  - .specify/templates/plan-template.md ✅ 无需修改
  - .specify/templates/tasks-template.md ✅ 无需修改
  - .specify/templates/checklist-template.md ✅ 无需修改
  - AGENTS.md / CLAUDE.md ✅ 已包含中文语言约束，与本 constitution 一致，无冲突
延后 TODO：
  - TODO(ADDITIONAL_PRINCIPLES): 暂无其他原则——随项目演进逐步添加
  - TODO(SECTION_2_CONTENT): 开发约定（技术栈约束、代码风格等）待后续补充
-->

# ImgTune Constitution

## Core Principles

### I. 文档语言规范（NON-NEGOTIABLE）

所有 Spec Kit 生成的文档（spec.md、plan.md、tasks.md、checklist、analyze 报告、constitution.md 等）
必须使用**简体中文**输出。

**强制规则**：

- 标题、章节名、用户故事、验收标准、任务描述、说明文字、注释等全部使用简体中文。
- 技术标识符（变量名、类名、文件路径、命令名及代码块中的代码本身）保持英文，不翻译。
- 代码示例中的注释使用中文。

**覆盖范围**：本原则适用于所有 AI 编码代理（GitHub Copilot、Claude Code、Cursor 等）在
执行任意 Spec Kit 命令时产生的全部文档输出。

**优先级**：本原则优先于所有代理的默认语言行为，不可被任务参数或其他原则覆盖，无例外。

**理由**：项目团队母语为中文；中文文档降低理解成本，减少歧义，提升协作效率。

## 开发约定

TODO(SECTION_2_CONTENT): 项目技术栈约束、代码风格规范、测试要求等待后续补充。

## Governance

本 constitution 优先于所有其他规范和代理默认行为。所有修订须遵循以下语义化版本规则并更新
`Last Amended` 日期：

- **MAJOR**：向后不兼容的原则删除或重定义。
- **MINOR**：新增原则或章节，或对现有原则进行实质性扩展。
- **PATCH**：措辞优化、错别字修正等不改变语义的修改。

所有 PR / 代码审查须验证对本 constitution 的符合情况。复杂度的引入必须有充分理由。

**Version**: 1.0.0 | **Ratified**: 2026-08-05 | **Last Amended**: 2026-08-05
