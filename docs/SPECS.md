---

# Obsidian Proton Drive Sync

**Technical Specification (Specs v1.0)**

---

## 1. Overview

### 1.1 Product Name

**Obsidian Proton Drive Sync Plugin**

### 1.2 Purpose

为 Obsidian 提供一个插件，使本地 Vault 与 Proton Drive 上指定目录实现**可靠的双向同步**，具备冲突检测、失败恢复与可观测性。

### 1.3 Non-Goals

- 不替换 Obsidian 原生 Vault Adapter
- 不实现多人实时协同编辑
- 不实现 Proton Drive API 之外的自建后端
- 不保证与 Obsidian Sync 的状态一致性

---

## 2. Scope

### 2.1 In Scope

- 本地 Vault ↔ Proton Drive 目录的双向同步
- 文件/目录的 create / modify / delete / rename
- 冲突检测与自动解决（默认策略）
- 会话恢复、失败重试、断点续跑
- 桌面端（macOS / Windows / Linux）

### 2.2 Out of Scope

- 移动端完整自动同步（可后续降级支持）
- 富文本级别的 merge（仅文件级）

---

## 3. Terminology

| Term            | Definition                      |
| --------------- | ------------------------------- |
| Vault           | Obsidian 管理的本地文件目录     |
| Remote Root     | Proton Drive 上作为同步根的目录 |
| relPath         | 相对于 Vault 根目录的规范化路径 |
| node uid        | Proton Drive 节点稳定标识       |
| Index           | 本地维护的同步状态数据库        |
| Job             | 一个可幂等执行的同步任务        |
| Synced Baseline | 上一次成功同步时的本地/远端指纹 |

---

## 4. High-Level Architecture

### 4.1 Component Model

- **UI Layer**
    - Settings Tab
    - Sync Status View
    - Command Palette Commands

- **Sync Orchestrator**
    - Reconciler（对齐本地与远端状态）
    - Scheduler（调度任务队列）
    - State Machine（路径级状态）

- **LocalFS Adapter**
    - 基于 Obsidian Vault API
    - 提供事件流与文件操作能力

- **RemoteFS Adapter**
    - Proton Drive SDK 的唯一依赖层
    - 提供统一的远端文件系统抽象

- **Persistence Layer**

- Index DB（IndexedDB via Dexie）
    - Job Queue
    - Remote Cursor / Snapshot Metadata

---

## 5. Authentication & Session

### 5.1 Authentication Model

- 基于 Proton Account 的 **SDK 会话机制**（由 `httpClient` 注入实现）
- 登录形态：用户名 + 密码 +（可选）2FA
- 插件**不保存明文密码**

### 5.2 Session Persistence

- 持久化内容：SDK 接入层的 **会话凭据（opaque）**，由 `httpClient` 管理
- 生命周期：
    1. Plugin start → restore session
    2. If expired/invalid → re-auth via login flow
    3. If failed → prompt login

### 5.3 Security Requirements

- 不记录敏感字段到日志
- 支持用户手动“Sign out & Clear Session”
- Session 失败需显式中断同步

---

## 6. Local Filesystem Specification

### 6.1 Event Sources

来自 Obsidian Vault API 的事件：

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 Event Normalization

- 路径统一为 `/` 分隔
- 去除 `.` / `..`
- 统一大小写策略（配置项）

### 6.3 Event Debounce

- 同一路径事件合并窗口：**300–800ms**
- rename 优先级高于 create/delete

---

## 7. Remote Filesystem Specification

### 7.1 Remote Root

- 同步范围限定在一个用户指定的 Remote Root
- 插件不得访问该目录以外的资源

### 7.2 Required Remote Capabilities

RemoteFS Adapter 必须提供：

- list tree（分页）
- upload (create/update)
- download
- delete
- move/rename
- stable identifier（`node uid`）
- revision / etag / mtime（至少一种）

### 7.3 Remote Change Detection

- **Preferred**：cursor / changes feed（SDK tree events）
- **Fallback**：periodic snapshot diff

---

## 8. Index Database Specification

### 8.1 Table: `entries`

| Field           | Type    | Notes          |
| --------------- | ------- | -------------- |
| relPath         | TEXT PK | 规范化路径     |
| type            | ENUM    | file / folder  |
| localMtimeMs    | INTEGER |                |
| localSize       | INTEGER |                |
| localHash       | TEXT    | sha256，可懒算 |
| remoteId        | TEXT    | node uid       |
| remoteRev       | TEXT    | revision uid   |
| syncedLocalHash | TEXT    | 同步基线       |
| syncedRemoteRev | TEXT    | 同步基线       |
| tombstone       | BOOLEAN | 删除标记       |
| lastSyncAt      | INTEGER |                |

### 8.2 Table: `jobs`

| Field     | Type    |
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

### 8.3 Storage Backend

- IndexedDB via Dexie (browser-safe, Obsidian-compatible).
- Settings remain in Obsidian plugin data; sync state lives in IndexedDB.

---

## 9. Sync State Machine

### 9.1 Path-Level States

- `Clean`
- `LocalDirty`
- `RemoteDirty`
- `Conflict`
- `Syncing`
- `Error`

### 9.2 State Transitions (Simplified)

| From        | Event             | To          |
| ----------- | ----------------- | ----------- |
| Clean       | Local modify      | LocalDirty  |
| Clean       | Remote change     | RemoteDirty |
| LocalDirty  | Upload success    | Clean       |
| RemoteDirty | Download success  | Clean       |
| \*          | Conflict detected | Conflict    |
| \*          | Fatal error       | Error       |

---

## 10. Conflict Detection & Resolution

### 10.1 Detection Rule

```
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged → Conflict
```

### 10.2 Default Resolution Strategy

- 本地版本保留为主
- 远端版本下载为：

    ```
    filename (Proton conflicted YYYY-MM-DD HHmm).ext
    ```

- 两者均写入 Index

### 10.3 Configurable Strategies

- Local wins (default)
- Remote wins
- Manual (pause + notify)

---

## 11. Job Queue & Execution

### 11.1 Job Types

- `upload`
- `download`
- `deleteRemote`
- `deleteLocal`
- `moveRemote`
- `moveLocal`
- `mkdirRemote`
- `mkdirLocal`

### 11.2 Execution Rules

- 同一路径串行
- move/delete 优先于 content
- priority-aware scheduling（高优先级先执行）
- 并发上限：2–4（配置项）
- 所有 job 必须 **幂等**
- Queue 状态机：pending / processing / blocked
- retryAt 调度与可视化

### 11.3 Retry Policy

- 网络 / 5xx：指数退避
- Auth error：暂停并要求重新登录
- 按错误类别区分退避（rate/network/404 等）
- 超过最大重试 → Error 状态（可配置）

---

## 12. Startup & Recovery

### 12.1 Plugin Startup Flow

1. Load Index DB
2. Restore session
3. Local quick scan（mtime/size）
4. Pull remote changes
5. Reconcile → enqueue jobs
6. Start workers

### 12.2 Crash Recovery

- 未完成 job 继续执行
- tombstone 保留，避免重复创建/删除
- 支持 “Rebuild Index” 命令
- 启动清理 stale processing job 与 orphaned state

---

## 13. UI & UX Requirements

### 13.1 Settings

- Account login/logout
- Remote Root selector
- Exclude rules（支持 `*`/`**`，包含校验与预览）
- Conflict strategy
- Auto sync on/off
- Max retry attempts

### 13.2 Status View

- Current state
- Queue length
- In-flight job + next retry time
- Last error
- Manual sync / pause / resume
- Conflicts summary
- Recent logs

### 13.3 Commands

- Sync now
- Pause / Resume
- Rebuild index
- Export diagnostics
- Review conflicts

---

## 14. Performance Requirements

- Vault ≤ 50k files 可启动
- 不阻塞 Obsidian 主线程
- Hash 计算懒执行
- 远端遍历分页 + 限流
- 预同步检查（作业数量、大小估算、确认/取消）
- 背景 reconciliation + 扫描节流

---

## 15. Observability

- Structured logs（不含敏感信息）
- Job-level error tracking
- 可导出诊断包（脱敏）
- 日志查看（状态视图）
- 运行指标（耗时、吞吐、失败率、队列峰值）

---

## 16. Risks & Mitigations

| Risk              | Mitigation               |
| ----------------- | ------------------------ |
| Proton SDK 不稳定 | RemoteFS Facade 隔离     |
| 无远端 cursor     | 快照 diff + 优化         |
| 大 Vault 性能     | 分层扫描 + 限流          |
| 外部 rename       | rename 推断窗口（后续）  |
| 事件 cursor 抖动  | 持久化 cursor + 回退快照 |
| 移动端差异        | 降级路径 + 运行时检测    |

---

## 17. Milestones

### Phase 0 – Feasibility

- SDK 登录 + list/upload/download 验证

### Phase 1 – MVP

- 双向同步（手动触发）
- Index + Job Queue
- 基础冲突处理

### Phase 2 – GA

- 自动同步
- 远端增量
- 完整恢复与诊断

---

## 18. Open Questions

- 是否存在官方 change feed / cursor
- 是否能在 SDK 公共 API 中获得更强的远端变更指纹（etag/mtime/size 组合）

---
