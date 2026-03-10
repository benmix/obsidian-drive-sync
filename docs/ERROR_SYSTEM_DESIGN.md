# Error System

Last updated: 2026-03-10

## 1. Purpose

The project uses a shared structured error system so that runtime policy, UI copy, sync state, logs, and diagnostics all speak the same error language.

The core rule is simple:

**internal code paths operate on structured errors, while user-facing surfaces only render safe and translatable messages.**

This document describes the current implementation, not a migration proposal.

## 2. Goals

- Use stable error codes instead of brittle `Error.message` matching in project-owned logic.
- Separate internal diagnostics from user-visible copy.
- Keep retry, auth-pause, and blocked-job decisions code-driven.
- Persist structured error fields in sync state and logs.
- Export diagnostics with useful structure and basic redaction.

## 3. Non-Goals

- Rewriting every native `Error` thrown inside third-party Proton SDK internals.
- Introducing a deep exception class hierarchy.
- Preserving legacy `lastError: string` state compatibility.

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

Meaning of the main fields:

- `code`: stable semantic identity used by runtime policy.
- `category`: coarse-grained grouping such as auth, network, or sync.
- `retryable`: whether retry scheduling is allowed.
- `userMessage` and `userMessageKey`: safe user-facing message source.
- `debugMessage` and `details`: diagnostic-only context.
- `cause`: original lower-level error when useful.

## 5. Main Utilities

The shared helpers live under `src/errors/`.

Primary entry points:

- `createDriveSyncError(code, init)`
- `normalizeUnknownDriveSyncError(error, options?)`
- `translateDriveSyncErrorUserMessage(error, tr)`
- `toDriveSyncErrorSummary(error)`
- `formatDriveSyncErrorForLog(error)`
- `shouldPauseAuthForError(error)`
- `getRetryDelayForDriveSyncError(error, attempt)`

Important normalization rule:

- `normalizeUnknownDriveSyncError()` accepts both raw values and existing `DriveSyncError` instances.
- When an existing `DriveSyncError` is passed together with override options, the function returns a wrapped `DriveSyncError` with the overridden user-facing or policy fields.
- This allows higher layers to keep a stable low-level code while replacing UI copy for a specific command or workflow.

## 6. Layer Responsibilities

### 6.1 Provider and SDK adapters

Responsibilities:

- Convert third-party failures into `DriveSyncError` as early as practical.
- Attach provider context in `details` when useful.
- Keep limited message-based fallback classification only at the Proton SDK boundary where machine-readable fields are missing.

Current examples:

- Proton auth restore and refresh failures map to auth or network codes.
- Proton remote filesystem operations map not-found, already-exists, conflict, write-failed, and transient-incomplete cases into structured errors.

### 6.2 Sync engine

Responsibilities:

- Make retry, block, auth-pause, and not-found/conflict decisions from structured fields.
- Persist per-job error metadata.
- Emit structured logs for task-level events.

Current behavior:

- Not-found, auth, conflict, retry exhaustion, and retry scheduling are all code-driven.
- Job state stores `lastErrorCode`, `lastErrorRetryable`, and `lastErrorAt`.
- Run-level state stores `lastErrorCode`, `lastErrorCategory`, `lastErrorRetryable`, and `lastErrorAt`.

### 6.3 Runtime

Responsibilities:

- Normalize errors at workflow entry points.
- Record sync and auth failures into persisted state.
- Show translated user-facing notices.

Current behavior:

- `PluginRuntime` records structured sync failures.
- `SessionManager` records structured auth failures and auth logs, not only in-memory strings.
- Network policy uses normalized network failures instead of raw messages.

### 6.4 UI

Responsibilities:

- Use translated user-facing messages.
- Show error codes where diagnostics value exists.
- Avoid surfacing raw stacks or low-level SDK details in normal UI.

Current behavior:

- Status UI renders translated messages from error codes.
- Command, settings, login, pre-sync, and remote-root flows use shared error message translation helpers.
- Auth-paused UI shows a unified user-facing auth message, not raw SDK text.

## 7. Persistence Model

Structured error state is persisted in sync state rather than relying on free-form strings.

### 7.1 SyncState

Current fields:

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

Current per-job fields:

```ts
type SyncJob = {
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};
```

No compatibility layer is maintained for historical `lastError: string` data.

## 8. Logging And Diagnostics

### 8.1 Logs

Structured sync logs may contain:

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

- Keep `message` short and stable.
- Put semantics in `code` and context fields.
- Use `details` for extra debugging context when needed.

### 8.2 Diagnostics export

Diagnostics export includes:

- top-level sync error summary fields
- recent structured error logs
- per-job error summaries
- runtime metrics

Redaction rules currently applied:

- remote scope IDs and cursors are partially redacted
- account email is redacted
- exported paths are redacted
- long token-like substrings in log messages and job IDs are redacted

Diagnostics are intended for troubleshooting, but still avoid exporting raw secrets or full remote identifiers.

## 9. User Message Strategy

The system uses three message levels.

### 9.1 User-facing copy

Used by:

- notices
- status surfaces
- settings and login flows

Source:

- `userMessageKey`
- `userMessageParams`
- safe fallback `userMessage`

### 9.2 Diagnostic copy

Used by:

- structured logs
- diagnostics export

Source:

- `code`
- `debugMessage`
- `details`

### 9.3 Raw cause

Used by:

- console warnings
- developer debugging

Raw low-level errors should not be shown directly in normal user UI.

## 10. Current Boundaries

The system is fully established for project-owned core paths, but a few boundaries remain intentional:

- Low-level Proton SDK internals still throw native `Error` values.
- Provider adapters still keep limited message-based fallback classification when SDKs expose only raw strings.
- Error severity exists on the shared type but is not yet a major runtime branching input.

These boundaries are acceptable as long as project-owned runtime decisions continue to consume normalized `DriveSyncError` values.

## 11. Verification

The error system is covered by unit and behavior tests, including:

- normalization and message translation
- auth error persistence in `SessionManager`
- sync engine structured retry and auth-block behavior
- Proton auth and remote filesystem mapping
- diagnostics export structure and redaction

When updating this system, preserve the end-to-end chain:

**raw failure -> normalized `DriveSyncError` -> runtime policy -> persisted summary/logs -> translated UI message**
