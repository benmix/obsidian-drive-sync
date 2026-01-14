# Proton Drive Obsidian 集成 Spec

> 说明：本文档基于共享聊天记录的需求梳理与实现建议，作为后续实现的统一规格说明与开发参考。

## 目标

- 在 Obsidian 中实现 Proton Drive 的 Vault 同步与恢复能力。
- 登录鉴权流程尽量与 Proton 官方客户端一致，避免自造协议或不安全的简化实现。
- 在插件侧提供清晰、可恢复的认证状态机与可观测的同步流程。

## 非目标

- 在 Obsidian 插件中直接实现 SRP 协议或完整 E2EE 密钥解锁流程。
- 在未明确 SDK 能力之前，强行绑定某个特定 API 字段或未验证的请求序列。

## 参考资料

- Proton Drive SDK（.NET tech-demo）与 Proton 客户端实现路径（mac-client、web-app）。
- Proton 登录典型流程（SRP → session → key/material 初始化）在社区抓包记录中的常见序列。

## 设计原则

1. **最小暴露**：插件侧不直接处理密码学细节，不持久化明文密码。
2. **对齐客户端**：认证流程按 Proton 客户端链路设计（SRP 登录、session 初始化、必要的 key/material 拉取）。
3. **可恢复状态机**：认证必须支持 2FA/captcha 等交互分支与失败重试。
4. **安全存储**：会话、密钥材料优先使用系统钥匙串或安全存储。

## 架构概览

```
Obsidian Plugin (UI + Sync Orchestrator)
        |
        | (local RPC)
        v
Companion Service (SDK Host, Auth, Session, E2EE)
        |
        v
Proton Drive SDK / Proton API
```

### 关键模块职责

- **插件侧（Obsidian）**
  - UI：登录、2FA/captcha 输入、状态提示、同步与恢复命令。
  - 同步编排：触发 sync/restore、进度反馈、冲突策略执行。
  - 持久化最小信息：仅存 session handle 或短期 token（非明文密码）。
- **Companion 服务**
  - 承载 Proton Drive SDK。
  - 处理 SRP 登录、session 初始化、E2EE 解锁、token 刷新。
  - 负责与 Proton API/SDK 的版本兼容与错误码映射。

## 登录鉴权流程（对齐客户端）

### 状态机

```
NeedsPassword -> Needs2FA -> NeedsCaptcha -> Authenticated
      ^             |             |
      |-------------|-------------|
            (失败/过期/风控)
```

### 关键步骤（概念级）

1. **Session Begin**  
   使用 SDK 的 SessionBeginRequest/BeginAsync 或等价入口（含 AppVersion），由 SDK 内部完成 SRP。
2. **Session 初始化**  
   拉取用户信息、key/material、地址信息等，完成客户端可用的 session 初始化。
3. **认证分支**  
   识别 2FA / captcha / 风控要求，并在 UI 中提示用户继续交互。

### UI 交互要求

- 输入项：邮箱/用户名、密码、2FA code、captcha（可扩展）。
- 明确反馈：登录成功、2FA 需要、captcha 需要、登录失败原因。
- 支持主动退出并清除 session。

## 会话与凭据存储

### 存储策略

- 插件侧：只保存 session token 或短期访问凭据（若 SDK 允许）。
- Companion：保存长期 session、密钥材料与 refresh token（若存在）。
- 清除流程：用户退出时，清理本地 session 与 key/material。

### 安全要求

- 不存储明文密码。
- 能力范围内使用系统级安全存储（Keychain/Credential Manager/Secret Service）。

## Sync/Restore 逻辑

### 同步（Vault → Proton Drive）

- 遍历 vault 文件树，上传至指定 Proton Drive 目录。
- 路径保留：使用完整相对路径而非仅文件名。
- 支持增量：基于 hash/mtime 或 SDK 的版本信息（待 SDK 能力验证）。

### 恢复（Proton Drive → Vault）

- 从指定 Proton Drive 目录拉取文件列表。
- 按路径创建本地目录并写入文件。

### 冲突策略（初版）

- 默认：以远端为准（Restore）或以本地为准（Sync）。
- 未来扩展：提供冲突文件重命名策略与可视化提示。

## API / RPC 设计（插件 ↔ Companion）

### RPC 端点（示例）

- `POST /auth/login`  
  输入：username, password, twoFactorCode?, captcha?  
  输出：status, sessionToken?, requires2FA?, requiresCaptcha?
- `POST /auth/logout`
- `GET /session/status`
- `POST /drive/sync`
- `POST /drive/restore`

## 错误处理与用户提示

- 认证失败：明确提示（密码错误、2FA 缺失、风控等）。
- SDK 不可用：提示安装或版本不兼容。
- 同步失败：输出可观察日志并提示重试。

## 兼容性与版本管理

- 依赖 Proton SDK 的版本需与 Proton 客户端验证一致。
- SDK 更新导致协议变更时需调整 RPC 与错误处理逻辑。

## 里程碑

1. **M1**：完成 companion 架构与基础登录鉴权流程（包含 2FA 状态机）。
2. **M2**：实现基础 Sync/Restore 流程与文件路径保持。
3. **M3**：增量同步与冲突处理策略。
4. **M4**：完善 UI、设置项与错误提示。
