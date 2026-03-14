# Obsidian Drive Sync 文档总览

这个目录是插件的正式文档集，主要面向仓库贡献者。凡是会改动同步行为、provider 集成、运行时编排、UI 流程或发布验证的人，都应该先从这里读起。

如果你第一次进入这个仓库，建议按下面顺序阅读：

1. [`SPECS.md`](SPECS.md)：产品范围和行为要求
2. [`ARCHITECTURE.md`](ARCHITECTURE.md)：代码结构与模块边界
3. [`SYNC_INITIALIZATION_STRATEGY.md`](SYNC_INITIALIZATION_STRATEGY.md) 与 [`SYNC_STRATEGY.md`](SYNC_STRATEGY.md)：同步决策规则
4. [`ERROR_SYSTEM_DESIGN.md`](ERROR_SYSTEM_DESIGN.md)：结构化错误处理
5. [`COMMANDS.md`](COMMANDS.md)、[`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)、[`VERIFICATION.md`](VERIFICATION.md)：日常开发和排障所需信息

## 仓库摘要

该插件负责把一个 Obsidian vault 与一个远端目录同步。当前实现优先保证三件事：

- 同步决策可预测
- 失败后可恢复
- 出问题时有足够诊断信息解释运行时到底做了什么

当前默认远端 provider 是 `proton-drive`，但 runtime 和 sync kernel 的设计都尽量保持 provider 无关。

## 当前状态

已实现：

- 本地与远端文件系统适配层
- 基于 IndexedDB 的同步状态与任务队列
- 会话恢复、重试调度、认证暂停、启动恢复
- 远端根目录选择、状态 UI、诊断导出、冲突处理
- provider 化运行时接线和结构化错误系统

仍未完成：

- 移动端兼容性验证
- 更完整的 adapter 级测试覆盖
- 部分人工验证流程和发布检查

当前工作的总入口见 [`TASKS.md`](TASKS.md)。

## 开发流程

常见本地开发流程：

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

常用检查命令：

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run test:watch
```

可选配置：

```bash
export OBSIDIAN_VAULT_PATH="/path/to/YourVault"
pnpm run link:obsidian
```

手动安装目录结构：

```text
<Vault>/.obsidian/plugins/<plugin-id>/
  main.js
  manifest.json
  styles.css
```

## 仓库结构

```text
src/
  main.ts                       插件门面与生命周期入口
  contracts/                    按领域划分的共享契约
  provider/                     provider 实现与注册表
  runtime/                      会话、调度与运行时编排
  sync/                         规划、队列、状态与执行
  commands/                     命令注册
  ui/                           设置页、弹窗与状态视图
tests/                          单元测试
docs/                           仓库文档
```

## 安全、隐私与存储

- 默认不开启遥测。
- 插件只应访问当前 vault 和所选远端根目录。
- 常规用户日志不应暴露认证敏感信息。
- 设置保存在 Obsidian 插件数据中。
- 同步状态、任务和日志通过 Dexie 存在 IndexedDB 中。

## 文档索引

- [`SPECS.md`](SPECS.md)：产品范围、行为要求、里程碑和当前计划
- [`ARCHITECTURE.md`](ARCHITECTURE.md)：代码分层、边界与运行时流程
- [`SYNC_INITIALIZATION_STRATEGY.md`](SYNC_INITIALIZATION_STRATEGY.md)：首次同步与重新初始化规则
- [`SYNC_STRATEGY.md`](SYNC_STRATEGY.md)：初始化完成后的运行时同步规则
- [`ERROR_SYSTEM_DESIGN.md`](ERROR_SYSTEM_DESIGN.md)：结构化错误模型与职责归属
- [`COMMANDS.md`](COMMANDS.md)：命令结构和命令目录
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)：常见排障入口
- [`VERIFICATION.md`](VERIFICATION.md)：人工验证清单
- [`TASKS.md`](TASKS.md)：已完成事项和剩余工程任务
- [`CODING_STANDARDS.md`](CODING_STANDARDS.md)：仓库专用工程规范
- [`AGENTS.md`](AGENTS.md)：自动化协作者说明
