# Obsidian Drive Sync

将 Obsidian 仓库与远端文件夹进行同步。该插件仍在持续开发中，当前重点是保证同步操作安全、可观察且可回滚。

## 状态

仍在开发中。范围、里程碑和设计说明请参见 `SPECS.md` 与 `TASKS.md`。

近期更新：

- 支持远端变更 cursor/feed，并在必要时回退到快照 diff。
- 增加远端根目录选择 UI。
- 内置缓存/工作区文件的排除规则。
- 提供手动冲突处理流程，并在状态视图中展示冲突列表。
- 支持按优先级调度，并区分重试退避策略与最大重试次数。
- 支持诊断信息脱敏与应用内日志查看。
- 扩展强化计划（预同步检查、队列可见性、cursor 复用）。
- 运行时重构计划已落文档（`main.ts` 门面 + 运行时编排拆分）。
- 运行时重构 Phase A/B 已完成（`main.ts` 门面 + `runtime/{plugin-runtime,session-manager,trigger-scheduler,sync-coordinator}` + `sync/use-cases/sync-runner`）。
- 运行时重构 Phase C 已完成（`network-policy` 仍为可选；当前未启用 provider 侧的远端策略/中间件层）。
- 按职责重组 `sync` 模块（`contracts/planner/engine/state/support/use-cases`）。
- 为同步层依赖方向新增 `oxlint` 导入边界守卫。
- 远端 provider 抽象 Phase C 已完成（命令与冲突/根目录弹窗均迁移至 provider 接口；默认 provider 仍启用）。
- 移除旧版设置兼容层（启动时一次性迁移到 provider 字段，并仅保留 provider 持久化）。
- Proton SDK / 认证实现已迁移到 provider 树下（`provider/providers/proton-drive/sdk`）。
- 收紧 provider 分层：provider 专用与 Obsidian 文件系统实现现在位于 `provider/providers/*`；`sync/` 仅保留 provider 无关内核逻辑。
- 文件系统 contract 集中到 `src/contracts/filesystem/`；共享路径工具仍保留在 `src/filesystem/path.ts`。

## 目标

- 在本地仓库与单个远端文件夹之间进行双向同步。
- 能够检测冲突并以确定性方式处理。
- 具备崩溃恢复和可续跑的作业能力。
- 网络使用量尽量少、明确，并给用户清晰控制权。

## 非目标

- 不替换 Obsidian 原生 vault adapter。
- 不做实时多人协作。
- 不引入超出所选远端 provider 之外的服务端组件。

## 开发

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

生产构建：

```bash
pnpm run build
```

单元测试：

```bash
pnpm run test
```

监听模式：

```bash
pnpm run test:watch
```

`pnpm run build` 会输出 `dist/main.js`，并把 `manifest.json` 与 `styles.css` 一并复制到 `dist/`。

也可以先设置一次 `OBSIDIAN_VAULT_PATH`，之后重复使用：

```bash
export OBSIDIAN_VAULT_PATH="/path/to/YourVault"
pnpm run link:obsidian
```

手动安装用于测试：

```text
<Vault>/.obsidian/plugins/<plugin-id>/
  main.js
  manifest.json
  styles.css
```

## 项目结构

```text
src/
  main.ts                       # 插件门面生命周期
  contracts/                    # 按领域集中定义类型契约
    filesystem/                 # 本地/远端文件系统共享契约
    plugin/                     # 插件 API 与设置契约
    provider/                   # provider 契约
    runtime/                    # runtime 契约
    sync/                       # 同步内核契约
    ui/                         # UI 层契约
  filesystem/
    path.ts                     # 共享路径工具
  provider/                     # provider 实现与注册表
    providers/obsidian/         # Obsidian 本地文件系统与 watcher
    providers/proton-drive/     # Proton 认证/服务/远端文件系统
  commands/                     # 命令处理器（每条命令一个文件，在 commands/index.ts 中注册）
  runtime/                      # 运行时编排
    plugin-state.ts             # 设置与 provider 状态门面
    sync-coordinator.ts         # runtime 到 sync 的编排边界
    use-cases/                  # 手动同步与诊断流程
  sync/                         # 同步内核
    planner/                    # 对账与变更规划逻辑
    engine/                     # 队列与执行引擎
    state/                      # 同步状态持久化模型/存储
    support/                    # hash/path/time 等辅助工具
    use-cases/                  # provider 无关的同步执行管线
  ui/                           # 设置页与弹窗/视图
    settings-tab.ts             # 插件设置页
```

## 安全与隐私

- 默认不开启遥测。
- 仅访问 vault 内部文件。
- 不记录认证敏感信息；会话处理委托给 SDK 的 http client。

## 文档

- `SPECS.md` — 技术规格说明
- `ARCHITECTURE.md` — 面向实现的架构设计
- `SYNC_STRATEGY.md` — 运行时同步策略基线（初始化后）
- `SYNC_INITIALIZATION_STRATEGY.md` — 首次同步初始化策略基线
- `COMMANDS.md` — 命令模块结构与命令目录
- `TROUBLESHOOTING.md` — 排障文档与常见调试检查项
- `TASKS.md` — 开发任务
- `VERIFICATION.md` — 验证步骤

## 存储

- 同步索引通过 Dexie 存放在 IndexedDB 中（设置仍保存在插件数据里）。
