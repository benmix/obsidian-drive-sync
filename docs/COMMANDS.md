# Commands

This document describes how commands are organized and what each command does.

## Structure

Command registration lives under `src/commands/` with a flat, per-command layout:

- `index.ts`: composition root. Builds context, registers the settings tab, and registers every command directly.
- `context.ts`: shared command context and remote connection guard.
- `command-*.ts`: one file per command registration function (`registerDriveSync*Command`).

## Shared Guarding

`createCommandContext()` provides:

- `requireScopeId()`: ensures remote scope is selected.
- `requireConnectedRemoteClient()`: ensures auth/session/connect is valid.
- `runRemoteCommand()`: wraps command callback with connection checks.

All commands that touch remote file system should run inside `runRemoteCommand()`.

## Command Catalog

### Session and UI

- `drive-sync-connect`: connect remote provider.
- `drive-sync-login`: open provider login modal.
- `drive-sync-logout`: logout and clear stored session.
- `drive-sync-review-conflicts`: open conflict review modal.
- `drive-sync-show-status`: open sync status modal.
- `drive-sync-open-settings`: open Obsidian settings and focus this plugin tab.

### Sync Flow

- `drive-sync-pre-sync-check`: estimate, then plan + execute from modal.
- `drive-sync-plan-sync`: plan jobs only.
- `drive-sync-poll-remote`: poll remote delta and enqueue jobs.
- `drive-sync-run-planned-sync`: execute queued jobs.
- `drive-sync-auto-sync-now`: trigger scheduler-driven auto sync once.
- `drive-sync-sync-vault`: upload local vault snapshot to remote.
- `drive-sync-restore-vault`: restore local vault snapshot from remote.

### Maintenance

- `drive-sync-validate-remote-ops`: run create/list/read/delete remote capability checks.
- `drive-sync-pause-auto-sync`: pause auto-sync scheduler.
- `drive-sync-resume-auto-sync`: resume auto-sync scheduler.
- `drive-sync-rebuild-index`: rebuild sync index from local/remote state.
- `drive-sync-export-diagnostics`: export runtime diagnostics bundle.
- `drive-sync-reset-connection`: disconnect current provider connection.

## Add New Command

1. Create a new file in `src/commands/` named `command-<id>.ts`.
2. Export one registration function (for example `registerDriveSyncFooCommand(context)`).
3. Reuse `CommandContext` helpers instead of duplicating scope/session checks.
4. Register the new command directly in `src/commands/index.ts`.
5. Keep command IDs stable once released and use concise `Notice` feedback.
