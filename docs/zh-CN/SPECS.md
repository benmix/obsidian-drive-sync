# Obsidian Drive Sync

## 1. 概述

### 1.1 产品名称

Obsidian Drive Sync Plugin

### 1.2 目标

为一个本地 Obsidian vault 与一个选定远端目录之间提供可靠的双向同步，并具备冲突检测、失败恢复以及足够的可观测性，方便排查真实同步问题。

### 1.3 非目标

- 不替换 Obsidian 原生 vault adapter
- 不做实时多人协作
- 不自建超出所选远端 provider API 之外的后端
- 不承诺与 Obsidian Sync 绝对一致

## 2. 范围

### 2.1 范围内

- 本地 vault 与单个远端根目录之间的双向同步
- 文件和文件夹的创建、修改、删除、重命名
- 冲突检测和可配置的处理策略
- 会话恢复、重试与可续跑执行
- 桌面平台：macOS、Windows、Linux

### 2.2 范围外

- 完整验证过的移动端自动同步行为
- 富文本或行级合并；冲突处理仍停留在文件级别

## 3. 术语

| 术语            | 含义                                 |
| --------------- | ------------------------------------ |
| Vault           | 由 Obsidian 管理的本地目录           |
| Remote Root     | 选定的远端同步范围目录               |
| relPath         | 相对 vault 根目录的规范化路径        |
| node uid        | 远端节点稳定标识                     |
| Index           | 持久化同步状态数据库                 |
| Job             | 幂等同步任务                         |
| Synced Baseline | 最近一次成功同步时的本地与远端指纹对 |

## 4. 高层架构

### 4.1 组件模型

- UI 层
    - 设置页
    - 同步状态视图
    - 命令面板命令
- Runtime 编排层
    - 会话恢复与刷新
    - 调度与触发协调
    - 同步协调
- Sync kernel
    - 对账本地与远端状态
    - 决定并执行队列任务
    - 持久化同步状态
- Filesystem contracts 层
    - 为 `LocalFileSystem`、`RemoteFileSystem`、`LocalChange` 提供共享契约
- 本地文件系统适配器
    - 基于 Obsidian vault API
    - 负责本地事件流和文件操作
- 远端文件系统适配器
    - 负责远端 provider SDK 交互
    - 暴露稳定的远端文件系统抽象
- 持久化层
    - 插件设置保存在 Obsidian 插件数据中
    - 同步状态保存在 Dexie 支撑的 IndexedDB 中

## 5. 认证与会话

### 5.1 认证模型

- 认证依赖远端 provider 账户与 SDK 会话机制
- 登录形态为用户名、密码，以及可选的 2FA 或 mailbox password
- 插件不持久化明文密码

### 5.2 会话持久化

持久化内容：

- 由 provider 集成层管理的 opaque session 凭据

生命周期：

1. 插件启动后尝试恢复会话
2. 如果会话过期或失效，则进入重新认证流程
3. 若无法恢复，则暂停同步并提示用户处理

### 5.3 安全要求

- 不记录认证敏感字段
- 支持显式登出并清空会话
- 会话校验失败时必须中止同步

### 5.4 SDK 客户端引导要求

当前 provider 集成需要：

- `httpClient`：带认证头、超时、刷新和重试逻辑的 fetch 适配器
- `account`：供解密相关能力使用的 provider 账户接口
- `crypto`：SDK 所需的 OpenPGP 与加密包装层
- `srp`：登录和会话处理所需的 SRP 支持
- `cache`：SDK 使用的内存缓存
- `telemetry`：把 SDK telemetry 路由进插件日志的适配器，且不得带敏感字段

## 6. 本地文件系统要求

### 6.1 事件来源

本地适配器必须处理以下 Obsidian vault 事件：

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 事件规范化

适配器必须：

- 把路径分隔符统一为 `/`
- 去掉 `.` 和 `..`
- 应用一致的大小写策略

### 6.3 事件防抖

- 同一路径的合并窗口应保持在 300 ms 到 800 ms 左右
- `rename` 的优先级应高于 create/delete 抖动

## 7. 远端文件系统要求

### 7.1 Remote Root

- 同步范围仅限一个用户选定的远端根目录
- 插件不得越过该范围操作远端资源

### 7.2 所需远端能力

远端适配器必须支持：

- 带分页的树形遍历
- 创建和更新上传
- 下载
- 删除
- 移动或重命名
- 稳定远端标识
- 至少一种 revision 指纹，例如 revision ID、etag 或 `mtime`

### 7.3 远端变更检测

- 优先：cursor 或 changes feed
- 回退：周期性 snapshot diff

## 8. 持久化要求

### 8.1 `entries` 表

| 字段              | 类型    | 说明               |
| ----------------- | ------- | ------------------ |
| `relPath`         | TEXT PK | 规范化路径         |
| `type`            | ENUM    | `file` 或 `folder` |
| `localMtimeMs`    | INTEGER | 本地时间戳         |
| `localSize`       | INTEGER | 本地大小           |
| `localHash`       | TEXT    | 懒计算 sha256      |
| `remoteId`        | TEXT    | node uid           |
| `remoteRev`       | TEXT    | 远端 revision 指纹 |
| `syncedLocalHash` | TEXT    | 基线               |
| `syncedRemoteRev` | TEXT    | 基线               |
| `tombstone`       | BOOLEAN | 删除标记           |
| `lastSyncAt`      | INTEGER | 最近成功同步时间   |

### 8.2 `jobs` 表

| 字段        | 类型    |
| ----------- | ------- |
| `id`        | TEXT PK |
| `op`        | ENUM    |
| `path`      | TEXT    |
| `fromPath`  | TEXT    |
| `toPath`    | TEXT    |
| `priority`  | INTEGER |
| `attempt`   | INTEGER |
| `nextRunAt` | INTEGER |
| `reason`    | ENUM    |

### 8.3 存储后端

- 插件设置保存在 Obsidian 插件数据中
- 同步状态保存在 Dexie 支撑的 IndexedDB 中
- schema 变更通过 Dexie versioning 管理

### 8.4 迁移规则

- 每次 schema 变化都要递增 `SYNC_STATE_DB_VERSION`
- 需要数据转换时，使用 Dexie 的迁移钩子
- 在可行情况下，为旧版本保留一个版本周期的兼容读取路径
- 对于破坏性变更，要提供带用户提示的重建路径
- 不要在迁移中静默丢数据

## 9. 同步状态模型

### 9.1 路径级状态

典型路径级状态包括：

- `Clean`
- `LocalDirty`
- `RemoteDirty`
- `Conflict`
- `Syncing`
- `Error`

### 9.2 简化状态迁移

| From          | Event      | To            |
| ------------- | ---------- | ------------- |
| `Clean`       | 本地修改   | `LocalDirty`  |
| `Clean`       | 远端变更   | `RemoteDirty` |
| `LocalDirty`  | 上传成功   | `Clean`       |
| `RemoteDirty` | 下载成功   | `Clean`       |
| 任意          | 检测到冲突 | `Conflict`    |
| 任意          | 致命错误   | `Error`       |

## 10. 冲突检测与处理

### 10.1 检测规则

```text
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged -> conflict
```

### 10.2 默认处理模型

- 保留一个 canonical 可编辑文件
- 将另一侧版本保存为冲突副本
- 在索引里把路径标记为冲突状态

冲突副本命名：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

允许的 source 值：

- `local`
- `remote`

### 10.3 支持的策略值

- `bidirectional`
- `local_win`
- `remote_win`

## 11. 作业队列与执行

### 11.1 作业类型

- `upload`
- `download`
- `delete-remote`
- `delete-local`
- `move-remote`
- `move-local`
- `create-remote-folder`
- `create-local-folder`

### 11.2 执行规则

- 同一路径上的任务串行执行
- 当顺序相关时，move 和 delete 优先于普通内容任务
- 使用基于优先级的调度
- 当前内建并发上限为 2
- 所有任务都必须幂等
- 队列状态支持 `pending`、`processing`、`blocked`
- 重试时间必须能在持久化状态或 UI 中看到

### 11.3 重试策略

- 网络错误和瞬时服务端失败采用指数退避
- 认证失败会暂停同步并要求用户介入
- 重试行为可以按错误类型细分
- 超过内建重试上限后，任务进入失败状态

## 12. 启动与恢复

### 12.1 插件启动流程

1. 加载同步状态
2. 恢复认证会话
3. 执行快速本地扫描
4. 拉取远端变更
5. 对账并生成任务
6. 启动队列执行

### 12.2 崩溃恢复

- 恢复未完成任务
- 保留 tombstone，避免反复 create/delete 抖动
- 支持显式的重建索引恢复操作
- 启动时清理陈旧 processing 任务和孤儿状态

## 13. UI 与 UX 要求

### 13.1 设置页

设置页至少应暴露：

- 账号登录与登出
- 远端根目录选择
- 带校验和预览的 exclude rules
- 同步策略
- 自动同步开关

### 13.2 状态视图

状态视图至少应展示：

- 当前同步状态
- 队列长度与任务计数
- 如有必要，展示正在执行的任务和下一次重试时间
- 最近一次错误摘要
- 手动同步与暂停/恢复操作
- 冲突摘要
- 最近日志

### 13.3 命令

命令集至少应支持：

- 立即同步
- 暂停/恢复自动同步
- 重建索引
- 导出诊断
- 处理冲突

## 14. 性能要求

- 大 vault 启动应保持可接受，包括约 50k 文件量级
- 插件不得阻塞 Obsidian 主线程
- 哈希计算应尽量懒执行
- 远端遍历应带分页，并按 provider 能力节制速度
- pre-sync 检查应在高成本或高风险执行前给出估算
- 后台对账必须做节流

## 15. 可观测性要求

- 无敏感字段的结构化日志
- 任务级错误跟踪
- 带脱敏的诊断包导出
- 应用内日志查看器
- 运行时指标，如耗时、吞吐、失败率和队列峰值

## 16. 风险与缓解

| 风险                 | 缓解方式                                     |
| -------------------- | -------------------------------------------- |
| provider SDK 不稳定  | 通过远端适配器隔离                           |
| 没有远端 cursor 支持 | 使用 snapshot diff 和优化                    |
| 大 vault 性能问题    | 使用懒哈希、批处理和节流                     |
| rename 复杂度高      | 明确处理 rename 逻辑并覆盖边界测试           |
| cursor 抖动          | 持久化 cursor 并在必要时回退到 snapshot diff |
| 移动端差异           | 在验证前将移动端视为降级支持                 |

## 17. 里程碑

### Phase 0：可行性

- 通过 provider SDK 验证登录、列目录、上传和下载

### Phase 1：MVP

- 手动双向同步
- 索引和任务队列
- 基础冲突处理

### Phase 2：GA

- 自动同步
- 远端增量处理
- 更完整的恢复与诊断

## 18. 开放问题

- provider 是否在所有目标环境里都暴露了正式的 change feed 或 cursor
- 是否可以只用公开 SDK 数据推导出更强的远端指纹

## 19. 运行时重构计划（2026-03）

### 19.1 目标

- 保持 `main.ts` 轻量，把编排逻辑移动到 `runtime/*`
- 在改善职责清晰度的同时保持 sync-kernel 语义不变
- 让 scheduler、session 和单次同步流程更容易测试

### 19.2 目标分层

- 插件门面仍位于 `main.ts`
- 运行时编排位于 `runtime/*`
- provider 无关的 sync kernel 位于 `sync/*`
- provider 自有文件系统适配器位于 `provider/providers/*`
- 共享契约统一位于 `src/contracts/*`

### 19.3 非目标

- 不新增冲突策略
- 不重写重试语义
- 不替换 Dexie 与插件数据这一存储方案

### 19.4 推进阶段

1. 从 `main.ts` 拆出编排逻辑
2. 进一步拆分 session、scheduler 和 coordinator 职责
3. 增加可选网络策略

### 19.5 验收标准

- 每个阶段后 `pnpm run test` 和 `pnpm run build` 都通过
- session restore、token refresh、pause/resume 与 rename 场景无行为回归

## 20. 远端 Provider 抽象计划（2026-03）

### 20.1 目标

- 把认证、连接、scope 校验和远端文件系统创建统一归到 provider 层
- 在不修改 sync-kernel 算法的前提下支持未来更多 provider
- 保持当前 `proton-drive` 的默认行为不变

### 20.2 主要抽象

- `RemoteProvider`
    - login、restore、refresh、logout
    - connect、disconnect
    - create remote filesystem
    - validate scope
- `LocalProvider`
    - create local filesystem
    - create local watcher
- 本地与远端 provider registry

### 20.3 设置模型演进

provider 导向的设置字段包括：

- `remoteProviderId`
- `remoteScopeId`
- `remoteScopePath`
- `remoteProviderCredentials`
- `remoteAccountEmail`
- `remoteHasAuthSession`

兼容方向：

- 直接持久化 provider 导向字段
- runtime 仅读写 provider 字段
- 不要长期保留旧品牌专用兼容路径

### 20.4 推进阶段

1. 增加 provider 契约和注册表
2. 让 runtime session 和 sync 入口迁移到 provider 接口
3. 让设置、登录、命令和弹窗迁移到 provider API
4. 删除陈旧的直连 provider helper 路径

### 20.5 验收标准

- provider 化后的 runtime 仍能与现有状态和设置协同工作
- login restore、token refresh、auto-sync 和 manual sync 无回归
- lint、test 和 build 均保持绿色

### 20.6 实现状态（2026-03-06）

- Phase A、B、C 已完成
- 已增加 provider session helper 统一 restore、refresh 与 connect 路径
- 已增加 provider root-scope API，使远端目录选择 UI 不再依赖 SDK 细节
- 已移除旧设置兼容路径
- 当时里程碑验证结果为：`pnpm run lint`、`pnpm run test`、`pnpm run build` 全部通过
