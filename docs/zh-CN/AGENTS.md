# Obsidian Drive Sync Agent 指南

## 目的

这份文档告诉自动化协作者应当如何使用仓库文档。

它应保持精简。详细规则应该写在真正拥有该主题的文档里，而不是重复堆在这里。

## Agent 规则

- 把下面索引出的文档视为产品行为、架构、编码规范、验证流程和排障方式的事实来源。
- 优先扩展现有流程，不要轻易增加新抽象。
- 除非任务明确要求，否则不要增加兼容胶水、别名导出或迁移层。
- 如果代码与文档不一致，默认先把文档更新为当前仓库真实状态；除非任务本身是恢复旧设计。
- 修改 `docs/` 下的用户可见文档时，要同步维护英文与中文版本。
- 修改同步行为前，先检查对应的策略文档。

## 事实来源映射

- [`docs/README.md`](./README.md)：文档总览、开发流程与仓库地图
- [`docs/SPECS.md`](./SPECS.md)：产品范围与行为要求
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)：实现分层与职责边界
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md)：仓库编码规则与分层要求
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)：初始化阶段同步规则
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md)：初始化后的运行时同步规则
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md)：结构化错误模型与职责
- [`docs/COMMANDS.md`](./COMMANDS.md)：命令结构与命令目录
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)：常见故障与排障入口
- [`docs/VERIFICATION.md`](./VERIFICATION.md)：人工验证步骤
- [`docs/TASKS.md`](./TASKS.md)：实现跟踪与待办项

## 文档索引

英文主文档：

- [`docs/README.md`](./README.md)
- [`docs/SPECS.md`](./SPECS.md)
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md)
- [`docs/COMMANDS.md`](./COMMANDS.md)
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md)
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md)
- [`docs/VERIFICATION.md`](./VERIFICATION.md)
- [`docs/TASKS.md`](./TASKS.md)
- [`docs/AGENTS.md`](./AGENTS.md)

简体中文文档：

- [`docs/zh-CN/README.md`](./zh-CN/README.md)
- [`docs/zh-CN/SPECS.md`](./zh-CN/SPECS.md)
- [`docs/zh-CN/ARCHITECTURE.md`](./zh-CN/ARCHITECTURE.md)
- [`docs/zh-CN/CODING_STANDARDS.md`](./zh-CN/CODING_STANDARDS.md)
- [`docs/zh-CN/COMMANDS.md`](./zh-CN/COMMANDS.md)
- [`docs/zh-CN/TROUBLESHOOTING.md`](./zh-CN/TROUBLESHOOTING.md)
- [`docs/zh-CN/SYNC_INITIALIZATION_STRATEGY.md`](./zh-CN/SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/zh-CN/SYNC_STRATEGY.md`](./zh-CN/SYNC_STRATEGY.md)
- [`docs/zh-CN/ERROR_SYSTEM_DESIGN.md`](./zh-CN/ERROR_SYSTEM_DESIGN.md)
- [`docs/zh-CN/VERIFICATION.md`](./zh-CN/VERIFICATION.md)
- [`docs/zh-CN/TASKS.md`](./zh-CN/TASKS.md)
- [`docs/zh-CN/AGENTS.md`](./zh-CN/AGENTS.md)

## 外部参考

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian API docs: https://docs.obsidian.md
- Obsidian developer policies: https://docs.obsidian.md/Developer+policies
- Obsidian plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian style guide: https://help.obsidian.md/style-guide
