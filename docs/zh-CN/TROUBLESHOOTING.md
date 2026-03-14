# 排障

这份文档列出常见故障场景，以及在深入调试前最值得先做的检查。

## 1. 构建后插件未加载

检查：

- `dist/` 是否包含构建产物
- 产物是否已链接或复制到 `<Vault>/.obsidian/plugins/<plugin-id>/`
- `manifest.json` 是否仍与插件目录和插件 ID 一致

建议操作：

1. 执行 `pnpm run build`。
2. 通过 `pnpm run link:obsidian -- --vault "/path/to/YourVault"` 重新链接，或手动复制产物。
3. 重启或重新加载 Obsidian，确认插件是否出现在 Community Plugins 中。

## 2. 缺少构建产物

检查：

- `pnpm install` 是否成功完成
- TypeScript 或 Vite 报错是否已被真正修复，而不是被忽略
- `dist/` 是否包含 `main.js`、`manifest.json` 和 `styles.css`

建议操作：

1. 执行 `pnpm run build`。
2. 先修复构建错误。
3. 确认 `dist/` 正常后，再继续排查运行时问题。

## 3. 命令未显示

检查：

- 插件启动时是否仍然执行命令注册
- 命令 ID 是否保持唯一且稳定
- 插件是否在更早的启动阶段就失败了

建议操作：

1. 确认插件已启用。
2. 打开 Obsidian 开发者控制台，检查启动错误。
3. 确认 `src/commands/index.ts` 仍注册了预期命令。

## 4. 设置未持久化

检查：

- `loadData()` 和 `saveData()` 是否被正确 `await`
- 后续写操作是否覆盖了之前的设置变更
- 状态变更后设置 UI 是否刷新

建议操作：

1. 修改并保存一项设置。
2. 重新加载插件或重启 Obsidian。
3. 确认该值被正确读回。

## 5. 状态 UI 表现不一致

检查：

- runtime 状态、持久化状态和渲染结果是否使用同一套语义
- auth pause、同步活动和错误展示是否来自正确的事实来源
- 状态行为变化时，展示逻辑是否同步更新

建议操作：

1. 复现该状态迁移。
2. 对比 runtime 状态、持久化状态和最终渲染输出。
3. 从职责边界上修复问题，而不是只补 UI 表层。

## 6. 共享代码中混入桌面专用行为

检查：

- 该功能是否本来就应当是桌面专用
- 该行为是否已经隔离在 runtime 或 provider 边界之后
- `manifest.json` 是否仍反映真实的平台支持情况

建议操作：

1. 将桌面专属逻辑移动到 runtime 或 provider 边界后面。
2. 重新检查 `manifest.json` 和相关文档。
3. 在预期平台假设下重新验证对应流程。

## 7. 同步行为与预期策略不一致

检查：

- 当前 vault 仍处于初始化阶段，还是已经进入常规运行时同步
- 当前配置的 `syncStrategy`
- 是否命中了 `conflict_pending`、tombstone 或远端缺失双重确认规则

建议操作：

1. 首次同步场景先看 [`SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)。
2. 常规运行时场景再看 [`SYNC_STRATEGY.md`](./SYNC_STRATEGY.md)。
3. 优先检查 planner 决策，而不是只看最终执行的任务列表。

## 8. 诊断信息不够用

检查：

- 失败是否已经被规范化为 `DriveSyncError`
- 日志中是否记录了 `code`、`category` 和必要上下文字段
- 脱敏是否只去掉敏感信息，而没有连调试所需信息一起抹掉

建议操作：

1. 对照 [`ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md) 检查设计链路。
2. 用结构化字段补充上下文，而不是继续堆长字符串日志。
3. 保持“错误规范化 -> 状态/日志持久化 -> UI 翻译展示”的完整链路。
