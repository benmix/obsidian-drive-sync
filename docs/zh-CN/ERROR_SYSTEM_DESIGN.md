# 错误系统设计

最近更新：2026-03-10

## 1. 目的

仓库使用结构化错误模型，让运行时策略、持久化状态、诊断信息和 UI 都能用同一种语言描述同一个失败。

核心规则是：

**内部代码处理结构化错误；用户可见界面只渲染安全且可翻译的消息。**

这份文档描述的是当前设计，不是未来迁移方案。

## 2. 目标

- 在项目自有逻辑中使用稳定错误码，而不是脆弱的 `Error.message` 匹配
- 分离诊断细节和用户可见文案
- 让重试、认证暂停和任务阻塞决策基于代码字段，而不是字符串
- 在同步状态和日志中持久化结构化错误摘要
- 导出有用但不泄露秘密的诊断信息

## 3. 非目标

- 重写第三方 SDK 内部抛出的每一个原生 `Error`
- 引入很深的异常类继承层次
- 在新状态路径里继续保留旧版 `lastError: string` 兼容逻辑

## 4. 核心模型

共享错误类型为 `DriveSyncError`。

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

字段含义：

- `code`：供运行时决策使用的稳定语义标识
- `category`：粗粒度错误分类
- `severity`：日志和展示的重要性等级
- `retryable`：是否允许进入重试调度
- `userMessage`、`userMessageKey`、`userMessageParams`：安全的用户可见消息来源
- `debugMessage` 与 `details`：诊断上下文
- `cause`：必要时保留的底层原始错误

## 5. 主要工具函数

共享辅助函数位于 `src/errors/`。

主要入口：

- `createDriveSyncError(code, init)`
- `normalizeUnknownDriveSyncError(error, options?)`
- `translateDriveSyncErrorUserMessage(error, tr)`
- `toDriveSyncErrorSummary(error)`
- `formatDriveSyncErrorForLog(error)`
- `shouldPauseAuthForError(error)`
- `getRetryDelayForDriveSyncError(error, attempt)`

重要规范化规则：

- `normalizeUnknownDriveSyncError()` 同时接受原始值和已有的 `DriveSyncError`
- 如果传入的是 `DriveSyncError` 且带了 override，该函数会返回一个包裹后的新错误，覆盖策略字段或用户文案字段
- 这样上层流程可以保留底层错误码，同时替换某个命令或工作流专用的提示文案

## 6. 各层职责

### 6.1 Provider 与 SDK 适配层

职责：

- 尽早把第三方失败规范化为结构化错误
- 通过 `details` 追加 provider 上下文
- 只有在 SDK 只暴露原始字符串时，才保留有限的消息文本兜底分类

当前例子：

- 认证恢复或刷新失败会映射成 auth 或 network 错误码
- 远端文件系统操作会映射成 not-found、already-exists、conflict、write-failed 等结构化错误

### 6.2 Sync 引擎

职责：

- 基于结构化字段决定重试、阻塞、认证暂停和 not-found 或 conflict 行为
- 持久化每个任务的错误摘要
- 输出结构化任务日志

当前持久化字段示例：

- `lastErrorCode`
- `lastErrorCategory`
- `lastErrorRetryable`
- `lastErrorAt`

### 6.3 Runtime

职责：

- 在工作流入口统一规范化错误
- 将同步和认证失败写入持久化状态
- 对用户展示已翻译且安全的提示

当前行为：

- `PluginRuntime` 会记录结构化同步失败
- `SessionManager` 会记录结构化认证失败和 auth 日志
- 网络策略消费的是规范化后的 network 错误，而不是原始字符串

### 6.4 UI

职责：

- 渲染翻译后的用户消息
- 在需要诊断价值时显示错误码
- 不在常规 UI 中直接暴露堆栈和底层 SDK 细节

当前行为：

- 状态 UI 根据错误码渲染消息
- 登录、设置、预同步和远端根目录流程复用统一翻译辅助函数
- auth pause 界面不会直接显示 SDK 原始文本

## 7. 持久化模型

结构化错误状态会写入同步状态，而不是依赖自由文本字符串。

### 7.1 Sync State

当前字段包括：

```ts
type SyncState = {
	lastErrorAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorCategory?: ErrorCategory;
	lastErrorRetryable?: boolean;
	logs?: SyncLog[];
};
```

### 7.2 Sync Job

当前每个任务的字段包括：

```ts
type SyncJob = {
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

当前设计不再为历史 `lastError: string` 值保留兼容路径。

## 8. 日志与诊断

### 8.1 结构化日志

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

约定：

- `message` 保持简短且稳定
- 语义尽量放进 `code` 和结构化字段里
- `details` 用于补充调试上下文

### 8.2 诊断导出

诊断导出可能包含：

- 顶层同步错误摘要
- 最近的结构化错误日志
- 每个任务的错误摘要
- 运行时指标

当前脱敏规则包括：

- 远端 scope ID 和 cursor 部分脱敏
- 账号邮箱脱敏
- 导出路径脱敏
- 日志和任务 ID 中疑似 token 的长字符串脱敏

诊断信息应帮助排障，但不应导出原始密钥或完整远端标识。

## 9. 消息层级

系统刻意区分三种消息层级。

### 9.1 用户可见文案

使用场景：

- notice 提示
- 状态 UI
- 设置页和登录流程

来源：

- `userMessageKey`
- `userMessageParams`
- 安全兜底 `userMessage`

### 9.2 诊断文案

使用场景：

- 结构化日志
- 诊断导出

来源：

- `code`
- `debugMessage`
- `details`

### 9.3 原始 cause

使用场景：

- 控制台调试
- 开发者调查问题

底层原始错误不应直接出现在普通用户 UI 中。

## 10. 当前边界

当前仍保留少量有意为之的边界：

- 第三方 SDK 内部仍会抛原生 `Error`
- 当 SDK 只暴露原始文本时，provider 适配层仍保留有限的消息文本兜底分类
- 共享类型上虽然有 `severity` 字段，但它还不是运行时策略的主要分支条件

只要项目自有路径上的决策继续消费规范化后的 `DriveSyncError`，这些边界就是可以接受的。

## 11. 验证

这个系统必须保留完整链路：

**raw failure -> normalized `DriveSyncError` -> runtime policy -> persisted summary and logs -> translated UI message**

修改该系统时，至少验证：

- 规范化与翻译辅助函数
- `SessionManager` 中的 auth 错误持久化
- sync engine 的重试和 auth block 行为
- provider 侧对认证和远端文件系统失败的映射
- 诊断导出结构与脱敏效果
