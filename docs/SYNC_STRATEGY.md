# Runtime Sync Strategy Specification

> Effective date: 2026-03-07
> This document governs sync behavior after initialization has finished. For first-sync rules, see [`SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md).

## 1. Purpose

This document defines the runtime decision rules for ongoing sync. It exists to keep three things explicit:

- what each sync strategy means
- which special-case protections take priority over the normal matrix
- where implementation branching is allowed

## 2. Terms

- `local`: the Obsidian vault view
- `remote`: the remote filesystem view
- `tracked`: a path with an existing sync-state mapping
- `tombstone`: a local deletion marker waiting for remote convergence
- `conflict_pending`: a path blocked on manual conflict resolution

## 3. Global Rules

These rules apply from highest to lowest priority:

1. Conflict protection comes first. A path in `conflict_pending` must not auto-run the normal upload or download path.
2. Tombstone convergence comes before ordinary incremental updates.
3. Remote missing must be confirmed twice before destructive convergence is allowed.
4. If no special-case rule applies, the configured `syncStrategy` decides the action.

## 4. Strategy Definitions

### 4.1 `local_win`

Local is the source of truth. Remote mirrors local.

Constraint:

- apart from conflict copies, remote content must not overwrite the canonical local file

### 4.2 `remote_win`

Remote is the source of truth. Local mirrors remote.

Constraint:

- apart from local conflict backups, local content must not overwrite the canonical remote file

### 4.3 `bidirectional`

Both sides are authoritative until a conflict is detected.

Constraint:

- if both sides changed, the system creates a conflict copy and enters `conflict_pending` instead of auto-picking a winner

## 5. Decision Matrix

| Scenario             | `local_win`                                     | `remote_win`                                    | `bidirectional`                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| local-only file      | `upload`                                        | `delete-local`                                  | `upload`                                         |
| remote-only file     | `delete-remote`                                 | `download`                                      | `download`                                       |
| both changed file    | `download remote copy` + `upload local`         | `backup local copy` + `download remote`         | `create conflict copy` + `mark conflict_pending` |
| local-only folder    | `create-remote-folder`                          | `delete-local`                                  | `create-remote-folder`                           |
| remote-only folder   | `delete-remote`                                 | `create-local-folder`                           | `create-local-folder`                            |
| tracked both missing | cleanup mapping and any required residual state | cleanup mapping and any required residual state | cleanup mapping and any required residual state  |

## 6. Special-Case Rules

### 6.1 Double-Confirm Remote Missing

- On the first observed remote-missing round for a tracked path, only increment `remoteMissingCount`.
- Destructive follow-up such as delete-local or recreate-remote is allowed only after a second consecutive confirmation.

### 6.2 Tombstone Convergence

- A tombstone means the path was deleted locally and the remote side still needs to converge.
- Under any strategy other than `remote_win`, planner logic should prefer `delete-remote` convergence before normal incremental work.

### 6.3 `conflict_pending` Suppression

- Do not generate repeated conflict jobs for the same path while `conflict_pending` is active.
- After the user resolves the conflict and clears the marker, the path returns to normal incremental sync.

## 7. Conflict Copy Model

Conflict handling uses one unified model:

1. keep one canonical editable file in place
2. write the opposite-side version into a conflict copy
3. mark the path as `conflict_pending`
4. resume normal sync only after manual resolution

Conflict copy naming:

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

Allowed `<source>` values:

- `local`
- `remote`

## 8. Implementation Constraints

- Use `syncStrategy` with only these values: `local_win`, `remote_win`, `bidirectional`.
- Do not reintroduce a separate `manual` conflict strategy path.
- Keep strategy branching in planner-level logic such as presence policy, reconcile decisions, or remote polling.
- The execution layer should consume jobs; it should not re-decide strategy.
- Any operation that could produce large-scale deletion must be visible in preflight and cancelable.

## 9. Verification Requirements

### 9.1 Minimum Unit Coverage

- local-only and remote-only behavior under all three strategies
- correct job and conflict-copy behavior for both-changed files
- double-confirm remote-missing behavior
- tombstone convergence behavior
- `conflict_pending` suppression and release
- post-initialization local-clear behavior with no initialization shortcut

### 9.2 Integration Coverage

- `planSync` followed by `runPlannedSync` matches the decision matrix
- `runAutoSync` and `pollRemoteSync` do not reverse strategy semantics
- local-clear after initialization follows runtime strategy, not initialization hard rules

### 9.3 Release Gate

- `pnpm run lint` passes
- `pnpm run test` passes
- `pnpm run build` passes
- manual verification includes at least one local-cleared-after-initialization scenario
