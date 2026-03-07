# Commands

This document describes how commands are organized and what each command does.

## Structure

Command registration is split by domain under `src/commands/`:

- `index.ts`: composition root. Builds context and registers all command groups.
- `context.ts`: shared command context and remote connection guard.
- `ui-session-commands.ts`: login/logout/session and UI modal commands.
- `sync-commands.ts`: sync planning, polling, execution, and vault copy commands.
- `maintenance-commands.ts`: validation, diagnostics, index rebuild, and runtime toggles.

## Shared Guarding

`createCommandContext()` provides:

- `requireScopeId()`: ensures remote scope is selected.
- `requireConnectedRemoteClient()`: ensures auth/session/connect is valid.
- `runRemoteCommand()`: wraps command callback with connection checks.

All commands that touch remote file system should run inside `runRemoteCommand()`.

## Command Catalog

### Session and UI (`ui-session-commands.ts`)

- `drive-sync-connect`: connect remote provider.
- `drive-sync-login`: open provider login modal.
- `drive-sync-logout`: logout and clear stored session.
- `drive-sync-review-conflicts`: open conflict review modal.
- `drive-sync-show-status`: open sync status modal.

### Sync Flow (`sync-commands.ts`)

- `drive-sync-pre-sync-check`: estimate, then plan + execute from modal.
- `drive-sync-plan-sync`: plan jobs only.
- `drive-sync-poll-remote`: poll remote delta and enqueue jobs.
- `drive-sync-run-planned-sync`: execute queued jobs.
- `drive-sync-auto-sync-now`: trigger scheduler-driven auto sync once.
- `drive-sync-sync-vault`: upload local vault snapshot to remote.
- `drive-sync-restore-vault`: restore local vault snapshot from remote.

### Maintenance (`maintenance-commands.ts`)

- `drive-sync-validate-remote-ops`: run create/list/read/delete remote capability checks.
- `drive-sync-pause-auto-sync`: pause auto-sync scheduler.
- `drive-sync-resume-auto-sync`: resume auto-sync scheduler.
- `drive-sync-rebuild-index`: rebuild sync index from local/remote state.
- `drive-sync-export-diagnostics`: export runtime diagnostics bundle.
- `drive-sync-reset-connection`: disconnect current provider connection.

## Add New Command

1. Choose the target module by domain (`ui-session`, `sync`, `maintenance`).
2. Reuse `CommandContext` helpers instead of duplicating scope/session checks.
3. Keep command IDs stable once released.
4. Use concise `Notice` feedback and log detailed errors to console.
5. If command becomes a new domain, add a new `*-commands.ts` file and register it from `index.ts`.
