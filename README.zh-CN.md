# Obsidian Drive Sync

[English](README.md) | 简体中文

Obsidian Drive Sync 是一个把单个 Obsidian vault 与单个远端文件夹同步的插件。项目仍在积极开发中，当前优先级不是功能堆叠，而是先把同步引擎做得可预测、可观察，并且在出错时可恢复。

## 当前已经具备的能力

- 本地 vault 与选定远端根目录之间的双向同步
- 本地变更监听，以及远端轮询或 feed 回退机制
- 冲突检测与人工处理流程
- 会话恢复、重试调度和可续跑任务队列
- 结构化日志、诊断导出和应用内状态视图
- 基于 provider 的架构；当前默认远端 provider 为 `proton-drive`

## 当前仍未完成的部分

- 移动端兼容性尚未完整验证
- adapter 层测试覆盖仍不完整
- 部分人工验证流程仍记录在 [`docs/VERIFICATION.md`](docs/VERIFICATION.md) 中

## 文档入口

- 仓库说明：[`docs/README.md`](docs/README.md)
- 技术规格：[`docs/SPECS.md`](docs/SPECS.md)
- 架构设计：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 简体中文文档集：[`docs/zh-CN/README.md`](docs/zh-CN/README.md)

## 开发

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

常用命令：

```bash
pnpm run build
pnpm run lint
pnpm run test
```

`pnpm run build` 会生成 `dist/main.js`，并将 `manifest.json` 和 `styles.css` 一并复制到 `dist/`。
