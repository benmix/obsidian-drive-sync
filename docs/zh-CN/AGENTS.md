# Obsidian Drive Sync Agent 指南

## 目的

本文档定义 agent 应如何使用仓库文档。

它应保持精简。如果某条规则已经写在索引文档里，详细内容应保留在对应文档中，而不是在本文件里重复维护。

## Agent 规则

- 架构、编码、验证、命令、同步行为和错误设计以本文档索引的文档为准。
- 优先扩展现有模块和流程，不要先引入新抽象。
- 未经明确要求，不要添加兼容层、别名导出或迁移胶水代码。
- 如果文档与仓库真实结构冲突，应更新文档，而不是强行让代码服从过时说明。
- 当 `docs/` 下的用户文档新增、重命名或发生较大变更时，要同步维护中英文版本并更新本索引。

## 规范来源映射

- [`docs/README.md`](../README.md)：仓库概览、开发流程、项目结构和存储模型
- [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md)：编码规范、分层规则、副作用边界和测试要求
- [`docs/VERIFICATION.md`](../VERIFICATION.md)：手动验证流程和验证步骤
- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)：实现架构和职责边界
- [`docs/COMMANDS.md`](../COMMANDS.md)：命令结构和命令行为
- [`docs/TROUBLESHOOTING.md`](../TROUBLESHOOTING.md)：常见故障场景与排查入口
- [`docs/SYNC_STRATEGY.md`](../SYNC_STRATEGY.md)：初始化之后的运行时同步行为
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](../SYNC_INITIALIZATION_STRATEGY.md)：首次同步初始化行为
- [`docs/ERROR_SYSTEM_DESIGN.md`](../ERROR_SYSTEM_DESIGN.md)：结构化错误模型和迁移方案
- [`docs/TASKS.md`](../TASKS.md)：实现跟踪和待办工作

## 文档索引

核心文档：

- [`docs/README.md`](../README.md)：仓库概览、开发流程与项目结构
- [`docs/SPECS.md`](../SPECS.md)：技术规格与产品约束
- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)：面向实现的架构设计
- [`docs/COMMANDS.md`](../COMMANDS.md)：命令结构与命令目录
- [`docs/TROUBLESHOOTING.md`](../TROUBLESHOOTING.md)：排障文档与常见调试检查项
- [`docs/SYNC_STRATEGY.md`](../SYNC_STRATEGY.md)：初始化完成后的运行时同步策略
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](../SYNC_INITIALIZATION_STRATEGY.md)：首次同步初始化策略
- [`docs/VERIFICATION.md`](../VERIFICATION.md)：手动验证清单
- [`docs/TASKS.md`](../TASKS.md)：开发任务跟踪
- [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md)：仓库级编码规范与架构编码约束
- [`docs/AGENTS.md`](../AGENTS.md)：本仓库的 agent 指南
- [`docs/ERROR_SYSTEM_DESIGN.md`](../ERROR_SYSTEM_DESIGN.md)：结构化错误系统设计

中文文档：

- [`docs/zh-CN/README.md`](./README.md)
- [`docs/zh-CN/SPECS.md`](./SPECS.md)
- [`docs/zh-CN/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`docs/zh-CN/COMMANDS.md`](./COMMANDS.md)
- [`docs/zh-CN/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- [`docs/zh-CN/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md)
- [`docs/zh-CN/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/zh-CN/VERIFICATION.md`](./VERIFICATION.md)
- [`docs/zh-CN/TASKS.md`](./TASKS.md)
- [`docs/zh-CN/CODING_STANDARDS.md`](./CODING_STANDARDS.md)
- [`docs/zh-CN/AGENTS.md`](./AGENTS.md)
- [`docs/zh-CN/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md)

## 参考资料

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian API 文档: https://docs.obsidian.md
- Obsidian 开发者政策: https://docs.obsidian.md/Developer+policies
- Obsidian 插件发布指南: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian 风格指南: https://help.obsidian.md/style-guide
