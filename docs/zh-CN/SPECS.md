---

# Obsidian Drive Sync

**技术规格说明（Specs v1.0）**

---

## 1. 概述

### 1.1 产品名称

**Obsidian Drive Sync Plugin**

### 1.2 目标

提供一个 Obsidian 插件，在本地 vault 与远端 provider 指定目录之间实现**可靠的双向同步**，并具备冲突检测、失败恢复与可观测性。

### 1.3 非目标

- 不替换 Obsidian 原生 vault adapter。
- 不实现实时多人协作。
- 不实现超出远端 provider API 之外的自定义后端。
- 不保证与 Obsidian Sync 的状态一致性。

---

## 2. 范围

### 2.1 范围内

- 本地 vault 与远端 provider 目录的双向同步。
- 文件 / 文件夹的创建、修改、删除、重命名。
- 冲突检测与自动处理（默认策略）。
- 会话恢复、重试与可续跑执行。
- 桌面平台（macOS / Windows / Linux）。

### 2.2 范围外

- 完整的移动端自动同步行为（后续可能提供降级支持）。
- 富文本级别合并（仅支持文件级别）。

---

## 3. 术语

| 术语            | 定义                                |
| --------------- | ----------------------------------- |
| Vault           | 由 Obsidian 管理的本地文件目录      |
| Remote Root     | 作为同步根的远端 provider 目录      |
| relPath         | 相对于 vault 根目录的规范化路径     |
| node uid        | 远端节点的稳定标识                  |
| Index           | 本地同步状态数据库                  |
| Job             | 一个幂等的同步任务                  |
| Synced Baseline | 最近一次成功同步时的本地 / 远端指纹 |

---

## 4. 高层架构

### 4.1 组件模型

- **UI 层**
    - 设置页
    - 同步状态视图
    - 命令面板命令

- **同步编排层**
    - Reconciler（对齐本地与远端状态）
    - Scheduler（调度任务队列）
    - State Machine（路径级状态）

- **文件系统契约层**
    - 提供 `LocalFileSystem` / `RemoteFileSystem` / `LocalChange` 等共享类型契约。
    - 作为 `sync/` 与 `provider/` 的共同基础依赖；不包含业务流程逻辑。

- **LocalFS Adapter**
    - 基于 Obsidian Vault API。
    - 提供事件流与文件操作能力。

- **RemoteFS Adapter**
    - 是远端 provider SDK 的唯一依赖层。
    - 暴露统一的远端文件系统抽象。

- **持久化层**
    - Index DB（基于 Dexie 的 IndexedDB）
    - Job Queue
    - Remote Cursor / Snapshot Metadata

---

## 5. 认证与会话

### 5.1 认证模型

- 使用远端 provider 基于账号的 **SDK session 机制**（通过注入的 `httpClient` 实现）。
- 登录形态：用户名 + 密码 + 可选 2FA。
- 插件**不**持久化明文密码。

### 5.4 SDK 客户端引导要求

- `httpClient`：插件提供的 fetch adapter，负责附加认证头、超时控制、401 refresh + retry。
- `account`：基于远端 provider API 的 account 接口，用于地址 / key / 私钥解密等能力。
- `crypto`：OpenPGP + crypto proxy 包装层，用于满足 SDK 的密码学接口要求。
- `srp`：用于登录 / 会话计算的 SRP 模块。
- `cache`：`entitiesCache` + `cryptoCache`（MemoryCache），供 SDK 维护内部状态。
- `telemetry`：映射到插件日志的 SDK telemetry adapter（不得携带敏感字段）。

### 5.2 会话持久化

- 持久化载荷：由 SDK 集成层（`httpClient`）管理的不透明 session 凭据。
- 生命周期：
    1. 插件启动 -> 恢复会话
    2. 如果过期 / 失效 -> 通过登录流程重新认证
    3. 如果失败 -> 提示用户登录

### 5.3 安全要求

- 不记录敏感字段。
- 支持用户动作：“Sign out & Clear Session”。
- 当会话失效时必须显式中断同步。

---

## 6. 本地文件系统规范

### 6.1 事件来源

来自 Obsidian Vault API 的事件：

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 事件规范化

- 将路径分隔符统一为 `/`。
- 移除 `.` / `..`。
- 应用统一的大小写策略（可配置）。

### 6.3 事件防抖

- 同一路径合并窗口：**300–800ms**。
- `rename` 的优先级高于 `create/delete`。

---

## 7. 远端文件系统规范

### 7.1 Remote Root

- 同步范围限定在一个由用户选择的远端根目录。
- 插件不得访问该目录之外的资源。

### 7.2 所需远端能力

RemoteFS adapter 必须提供：

- 列出树结构（可分页）
- 上传（创建 / 更新）
- 下载
- 删除
- 移动 / 重命名
- 稳定标识（`node uid`）
- revision / etag / mtime（至少一种）

### 7.3 远端变更检测

- **优先**：cursor / changes feed（SDK tree events）
- **回退**：周期性快照 diff

---

## 8. 索引数据库规范

### 8.1 表：`entries`

| 字段            | 类型    | 说明             |
| --------------- | ------- | ---------------- |
| relPath         | TEXT PK | 规范化路径       |
| type            | ENUM    | file / folder    |
| localMtimeMs    | INTEGER |                  |
| localSize       | INTEGER |                  |
| localHash       | TEXT    | sha256，惰性计算 |
| remoteId        | TEXT    | node uid         |
| remoteRev       | TEXT    | revision uid     |
| syncedLocalHash | TEXT    | 同步基线         |
| syncedRemoteRev | TEXT    | 同步基线         |
| tombstone       | BOOLEAN | 删除标记         |
| lastSyncAt      | INTEGER |                  |

### 8.2 表：`jobs`

| 字段      | 类型    |
| --------- | ------- |
| id        | TEXT PK |
| op        | ENUM    |
| path      | TEXT    |
| fromPath  | TEXT    |
| toPath    | TEXT    |
| priority  | INTEGER |
| attempt   | INTEGER |
| nextRunAt | INTEGER |
| reason    | ENUM    |

### 8.3 存储后端

- 使用 Dexie 的 IndexedDB（浏览器安全，兼容 Obsidian）。
- 设置仍保存在 Obsidian 插件数据中；同步状态位于 IndexedDB。
- Schema 迁移通过 Dexie versioning 管理（见 8.4）。

### 8.4 IndexedDB schema migration

迁移规则：

- 每次 schema 变更都提升 `SYNC_STATE_DB_VERSION`，并新增一个 Dexie `.version(n).stores(...)`。
- 在需要数据转换时，使用 Dexie 的 `modify` / `add` / `delete`。
- 至少保留一个向后兼容读取版本（N-1）。
- 对破坏性变更，必须提供 reindex 路径（清空 + 重建），并向用户显式告警。
- 避免静默丢表；应尽量保留关键记录。

已规划变更（占位，用于保持版本设计一致）：

- v3：为 jobs 增加 `status` 索引（schema 中已存在），并为缺失字段补齐 migration guard。
- v4：在不改变 entry/job key 的前提下，扩展 `runtimeMetrics` 字段（如有需要）。

---

## 9. 同步状态机

### 9.1 路径级状态

- `Clean`
- `LocalDirty`
- `RemoteDirty`
- `Conflict`
- `Syncing`
- `Error`

### 9.2 状态迁移（简化）

| From        | Event             | To          |
| ----------- | ----------------- | ----------- |
| Clean       | Local modify      | LocalDirty  |
| Clean       | Remote change     | RemoteDirty |
| LocalDirty  | Upload success    | Clean       |
| RemoteDirty | Download success  | Clean       |
| \*          | Conflict detected | Conflict    |
| \*          | Fatal error       | Error       |

---

## 10. 冲突检测与处理

### 10.1 检测规则

```text
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged -> Conflict
```

### 10.2 默认处理策略

- 保留一个规范的可编辑文件。
- 将对侧版本保存为一个冲突副本：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

- `<source>` 取值：`local` / `remote`
- 将结果持久化到索引中，并标记为冲突状态。

### 10.3 可配置策略

- `bidirectional`（默认）
- `local_win`
- `remote_win`

---

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

- 同一路径上的执行必须串行化。
- 优先执行 move/delete，再执行内容类作业。
- 按优先级调度（高优先级先执行）。
- 并发上限：2（内建，不可配置）。
- 所有作业都必须**幂等**。
- 队列状态机：pending / processing / blocked。
- 重试调度（`retryAt`）必须对用户可见。

### 11.3 重试策略

- 网络 / 5xx：指数退避。
- 认证错误：暂停并要求重新登录。
- 按错误类型区分退避（rate / network / 404 等）。
- 超过最大重试次数（内建为 5） -> 进入 `Error` 状态。

---

## 12. 启动与恢复

### 12.1 插件启动流程

1. 加载 Index DB
2. 恢复会话
3. 快速扫描本地（mtime / size）
4. 拉取远端变更
5. Reconcile -> 入队作业
6. 启动 worker

### 12.2 崩溃恢复

- 继续未完成作业。
- 保留 tombstone，避免重复 create/delete 抖动。
- 提供 “Rebuild Index” 命令。
- 启动时清理陈旧 processing jobs 与孤儿状态。

---

## 13. UI 与 UX 要求

### 13.1 设置

- 账号登录 / 登出
- Remote Root 选择器
- 排除规则（支持 `*` / `**`，含校验与预览）
- 冲突策略
- 自动同步开关

### 13.2 状态视图

- 当前状态
- 队列长度
- 当前进行中的作业 + 下次重试时间
- 最近错误
- 手动同步 / 暂停 / 恢复
- 冲突摘要
- 最近日志

### 13.3 命令

- 立即同步
- 暂停 / 恢复
- 重建索引
- 导出诊断信息
- 审查冲突

---

## 14. 性能要求

- 支持最多约 50k 文件的 vault 启动。
- 不得阻塞 Obsidian 主线程。
- 惰性 hash 计算。
- 采用分页远端遍历，并根据 provider / SDK 特性控制节奏。
- 预同步检查（作业数量、体积估算、确认 / 取消）。
- 后台 reconcile + 限流扫描。

---

## 15. 可观测性

- 结构化日志（不得包含敏感字段）
- job 级错误跟踪
- 可导出的诊断包（脱敏）
- 日志查看器（状态视图）
- 运行时指标（耗时、吞吐、失败率、队列峰值）

---

## 16. 风险与缓解

| 风险                     | 缓解方式                  |
| ------------------------ | ------------------------- |
| 远端 provider SDK 不稳定 | 通过 RemoteFS 门面隔离    |
| 没有远端 cursor          | 使用快照 diff + 优化      |
| 大 vault 性能压力        | 分层扫描 + 限流           |
| 外部 rename 复杂         | 未来引入 rename 推断窗口  |
| Cursor 抖动              | 持久化 cursor + 快照回退  |
| 移动端差异               | 提供降级路径 + 运行时检测 |

---

## 17. 里程碑

### Phase 0 - 可行性

- 验证 SDK 登录 + list / upload / download。

### Phase 1 - MVP

- 双向同步（手动触发）。
- Index + job queue。
- 基础冲突处理。

### Phase 2 - GA

- 自动同步。
- 远端增量处理。
- 完整恢复与诊断。

---

## 18. 开放问题

- 是否存在官方 change feed / cursor？
- 是否能通过 SDK 公开 API 组合出更强的远端变更指纹（例如 etag / mtime / size 组合）？

---

## 19. 运行时重构计划（2026-03）

### 19.1 目标

- 将插件入口与同步编排解耦：让 `main.ts` 保持为薄门面，把运行时逻辑迁到 `runtime/*`。
- 保持 sync-kernel 语义稳定：`reconciler + queue + executor` 保持稳定，此次重构不改算法。
- 提升可测试性：scheduler、session 与单周期执行都应能独立测试。

### 19.2 目标分层

- **Plugin Facade（`main.ts`）**
    - 设置加载 / 保存
    - UI 标签页 / 命令注册
    - 生命周期委派

- **Runtime Layer（`runtime/*`）**
    - `plugin-runtime.ts`：高层编排与对插件暴露的 API
    - `session-manager.ts`：恢复 / 刷新 / 持久化认证会话
    - `trigger-scheduler.ts`：interval + 本地 debounce + single-flight
    - `sync-coordinator.ts`：围绕 provider / session / scope 的运行时编排
    - `use-cases/*`：手动同步与诊断编排

- **Sync Kernel（`sync/*`）**
    - `planner/*`：本地 / 远端规划与对账策略
    - `engine/*`：执行引擎与队列
    - `state/*`：状态存储与内存索引模型
    - `support/*`：共享辅助工具
    - `use-cases/*`：provider 无关的单周期同步执行
    - 共享契约位于 `src/contracts/sync/*` 与 `src/contracts/filesystem/*`
    - 保持冲突 / 重试 / 状态语义不变

- **Provider 远端文件系统 adapter 边界（`provider/providers/*`）**
    - provider 自持有的 `RemoteFileSystem` adapter
    - 默认不引入共享的 provider 侧 decorator / strategy 层
    - 只有在明确的跨 provider 需求出现后，才新增共享抽象

### 19.3 此次重构的非目标

- 不新增新的冲突策略。
- 不调整作业优先级与重试语义。
- 不更换存储后端（继续使用 Dexie IndexedDB + 插件数据设置）。

### 19.4 推进阶段

1. **Phase A（保持行为不变的拆分）**
    - 将编排逻辑从 `main.ts` 抽到 `runtime/plugin-runtime.ts`
    - 保持对 UI / commands 暴露的插件方法稳定

2. **Phase B（编排边界）**
    - 将 session / scheduler / runner 拆分为独立运行时模块

3. **Phase C（弹性扩展）**
    - 增加 `NetworkPolicy` 运行时模块（feature-flagged）
    - provider 专用 IO 行为仍保留在 provider adapter 中，除非已经证明共享抽象合理

### 19.5 验收标准

- 每个阶段后 `pnpm run test` 与 `pnpm run build` 都通过。
- 不得回归以下手动场景：
    - 会话恢复
    - token 刷新
    - 自动同步暂停 / 恢复
    - 本地 / 远端 rename 同步

## 20. 远端 Provider 抽象计划（2026-03）

### 20.1 目标

- 将远端文件操作与认证 / 连接 / scope 校验统一收口到 provider 层。
- 在不改 sync-kernel 算法的前提下支持未来新增远端 provider。
- 保持默认行为不变（默认 provider 仍为 `proton-drive`）。

### 20.2 新抽象

- **RemoteProvider**
    - `login/restore/refresh/logout`
    - `connect/disconnect`
    - `createRemoteFileSystem(client, scopeId)`
    - `validateScope(client, scopeId)`

- **LocalProvider**
    - `createLocalFileSystem(app)`
    - `createLocalWatcher(app, onChange, registerEvent, debounceMs)`

- **LocalProviderRegistry**
    - 按 `localProviderId` 发现本地 provider
    - 默认回退到 `obsidian-local`

- **RemoteProviderRegistry**
    - 按 `remoteProviderId` 发现远端 provider
    - 默认回退到 `proton-drive`

### 20.3 设置模型演进

- 新增面向 provider 的字段：
    - `remoteProviderId`
    - `remoteScopeId` / `remoteScopePath`
    - `remoteProviderCredentials`
    - `remoteAccountEmail`
    - `remoteHasAuthSession`

- 兼容策略：
    - 启动时一次性把旧的品牌专用字段（如 `protonSession`、`remoteFolderId` 等）迁移到 provider 字段
    - 迁移后只持久化 provider-only 设置（不再做 dual-write 兼容字段）
    - 从运行时代码里移除旧版设置路径的读写

### 20.4 推进阶段

1. **Phase A**
    - 增加 provider 契约 / 注册表与默认远端 provider 实现

2. **Phase B**
    - 将运行时 session / sync runner 迁移到 provider 接口

3. **Phase C**
    - 将设置 / 登录 / 命令 / 弹窗从直接依赖 provider service 迁移到 provider API

4. **Phase D**
    - 删除未使用的 provider 专用辅助代码，并让 provider use-cases 成为唯一同步入口

### 20.5 验收标准

- 基于 provider 的运行时能够使用现有 provider 数据 / 状态正常工作。
- 登录恢复、token 刷新、自动同步与手动同步不得出现行为回归。
- 每阶段结束后 lint / test / build 都保持绿色。

### 20.6 实现状态（2026-03-06）

- Phase A / B / C 已完成（provider 契约 / 注册表、运行时、设置 / 登录 / 命令 / 弹窗）。
- 已增加 provider session helper，以统一 restore / refresh / connect 的会话路径。
- 已在 provider 中增加 `getRootScope(...)`，因此远端文件夹选择器不再依赖具体 SDK 细节。
- 已移除旧版 dual-write 设置兼容路径；当前为一次性迁移后仅保留 provider-only 持久化。
- 当时的验证结果：`pnpm run lint`、`pnpm run test` 与 `pnpm run build` 均已通过。

---
