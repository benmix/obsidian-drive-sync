# Error System Design

## 1. Background

The project already has enough error handling to be usable, but the current error flow still has several obvious problems:

- It is string-centric: a large amount of logic depends directly on `Error.message` text.
- Error responsibilities are mixed together: the same message is used for internal diagnostics and shown directly in UI.
- There are no stable error codes: retry logic, auth pause, conflict classification, and user messages are all harder to keep stable over time.
- Diagnostic data is unstructured: `lastError`, `job.lastError`, and log entries are free-form text, which makes later analysis expensive.

Typical symptoms:

- `sync-engine.ts` uses `isAuthError(message)` / `isNotFoundError(message)` / `isPathConflictError(message)` for string matching.
- `session-manager.ts` and UI surfaces show combined raw SDK errors directly, which easily leads to duplicated, nested, or unfriendly copy.
- Commands, runtime, providers, and SDK layers all `throw new Error(...)` independently, but there is no common propagation contract.

The goal of this design is not to rewrite all exception handling in one pass. The goal is to establish an error system that supports gradual migration.

---

## 2. Design Goals

### 2.1 Primary goals

- Establish a stable, extensible error-code system for the project.
- Separate internal failure reasons from user-visible messages.
- Let runtime strategy depend on error codes instead of string matching.
- Let the status page, notices, diagnostic exports, and logs all consume the same structured error information.
- Keep sensitive information out of user-facing messages and persisted diagnostics.

### 2.2 Non-goals

- Do not rewrite every `throw new Error(...)` inside third-party SDKs.
- Do not force every module to migrate immediately in the first phase.
- Do not introduce a deep exception class hierarchy or heavy OOP design.

---

## 3. Current Problems

### 3.1 String-driven strategy

Several parts of the current codebase rely on message text:

- auth pause decisions
- not-found detection
- path-conflict detection
- whether blocked jobs can recover automatically
- whether UI should display raw error text

Problems with that approach:

- If the wording changes, behavior can change accidentally.
- The same semantic failure can have different messages in different provider or SDK layers.
- English SDK messages end up leaking into Chinese UI.

### 3.2 User copy and diagnostic copy are coupled

A single `Error.message` is often reused for:

- `Notice`
- settings page or status page UI
- `lastError`
- console logging

That leads to several issues:

- End users see too many technical details.
- Logs still lack structured fields, so they remain hard to query.
- It is difficult to balance “safe to show” and “useful to debug.”

### 3.3 Persisted error state is too weak

Current state only stores:

- `lastError?: string`
- `job.lastError?: string`

It is missing key dimensions such as:

- `code`
- `category`
- `retryable`
- `userMessageKey`
- `occurredAt`
- `details`

---

## 4. Overall Design

Core principle: **the system should use structured errors internally, while UI only consumes safe, stable, translatable information.**

Introduce a shared error type: `DriveSyncError`.

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
	readonly cause?: unknown;
}
```

This object needs to serve three consumers at once:

- Runtime policy: reads `code`, `category`, `retryable`, `severity`
- UI: reads `userMessageKey`, `userMessageParams`
- Diagnostics and logs: reads `code`, `debugMessage`, `details`, `cause`

---

## 5. Error Code System

### 5.1 Naming principles

- Use uppercase snake case.
- Use a prefix for the domain and a suffix for the concrete semantic meaning.
- Encode stable semantics, not transient wording.

Recommended groups:

- `AUTH_*`
- `NETWORK_*`
- `LOCAL_*`
- `REMOTE_*`
- `SYNC_*`
- `CONFIG_*`
- `VALIDATION_*`
- `INTERNAL_*`

### 5.2 Example error codes

#### Auth

- `AUTH_SESSION_EXPIRED`
- `AUTH_REAUTH_REQUIRED`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_2FA_REQUIRED`
- `AUTH_MAILBOX_PASSWORD_REQUIRED`
- `AUTH_REFRESH_FAILED`

#### Network

- `NETWORK_OFFLINE`
- `NETWORK_TIMEOUT`
- `NETWORK_RATE_LIMITED`
- `NETWORK_TEMPORARY_FAILURE`

#### Local filesystem

- `LOCAL_NOT_FOUND`
- `LOCAL_READ_FAILED`
- `LOCAL_WRITE_FAILED`
- `LOCAL_MOVE_FAILED`
- `LOCAL_PERMISSION_DENIED`

#### Remote filesystem

- `REMOTE_NOT_FOUND`
- `REMOTE_ALREADY_EXISTS`
- `REMOTE_PATH_CONFLICT`
- `REMOTE_READ_FAILED`
- `REMOTE_WRITE_FAILED`
- `REMOTE_DELETE_FAILED`
- `REMOTE_MOVE_FAILED`
- `REMOTE_UNSUPPORTED`

#### Sync kernel

- `SYNC_CONFLICT`
- `SYNC_JOB_INVALID`
- `SYNC_STATE_CORRUPTED`
- `SYNC_RETRY_EXHAUSTED`
- `SYNC_PRECONDITION_FAILED`

#### Config and validation

- `CONFIG_SCOPE_MISSING`
- `CONFIG_PROVIDER_MISSING`
- `VALIDATION_REMOTE_SCOPE_INVALID`
- `VALIDATION_REMOTE_ROOT_UNAVAILABLE`

#### Internal

- `INTERNAL_INVARIANT_BROKEN`
- `INTERNAL_UNEXPECTED`

---

## 6. Layer Responsibilities

### 6.1 Provider / SDK adapter layer

Responsibilities:

- Map third-party exceptions into `DriveSyncError` as early as possible.
- Attach provider context where useful.
- Do not expose raw SDK messages directly to UI.

Examples:

- Proton SDK throws `INVALID_REFRESH_TOKEN`
    - Map it to `AUTH_SESSION_EXPIRED`
- Creating a remote file hits an “already exists” response
    - Map it to `REMOTE_ALREADY_EXISTS`

### 6.2 Sync kernel

Responsibilities:

- Make decisions based only on codes.
- Stop using message text to detect auth, not-found, or conflict failures.

Replacement direction:

- `isAuthError(message)` -> `error.code/category === ...`
- `isNotFoundError(message)` -> `error.code === "REMOTE_NOT_FOUND" || "LOCAL_NOT_FOUND"`
- `isPathConflictError(message)` -> `error.code === "REMOTE_PATH_CONFLICT" || "REMOTE_ALREADY_EXISTS"`

### 6.3 Runtime

Responsibilities:

- Decide whether to enter `authPaused`
- Decide whether to `recordSyncError`
- Decide whether to show a `Notice`

Rules should be based on structured fields:

- `category === "auth"` -> may enter auth pause
- `retryable === true` -> may enter retry queue
- `severity === "fatal"` -> may trigger stronger user-facing warning or blocking

### 6.4 UI

Responsibilities:

- Render copy via `userMessageKey`
- Use a safe fallback when it is missing
- Allow diagnostics pages to show `code`
- Keep low-level stacks and unsafe details out of normal status surfaces

---

## 7. User Message Strategy

Recommendation: split user-facing presentation into three levels.

### 7.1 Primary user message

Used by:

- `Notice`
- status page
- settings page

Source:

- `userMessageKey`
- `userMessageParams`

Examples:

- `AUTH_SESSION_EXPIRED` -> `error.auth.sessionExpired`
- `REMOTE_ALREADY_EXISTS` -> `error.remote.alreadyExists`

### 7.2 Diagnostic message

Used by:

- diagnostic export
- advanced status details

Source:

- `code`
- `debugMessage`
- `details`

### 7.3 Raw cause

Used by:

- console logs
- developer debugging

Should not be shown directly in:

- user notices
- normal settings copy

---

## 8. Persisted State Design

### 8.1 Recommended error summary object

This should replace bare strings over time.

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

### 8.2 `SyncState` migration plan

In the first phase, keep compatibility with existing data and add fields instead of deleting old ones immediately:

```ts
type SyncState = {
	lastError?: string;
	lastErrorAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorCategory?: ErrorCategory;
	lastErrorRetryable?: boolean;
};
```

In the second phase, converge toward:

```ts
type SyncState = {
	lastError?: ErrorSummary;
};
```

Reasons:

- old data remains easy to migrate
- UI migration cost stays low
- not every read/write path needs to change in one pass

### 8.3 Job error shape

`SyncJob` should also gain structured fields:

```ts
type SyncJob = {
	lastError?: string;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

That allows the status UI to show directly:

- error code
- most recent error time
- whether the job will retry automatically

---

## 9. Standard Utility Functions

Add a dedicated `src/errors/` module with at least:

### 9.1 `createError`

Creates structured errors.

### 9.2 `normalizeUnknownError`

Converts `unknown`, SDK errors, or native `Error` objects into `DriveSyncError`.

### 9.3 `wrapError`

Adds domain, code, and details to an existing error.

### 9.4 `toUserMessage`

Converts an error into an i18n key plus params, or a safe fallback message.

### 9.5 `toErrorSummary`

Compresses an error into a persisted summary object.

### 9.6 `isRetryableError`

Single entrypoint for retry policy.

### 9.7 `shouldPauseAuth`

Single entrypoint for auth-pause decisions.

---

## 10. Logging And Diagnostics

### 10.1 Logging guidance

Logs should output a stable set of fields:

- `code`
- `category`
- `severity`
- `retryable`
- `path`
- `job.op`
- `provider`

Log messages themselves should stay short and stable, for example:

- `Job failed`
- `Auth paused`
- `Remote write rejected`

Put detailed context into structured payload fields instead of cramming everything into one sentence.

### 10.2 Diagnostic export guidance

Diagnostic exports should include:

- `lastErrorCode`
- `lastErrorCategory`
- `recentErrors[]`
- `jobs[].lastErrorCode`

At the same time, keep redaction rules in place:

- do not export tokens
- do not export full provider IDs, cursors, or credentials
- do not export unprocessed raw stacks

---

## 11. Migration Plan

Use a four-phase rollout.

### Phase 1: Foundation

- Add `DriveSyncError`
- Add `src/errors/*`
- Add error-code enums and i18n keys
- Keep compatibility with existing `lastError: string`

### Phase 2: High-value paths first

Prioritize these entry points:

- `runtime/session-manager.ts`
- `runtime/plugin-runtime.ts`
- `sync/engine/sync-engine.ts`
- `provider/providers/proton-drive/remote-file-system.ts`
- `provider/providers/proton-drive/sdk/auth.ts`

These paths directly affect:

- auth pause
- retry behavior
- UI error display
- sync execution stability

### Phase 3: State and UI

- Add structured error fields to `SyncState`
- Add structured error fields to `SyncJob`
- Make status page, settings page, and `Notice` use the shared `toUserMessage`

### Phase 4: Cleanup

- Remove message-based classification helpers
- Remove local patches such as `normalizeAuthErrorMessage`
- Converge all core paths onto the shared error system

---

## 12. Recommended Priority

### P0

- auth and session failures
- remote not found / already exists / path conflict
- network timeout / rate limit / temporary failure

### P1

- local filesystem failures
- missing configuration / remote scope validation failures
- invalid sync job states

### P2

- low-frequency internal errors
- historical diagnostic aggregation

---

## 13. Test Strategy

### 13.1 Unit tests

- `normalizeUnknownError`
- `wrapError`
- `shouldPauseAuth`
- `isRetryableError`
- `toUserMessage`

### 13.2 Behavior tests

- session expiry -> auth pause -> UI shows unified copy
- remote path conflict -> job blocked -> status page shows error code
- network timeout -> job retry -> auth pause is not entered

### 13.3 Regression tests

- verify old persisted state can still be read
- verify legacy `lastError` values do not cause crashes

---

## 14. Summary

The core of this design is not “rewrite every `throw new Error` with a different syntax.”

The real goal is to establish a stable chain:

**low-level exception -> structured error -> runtime policy -> user message -> diagnostic information**

Once that chain exists, the project benefits in several clear ways:

- auth, retry, and blocked-job logic become more stable
- UI copy becomes more controllable
- diagnostic exports become more useful
- new providers become easier to integrate consistently

---

## 15. Recommended Next Implementation Order

1. Add the `src/errors/` foundation module and error-code definitions.
2. Migrate the three core entry points first: `session-manager`, `plugin-runtime`, and `sync-engine`.
3. Then migrate Proton provider error mapping.
4. Finally upgrade `SyncState` / `SyncJob` persistence and status UI.
