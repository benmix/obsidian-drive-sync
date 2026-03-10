# 错误系统

最后更新：2026-03-10

## 1. 目的

项目使用一套共享的结构化错误系统，让运行时策略、UI 文案、同步状态、日志、诊断导出统一基于同一种错误语义工作。

核心规则很简单：

**内部代码路径统一操作结构化错误，用户界面只展示安全且可翻译的信息。**

这份文档描述的是当前实现，不是迁移提案。

## 2. 目标

- 在项目自有逻辑中用稳定错误码替代脆弱的 `Error.message` 匹配。
- 分离内部诊断信息和用户可见文案。
- 让重试、认证暂停、阻塞任务恢复等策略由错误码驱动。
- 将结构化错误字段持久化到同步状态和日志中。
- 导出具备排障价值、同时做过基础脱敏的诊断信息。

## 3. 非目标

- 重写第三方 Proton SDK 内部抛出的所有原生 `Error`。
- 引入复杂的异常继承层级。
- 继续兼容历史的 `lastError: string` 状态模型。

## 4. 核心模型

共享错误类型是 `DriveSyncError`。

```ts
export type ErrorCategory =
	| "auth"
	| "network"
	| "local_fs"
	| "remote_fs"
	| "sync"
	| "config"
	| "validation"
	| "provider"
	| "internal";

export type ErrorSeverity = "info" | "warn" | "error" | "fatal";

export type DriveSyncErrorCode =
	| "AUTH_SESSION_EXPIRED"
	| "AUTH_REAUTH_REQUIRED"
	| "AUTH_SIGN_IN_REQUIRED"
	| "AUTH_INVALID_CREDENTIALS"
	| "AUTH_2FA_REQUIRED"
	| "AUTH_MAILBOX_PASSWORD_REQUIRED"
	| "NETWORK_TIMEOUT"
	| "NETWORK_RATE_LIMITED"
	| "NETWORK_TEMPORARY_FAILURE"
	| "LOCAL_NOT_FOUND"
	| "REMOTE_NOT_FOUND"
	| "REMOTE_ALREADY_EXISTS"
	| "REMOTE_PATH_CONFLICT"
	| "REMOTE_UNSUPPORTED"
	| "REMOTE_WRITE_FAILED"
	| "REMOTE_TRANSIENT_INCOMPLETE"
	| "PROVIDER_CONNECT_FAILED"
	| "SYNC_RETRY_EXHAUSTED"
	| "SYNC_JOB_INVALID"
	| "CONFIG_PROVIDER_MISSING"
	| "CONFIG_SCOPE_MISSING"
	| "INTERNAL_UNEXPECTED";

class DriveSyncError extends Error {
	readonly code: DriveSyncErrorCode;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly retryable: boolean;
	readonly userMessage: string;
	readonly userMessageKey?: string;
	readonly userMessageParams?: TranslationParams;
	readonly debugMessage?: string;
	readonly details?: Record<string, unknown>;
	readonly cause?: unknown;
}
```

主要字段含义：

- `code`：稳定语义标识，供运行时策略判断。
- `category`：粗粒度分类，例如 auth、network、sync。
- `retryable`：是否允许自动重试。
- `userMessage` / `userMessageKey`：安全的用户可见信息来源。
- `debugMessage` / `details`：诊断用上下文。
- `cause`：必要时保留原始底层错误。

## 5. 主要工具函数

共享辅助函数位于 `src/errors/`。

核心入口：

- `createDriveSyncError(code, init)`
- `normalizeUnknownDriveSyncError(error, options?)`
- `translateDriveSyncErrorUserMessage(error, tr)`
- `toDriveSyncErrorSummary(error)`
- `formatDriveSyncErrorForLog(error)`
- `shouldPauseAuthForError(error)`
- `getRetryDelayForDriveSyncError(error, attempt)`

关于归一化有一个重要规则：

- `normalizeUnknownDriveSyncError()` 既接受原始错误，也接受已存在的 `DriveSyncError`。
- 如果传入的是已有 `DriveSyncError`，同时又提供了覆写参数，函数会返回一个重新包装后的 `DriveSyncError`。
- 这样高层工作流可以保留底层稳定错误码，同时替换成更适合当前场景的用户文案。

## 6. 分层职责

### 6.1 Provider / SDK 适配层

职责：

- 尽早把第三方异常映射成 `DriveSyncError`。
- 在 `details` 中补充必要的 provider 上下文。
- 仅在 Proton SDK 缺少机器可读字段时，保留少量基于 message 的 fallback 分类。

当前实现示例：

- Proton 认证 restore / refresh 失败会映射为 auth 或 network 错误码。
- Proton 远端文件系统操作会把 not-found、already-exists、conflict、write-failed、transient-incomplete 等情况映射为结构化错误。

### 6.2 同步引擎

职责：

- 基于结构化字段做重试、阻塞、auth pause、not-found / conflict 判定。
- 持久化任务级错误元数据。
- 输出任务级结构化日志。

当前行为：

- not-found、auth、冲突、重试耗尽、重试调度都已经由错误码驱动。
- 任务状态保存 `lastErrorCode`、`lastErrorRetryable`、`lastErrorAt`。
- 运行级状态保存 `lastErrorCode`、`lastErrorCategory`、`lastErrorRetryable`、`lastErrorAt`。

### 6.3 Runtime

职责：

- 在工作流入口统一归一化错误。
- 把同步错误和认证错误写入持久化状态。
- 展示翻译后的用户提示。

当前行为：

- `PluginRuntime` 会记录结构化同步失败。
- `SessionManager` 会记录结构化认证失败和 auth 日志，而不只是保留内存字符串。
- Network policy 基于归一化后的网络错误工作，而不是依赖原始 message。

### 6.4 UI

职责：

- 使用翻译后的用户文案。
- 在有诊断价值的地方显示错误码。
- 避免在常规 UI 中直接暴露原始堆栈或底层 SDK 细节。

当前行为：

- 状态页根据错误码渲染翻译后的消息。
- 命令、设置页、登录、预同步、远端根目录选择等流程都使用共享错误消息翻译辅助函数。
- auth paused 场景展示统一的认证提示，而不是原始 SDK 文本。

## 7. 持久化模型

结构化错误状态已经持久化到同步状态中，不再依赖自由文本字符串。

### 7.1 SyncState

当前字段：

```ts
type SyncState = {
	lastErrorAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorCategory?: ErrorCategory;
	lastErrorRetryable?: boolean;
	logs?: SyncLog[];
};
```

### 7.2 SyncJob

当前任务级字段：

```ts
type SyncJob = {
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

历史 `lastError: string` 数据没有兼容层。

## 8. 日志与诊断

### 8.1 日志

结构化同步日志可能包含：

- `message`
- `context`
- `code`
- `category`
- `retryable`
- `path`
- `jobId`
- `jobOp`
- `provider`
- `details`

约束：

- `message` 保持简短、稳定。
- 语义主要放在 `code` 和上下文字段里。
- 需要额外排障信息时放进 `details`。

### 8.2 诊断导出

诊断导出目前包含：

- 顶层同步错误摘要字段
- 最近的结构化错误日志
- 每个任务的错误摘要
- 运行时指标

当前脱敏规则：

- 远端 scope ID 和 cursor 做部分脱敏
- 账号邮箱脱敏
- 导出的路径脱敏
- 日志 message 和 job ID 中较长、像 token 的片段会被脱敏

诊断导出用于排障，但不会导出原始 secret 或完整远端标识。

## 9. 用户消息策略

系统区分三层消息。

### 9.1 用户可见文案

使用位置：

- Notice
- 状态页
- 设置页和登录流程

来源：

- `userMessageKey`
- `userMessageParams`
- 安全 fallback `userMessage`

### 9.2 诊断文案

使用位置：

- 结构化日志
- diagnostics 导出

来源：

- `code`
- `debugMessage`
- `details`

### 9.3 原始 cause

使用位置：

- 控制台 warning
- 开发调试

原始底层错误不应直接出现在普通用户 UI 中。

## 10. 当前边界

对于项目自有核心路径，这套系统已经建立完成；但仍有几个有意保留的边界：

- Proton SDK 底层内部仍然会抛原生 `Error`。
- Provider 适配层在 SDK 只能给原始字符串时，仍保留少量基于 message 的 fallback 分类。
- `severity` 字段已经存在，但目前还不是运行时分支判断的主要输入。

只要项目自有运行时决策继续统一消费归一化后的 `DriveSyncError`，这些边界就是可接受的。

## 11. 验证

这套错误系统已经有单元测试和行为测试覆盖，包括：

- 归一化与消息翻译
- `SessionManager` 的认证错误持久化
- 同步引擎的结构化重试和 auth block 行为
- Proton auth 与远端文件系统映射
- diagnostics 导出结构与脱敏

后续修改这套系统时，应保持这条链路不被破坏：

**原始失败 -> 归一化 `DriveSyncError` -> 运行时策略 -> 持久化摘要/日志 -> 翻译后的 UI 消息**
