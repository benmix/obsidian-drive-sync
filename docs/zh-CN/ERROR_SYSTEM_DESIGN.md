# 错误系统设计方案

## 1. 背景

当前项目里的错误处理已经覆盖了基础可用性，但存在几个明显问题：

- 以字符串为中心：大量逻辑依赖 `Error.message` 文本本身。
- 错误职责混杂：同一条 message 既承担内部诊断，也直接进入 UI。
- 缺少稳定错误码：重试、认证暂停、冲突分类、提示文案都难以长期稳定。
- 诊断信息不成体系：`lastError`、`job.lastError`、`logs` 里都是自由文本，后续分析成本高。

典型症状：

- `sync-engine.ts` 通过 `isAuthError(message)` / `isNotFoundError(message)` / `isPathConflictError(message)` 做字符串匹配。
- `session-manager.ts` 和 UI 直接展示底层 SDK 组合错误，容易出现重复、嵌套和不友好的文案。
- 命令、运行时、provider、SDK 各自 `throw new Error(...)`，但没有统一的上抛协议。

这个方案的目标不是一次性重写所有异常处理，而是建立一个可以渐进迁移的错误系统。

---

## 2. 设计目标

### 2.1 主要目标

- 为项目建立稳定、可扩展的错误码体系。
- 将“内部错误原因”和“用户可见提示”分离。
- 让运行时策略基于错误码而不是字符串匹配。
- 让状态页、Notice、诊断导出、日志输出都消费同一套结构化错误信息。
- 保证敏感信息不进入用户文案和持久化诊断。

### 2.2 非目标

- 不改造第三方 SDK 内部所有 `throw new Error(...)`。
- 不在第一阶段强制所有模块都立刻迁移。
- 不引入复杂的异常层级树或重度 OOP 设计。

---

## 3. 当前问题归纳

### 3.1 字符串驱动策略

当前有多处逻辑依赖 message：

- auth pause 判定
- not found 判定
- path conflict 判定
- blocked job 是否可自动恢复
- UI 是否展示原始错误

问题在于：

- 文案一变，行为就可能变。
- 同一语义在不同 provider/SDK 层可能有不同 message。
- 英文 message 混入中文 UI，体验不稳定。

### 3.2 用户文案与诊断文案耦合

同一个 `Error.message` 现在往往被同时用于：

- `Notice`
- 设置页/状态页展示
- `lastError`
- 控制台日志

这会导致：

- 用户看到技术细节太多。
- 日志又缺少结构化字段，不利于检索。
- “可展示”与“可定位”无法兼顾。

### 3.3 持久化状态结构过弱

当前状态只保留：

- `lastError?: string`
- `job.lastError?: string`

缺少这些关键维度：

- `code`
- `category`
- `retryable`
- `userMessageKey`
- `occurredAt`
- `details`

---

## 4. 总体设计

核心原则：**内部统一使用结构化错误对象，UI 只消费安全、稳定、可翻译的信息。**

建议新增统一错误类型：`DriveSyncError`。

```ts
type ErrorCategory =
	| "auth"
	| "network"
	| "local_fs"
	| "remote_fs"
	| "sync"
	| "config"
	| "validation"
	| "provider"
	| "internal";

type ErrorSeverity = "info" | "warn" | "error" | "fatal";

type DriveSyncErrorCode =
	| "AUTH_SESSION_EXPIRED"
	| "AUTH_REAUTH_REQUIRED"
	| "AUTH_INVALID_CREDENTIALS"
	| "NETWORK_OFFLINE"
	| "NETWORK_TIMEOUT"
	| "REMOTE_NOT_FOUND"
	| "REMOTE_ALREADY_EXISTS"
	| "REMOTE_PATH_CONFLICT"
	| "REMOTE_UNSUPPORTED"
	| "LOCAL_NOT_FOUND"
	| "LOCAL_PERMISSION_DENIED"
	| "SYNC_CONFLICT"
	| "SYNC_JOB_INVALID"
	| "SYNC_RETRY_EXHAUSTED"
	| "CONFIG_SCOPE_MISSING"
	| "CONFIG_PROVIDER_MISSING"
	| "VALIDATION_REMOTE_SCOPE_INVALID"
	| "INTERNAL_UNEXPECTED";

type DriveSyncErrorOptions = {
	category: ErrorCategory;
	severity?: ErrorSeverity;
	retryable?: boolean;
	userMessageKey?: string;
	userMessageParams?: Record<string, string | number | boolean>;
	debugMessage?: string;
	details?: Record<string, unknown>;
	cause?: unknown;
};

class DriveSyncError extends Error {
	readonly code: DriveSyncErrorCode;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly retryable: boolean;
	readonly userMessageKey?: string;
	readonly userMessageParams?: Record<string, string | number | boolean>;
	readonly debugMessage?: string;
	readonly details?: Record<string, unknown>;
	override readonly cause?: unknown;
}
```

这个对象要同时满足三类消费方：

- 运行时策略：读取 `code/category/retryable/severity`
- UI：读取 `userMessageKey/userMessageParams`
- 诊断/日志：读取 `code/debugMessage/details/cause`

---

## 5. 错误码体系

### 5.1 命名原则

- 全大写 snake case。
- 前缀代表域，后缀代表具体语义。
- 只表达稳定语义，不表达瞬时文案。

建议按域分组：

- `AUTH_*`
- `NETWORK_*`
- `LOCAL_*`
- `REMOTE_*`
- `SYNC_*`
- `CONFIG_*`
- `VALIDATION_*`
- `INTERNAL_*`

### 5.2 错误码示例

#### 认证类

- `AUTH_SESSION_EXPIRED`
- `AUTH_REAUTH_REQUIRED`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_2FA_REQUIRED`
- `AUTH_MAILBOX_PASSWORD_REQUIRED`
- `AUTH_REFRESH_FAILED`

#### 网络类

- `NETWORK_OFFLINE`
- `NETWORK_TIMEOUT`
- `NETWORK_RATE_LIMITED`
- `NETWORK_TEMPORARY_FAILURE`

#### 本地文件系统类

- `LOCAL_NOT_FOUND`
- `LOCAL_READ_FAILED`
- `LOCAL_WRITE_FAILED`
- `LOCAL_MOVE_FAILED`
- `LOCAL_PERMISSION_DENIED`

#### 远端文件系统类

- `REMOTE_NOT_FOUND`
- `REMOTE_ALREADY_EXISTS`
- `REMOTE_PATH_CONFLICT`
- `REMOTE_READ_FAILED`
- `REMOTE_WRITE_FAILED`
- `REMOTE_DELETE_FAILED`
- `REMOTE_MOVE_FAILED`
- `REMOTE_UNSUPPORTED`

#### 同步内核类

- `SYNC_CONFLICT`
- `SYNC_JOB_INVALID`
- `SYNC_STATE_CORRUPTED`
- `SYNC_RETRY_EXHAUSTED`
- `SYNC_PRECONDITION_FAILED`

#### 配置 / 校验类

- `CONFIG_SCOPE_MISSING`
- `CONFIG_PROVIDER_MISSING`
- `VALIDATION_REMOTE_SCOPE_INVALID`
- `VALIDATION_REMOTE_ROOT_UNAVAILABLE`

#### 内部错误

- `INTERNAL_INVARIANT_BROKEN`
- `INTERNAL_UNEXPECTED`

---

## 6. 分层职责

### 6.1 Provider / SDK 适配层

职责：

- 将第三方异常尽早映射为 `DriveSyncError`
- 尽量附带 provider 上下文
- 不把 SDK 原始 message 直接暴露给 UI

示例：

- Proton SDK 抛出 `INVALID_REFRESH_TOKEN`
    - 映射成 `AUTH_SESSION_EXPIRED`
- 创建远端文件遇到“already exists”
    - 映射成 `REMOTE_ALREADY_EXISTS`

### 6.2 Sync Kernel

职责：

- 只依赖错误码做决策
- 不再通过 message 文本判断 auth / not found / conflict

替换方向：

- `isAuthError(message)` -> `error.code/category === ...`
- `isNotFoundError(message)` -> `error.code === "REMOTE_NOT_FOUND" || "LOCAL_NOT_FOUND"`
- `isPathConflictError(message)` -> `error.code === "REMOTE_PATH_CONFLICT" || "REMOTE_ALREADY_EXISTS"`

### 6.3 Runtime

职责：

- 决定是否进入 `authPaused`
- 决定是否 `recordSyncError`
- 决定是否给 `Notice`

规则要基于结构化字段：

- `category === "auth"` -> 可进入 auth pause
- `retryable === true` -> 可进入重试队列
- `severity === "fatal"` -> 可触发更强提示或阻塞

### 6.4 UI

职责：

- 使用 `userMessageKey` 渲染文案
- 如果缺失，使用安全 fallback
- 诊断页可以显示 `code`
- 普通状态页不显示底层栈和非安全细节

---

## 7. 用户文案策略

建议把用户展示拆成三层：

### 7.1 用户主文案

用于：

- `Notice`
- 状态页
- 设置页

来源：

- `userMessageKey`
- `userMessageParams`

示例：

- `AUTH_SESSION_EXPIRED` -> `error.auth.sessionExpired`
- `REMOTE_ALREADY_EXISTS` -> `error.remote.alreadyExists`

### 7.2 诊断文案

用于：

- 诊断导出
- 状态页高级详情

来源：

- `code`
- `debugMessage`
- `details`

### 7.3 原始 cause

用于：

- 控制台
- 开发调试

不直接进入：

- 用户 Notice
- 普通设置文案

---

## 8. 状态持久化设计

### 8.1 建议新增错误摘要对象

替代当前裸字符串。

```ts
type ErrorSummary = {
	code: DriveSyncErrorCode;
	category: ErrorCategory;
	message: string;
	retryable?: boolean;
	at: number;
	details?: Record<string, unknown>;
};
```

### 8.2 SyncState 迁移建议

第一阶段建议兼容现有结构，新增字段而不是立刻删除旧字段：

```ts
type SyncState = {
	lastError?: string;
	lastErrorAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorCategory?: ErrorCategory;
	lastErrorRetryable?: boolean;
};
```

第二阶段再收敛为：

```ts
type SyncState = {
	lastError?: ErrorSummary;
};
```

理由：

- 兼容旧数据迁移简单
- UI 改造成本低
- 不需要一次性修改全部读写路径

### 8.3 Job 错误结构

`SyncJob` 也建议补结构化字段：

```ts
type SyncJob = {
	lastError?: string;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

这样状态页可以直接显示：

- 错误码
- 最近错误时间
- 是否还会自动重试

---

## 9. 标准工具函数

建议新增 `src/errors/` 模块，至少包含：

### 9.1 `createError`

创建结构化错误。

### 9.2 `normalizeUnknownError`

把 `unknown` / SDK 错误 / 原生 `Error` 转成 `DriveSyncError`。

### 9.3 `wrapError`

给已有错误补充域、code、details。

### 9.4 `toUserMessage`

把错误转成 i18n key + params 或 fallback 文案。

### 9.5 `toErrorSummary`

把错误压缩成持久化对象。

### 9.6 `isRetryableError`

统一重试策略入口。

### 9.7 `shouldPauseAuth`

统一 auth pause 判定入口。

---

## 10. 日志与诊断

### 10.1 日志记录建议

日志记录时统一输出：

- `code`
- `category`
- `severity`
- `retryable`
- `path`
- `job.op`
- `provider`

日志 message 应该短而稳定，例如：

- `Job failed`
- `Auth paused`
- `Remote write rejected`

上下文放入结构化 payload，不把全部信息揉进一句字符串。

### 10.2 诊断导出建议

导出内容中加入：

- `lastErrorCode`
- `lastErrorCategory`
- `recentErrors[]`
- `jobs[].lastErrorCode`

同时继续保留脱敏策略：

- 不导出 token
- 不导出完整 provider ID / cursor / credential
- 不导出未经处理的 raw stack

---

## 11. 迁移路线

建议分四阶段推进。

### 阶段 1：打基础

- 新增 `DriveSyncError`
- 新增 `src/errors/*`
- 新增错误码枚举与 i18n key
- 保持现有 `lastError: string` 兼容

### 阶段 2：优先改造高价值路径

优先改造这些入口：

- `runtime/session-manager.ts`
- `runtime/plugin-runtime.ts`
- `sync/engine/sync-engine.ts`
- `provider/providers/proton-drive/remote-file-system.ts`
- `provider/providers/proton-drive/sdk/auth.ts`

因为这些地方直接影响：

- auth pause
- retry
- UI 错误展示
- 同步执行稳定性

### 阶段 3：改造状态和 UI

- `SyncState` 增加结构化错误字段
- `SyncJob` 增加结构化错误字段
- 状态页、设置页、Notice 走统一 `toUserMessage`

### 阶段 4：清理旧逻辑

- 删除 message-based 分类函数
- 删除零散 `normalizeAuthErrorMessage` 之类局部修补
- 收敛所有核心路径到统一错误系统

---

## 12. 推荐优先级

### P0

- 认证/会话错误
- 远端 not found / already exists / path conflict
- 网络 timeout / rate limit / temporary failure

### P1

- 本地文件系统错误
- 配置缺失 / 远端 scope 校验错误
- 同步任务非法状态

### P2

- 低频内部错误
- 诊断导出历史错误聚合

---

## 13. 测试策略

### 13.1 单元测试

- `normalizeUnknownError`
- `wrapError`
- `shouldPauseAuth`
- `isRetryableError`
- `toUserMessage`

### 13.2 行为测试

- 认证过期 -> 进入 auth pause -> UI 显示统一文案
- 远端路径冲突 -> job blocked -> 状态页显示错误码
- 网络超时 -> job retry -> 不进入 auth pause

### 13.3 回归测试

- 确保老状态数据仍可读取
- 确保旧版 `lastError` 不会导致崩溃

---

## 14. 方案总结

这个错误系统的核心不是“把所有 `throw new Error` 换个写法”，而是建立一条稳定链路：

**底层异常 -> 结构化错误 -> 运行时策略 -> 用户文案 -> 诊断信息**

如果这条链路建立起来，项目后续会明显受益：

- auth / retry / blocked 逻辑更稳定
- UI 文案更可控
- 诊断导出更有分析价值
- 新 provider 接入时更容易复用

---

## 15. 建议的下一步实现顺序

1. 新增 `src/errors/` 基础模块和错误码定义。
2. 先改 `session-manager`、`plugin-runtime`、`sync-engine` 三个核心入口。
3. 再改 Proton provider 的异常映射。
4. 最后升级 `SyncState` / `SyncJob` 持久化结构和状态 UI。
