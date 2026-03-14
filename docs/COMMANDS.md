# Commands

This document describes how command registration is structured and what each command is responsible for.

## Structure

Command registration lives in `src/commands/` with a flat layout:

- `index.ts`: composition root; builds context, registers the settings tab, and registers every command
- `context.ts`: shared command context plus remote-connection guards
- `command-*.ts`: one command registration function per file

This layout is deliberate. It keeps command entrypoints easy to find and avoids hiding user actions inside large registry files.

## Shared Guarding

`createCommandContext()` provides the common guards used by command handlers:

- `requireScopeId()`: ensures a remote scope is selected
- `requireConnectedRemoteClient()`: ensures auth and connection state are usable
- `runRemoteCommand()`: wraps a command callback with connection checks and shared error handling

Commands that touch the remote filesystem should run inside `runRemoteCommand()` instead of reimplementing the guard path.

## Command Catalog

### Session And UI

- `drive-sync-connect`: connect the current remote provider
- `drive-sync-login`: open the provider login flow
- `drive-sync-logout`: sign out and clear the stored session
- `drive-sync-review-conflicts`: open the conflict review modal
- `drive-sync-show-status`: open the sync status modal
- `drive-sync-open-settings`: open Obsidian settings and focus this plugin tab

### Sync Flow

- `drive-sync-pre-sync-check`: estimate sync work, then plan and execute from a confirmation modal
- `drive-sync-plan-sync`: plan jobs without running them
- `drive-sync-poll-remote`: fetch remote delta and enqueue jobs
- `drive-sync-run-planned-sync`: execute queued jobs
- `drive-sync-auto-sync-now`: trigger one scheduler-driven auto-sync run
- `drive-sync-sync-vault`: push the local vault snapshot to the remote root
- `drive-sync-restore-vault`: restore the local vault snapshot from the remote root

### Maintenance

- `drive-sync-validate-remote-ops`: run remote capability checks against the current scope
- `drive-sync-pause-auto-sync`: pause the auto-sync scheduler
- `drive-sync-resume-auto-sync`: resume the auto-sync scheduler
- `drive-sync-rebuild-index`: rebuild sync state from local and remote state
- `drive-sync-export-diagnostics`: export a diagnostics bundle
- `drive-sync-reset-connection`: disconnect the current provider session

## Adding A New Command

1. Create `src/commands/command-<id>.ts`.
2. Export one registration function, such as `registerDriveSyncFooCommand(context)`.
3. Reuse `CommandContext` helpers for scope, session, and error handling.
4. Register the command in `src/commands/index.ts`.
5. Keep the command ID stable once released.
6. Keep success and failure notices short.

## Review Checklist

When reviewing a new command, check that it:

- belongs in the command layer rather than UI or runtime
- reuses shared guards instead of duplicating them
- does not bypass provider or runtime abstractions
- reports user-facing failures with safe copy
- keeps its command ID and purpose obvious
