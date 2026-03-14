# Error System Design

Last updated: 2026-03-10

## 1. Purpose

The repository uses a structured error model so runtime policy, persisted state, diagnostics, and UI all talk about the same failure in the same language.

The core rule is:

**internal code works with structured errors; user-facing surfaces render only safe and translatable messages.**

This document describes the current design, not a future migration plan.

## 2. Goals

- use stable error codes instead of fragile `Error.message` matching in project-owned logic
- separate diagnostic detail from user-facing copy
- make retry, auth-pause, and blocked-job decisions code-driven
- persist structured error summaries in sync state and logs
- export diagnostics that are useful without exposing secrets

## 3. Non-Goals

- rewriting every native `Error` thrown inside third-party SDK internals
- introducing a deep exception-class hierarchy
- preserving legacy `lastError: string` compatibility in new state paths

## 4. Core Model

The shared error type is `DriveSyncError`.

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

Field meaning:

- `code`: stable semantic identity for runtime decisions
- `category`: coarse-grained failure grouping
- `severity`: importance level for logging and surfacing
- `retryable`: whether retry scheduling is allowed
- `userMessage`, `userMessageKey`, `userMessageParams`: safe user-facing message source
- `debugMessage` and `details`: diagnostic context
- `cause`: original lower-level failure when useful

## 5. Main Utilities

Shared helpers live in `src/errors/`.

Primary entry points:

- `createDriveSyncError(code, init)`
- `normalizeUnknownDriveSyncError(error, options?)`
- `translateDriveSyncErrorUserMessage(error, tr)`
- `toDriveSyncErrorSummary(error)`
- `formatDriveSyncErrorForLog(error)`
- `shouldPauseAuthForError(error)`
- `getRetryDelayForDriveSyncError(error, attempt)`

Important normalization rule:

- `normalizeUnknownDriveSyncError()` accepts raw values and existing `DriveSyncError` instances
- if a `DriveSyncError` is passed with overrides, the function returns a wrapped error with updated policy or user-facing fields
- higher layers can preserve the low-level code while changing workflow-specific UI copy

## 6. Ownership By Layer

### 6.1 Provider And SDK Adapters

Responsibilities:

- normalize third-party failures as early as practical
- attach provider context through structured `details`
- keep message-based fallback classification only where the SDK exposes raw strings and nothing else

Current examples:

- auth restore and refresh failures become auth or network codes
- remote filesystem operations become not-found, already-exists, conflict, write-failed, or transient-incomplete errors

### 6.2 Sync Engine

Responsibilities:

- decide retry, block, auth-pause, and not-found or conflict behavior from structured fields
- persist per-job error summaries
- emit structured task-level logs

Current persisted job and run state includes fields such as:

- `lastErrorCode`
- `lastErrorCategory`
- `lastErrorRetryable`
- `lastErrorAt`

### 6.3 Runtime

Responsibilities:

- normalize errors at workflow entrypoints
- record sync and auth failures into persisted state
- show translated, user-safe notices

Current behavior:

- `PluginRuntime` records structured sync failures
- `SessionManager` records structured auth failures and auth logs
- network policy consumes normalized network errors instead of raw strings

### 6.4 UI

Responsibilities:

- render translated user-facing messages
- show error codes where diagnostics value exists
- avoid exposing raw stacks or low-level SDK detail in normal UI

Current behavior:

- status UI renders messages derived from error codes
- login, settings, pre-sync, and remote-root flows use shared translation helpers
- auth-paused UI does not show raw SDK text

## 7. Persistence Model

Structured error state is persisted in sync state instead of free-form strings.

### 7.1 Sync State

Current fields include:

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

Current per-job fields include:

```ts
type SyncJob = {
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

The current design does not preserve a compatibility path for historical `lastError: string` values.

## 8. Logging And Diagnostics

### 8.1 Structured Logs

Structured sync logs may include:

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

Guidelines:

- keep `message` short and stable
- put semantics into `code` and structured fields
- use `details` for extra debugging context

### 8.2 Diagnostics Export

Diagnostics export may include:

- top-level sync error summaries
- recent structured error logs
- per-job error summaries
- runtime metrics

Current redaction rules include:

- partial redaction of remote scope IDs and cursors
- redaction of account email
- redaction of exported paths
- redaction of long token-like substrings in logs and job IDs

Diagnostics should help debugging without exporting raw secrets or full remote identifiers.

## 9. Message Levels

The system intentionally separates three message levels.

### 9.1 User-Facing Copy

Used by:

- notices
- status UI
- settings and login flows

Source:

- `userMessageKey`
- `userMessageParams`
- safe fallback `userMessage`

### 9.2 Diagnostic Copy

Used by:

- structured logs
- diagnostics export

Source:

- `code`
- `debugMessage`
- `details`

### 9.3 Raw Cause

Used by:

- console debugging
- developer investigation

Raw low-level failures should not appear directly in normal UI.

## 10. Current Boundaries

A few boundaries remain intentional:

- third-party SDK internals still throw native `Error` values
- provider adapters still rely on limited message-based fallback classification where the SDK exposes only raw text
- `severity` exists on the shared type but is not yet a major branching input for runtime policy

These limits are acceptable as long as project-owned decisions operate on normalized `DriveSyncError` values.

## 11. Verification

Coverage should preserve the full chain:

**raw failure -> normalized `DriveSyncError` -> runtime policy -> persisted summary and logs -> translated UI message**

When changing this system, verify at least:

- normalization and translation helpers
- auth error persistence in `SessionManager`
- sync-engine retry and auth-block behavior
- provider-side mapping of auth and remote filesystem failures
- diagnostics export structure and redaction
