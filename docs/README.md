# Obsidian Drive Sync

Sync an Obsidian vault with a remote folder. This plugin is a work in progress and focuses on safe, observable, and reversible sync operations.

## Status

WIP. See `SPECS.md` and `TASKS.md` for scope, milestones, and design notes.

Recent updates:

- Remote change cursor/feed support with snapshot fallback.
- Remote root folder selector UI.
- Built-in exclude rules for cache/workspace files.
- Manual conflict resolution workflow + conflict list in status view.
- Priority-aware scheduling with differentiated retry backoff + max retries.
- Diagnostics redaction and in-app log viewer.
- Expanded hardening plan (pre-sync checks, queue visibility, cursor reuse).
- Runtime refactor plan documented (main facade + runtime orchestration split).
- Runtime refactor Phase A/B landed (`main.ts` facade + `runtime/{plugin-runtime,session-manager,trigger-scheduler,sync-coordinator}` + `sync/use-cases/sync-runner`).
- Runtime refactor Phase C landed (`network-policy` remains optional; no provider-side remote strategy/middleware layer is currently enabled).
- Sync module reorganized by responsibility (`contracts/planner/engine/state/support/use-cases`).
- Added `oxlint` import-boundary guards for sync layer dependency direction.
- Remote provider abstraction Phase C landed (commands + conflict/root modals migrated to provider interfaces; current default provider remains enabled).
- Legacy settings compatibility layer removed; runtime now reads and persists provider-only fields directly.
- Proton SDK/auth implementation moved under provider tree (`provider/providers/proton-drive/sdk`).
- Provider layering tightened: provider-specific/Obsidian file-system implementations now live under `provider/providers/*`; `sync/` keeps provider-agnostic kernel logic.
- FileSystem contracts centralized under `src/contracts/filesystem/`; shared path utility remains in `src/filesystem/path.ts`.
- Error system rollout completed for project-owned layers (`DriveSyncError`, structured persisted error state, structured sync logs, and diagnostics `recentErrors[]`).

## Goals

- Two-way sync between a vault and a single remote folder.
- Conflict detection with deterministic resolution.
- Crash recovery and resumable jobs.
- Minimal, explicit network usage with clear user controls.

## Non-goals

- Replacing the Obsidian vault adapter.
- Real-time multi-user collaboration.
- Any server-side components beyond the selected remote provider.

## Development

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

Production build:

```bash
pnpm run build
```

Unit tests:

```bash
pnpm run test
```

Watch mode:

```bash
pnpm run test:watch
```

`pnpm run build` now outputs `dist/main.js` and copies `manifest.json` + `styles.css` into `dist/`.

You can also set `OBSIDIAN_VAULT_PATH` once and reuse it:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/YourVault"
pnpm run link:obsidian
```

Manual install for testing:

```
<Vault>/.obsidian/plugins/<plugin-id>/
  main.js
  manifest.json
  styles.css
```

## Project Structure

```
src/
  main.ts                       # plugin facade lifecycle
  contracts/                    # centralized type contracts by domain
    filesystem/                 # shared local/remote file-system contracts
    plugin/                     # plugin API + settings contracts
    provider/                   # provider contracts
    runtime/                    # runtime contracts
    sync/                       # sync kernel contracts
    ui/                         # UI-facing contracts
  filesystem/
    path.ts                     # shared path utility
  provider/                     # provider implementations + registries
    providers/obsidian/         # Obsidian local file system + watcher
    providers/proton-drive/     # Proton auth/service + remote file system
  commands/                     # command handlers (one command per file, registered in commands/index.ts)
  runtime/                      # runtime orchestration
    plugin-state.ts             # settings/provider state facade
    sync-coordinator.ts         # runtime->sync orchestration boundary
    use-cases/                  # manual sync and diagnostics flows
  sync/                         # sync kernel
    planner/                    # reconcile and change planning logic
    engine/                     # queue and execution engine
    state/                      # sync state persistence model/store
    support/                    # hash/path/time helpers
    use-cases/                  # provider-agnostic sync execution pipeline
  ui/                           # settings tab + modals/views
    settings-tab.ts             # plugin settings tab
```

## Security & Privacy

- No telemetry by default.
- Only accesses files inside the vault.
- Authentication details are not logged; session handling is delegated to the SDK http client.

## Docs

- `SPECS.md` — technical specification
- `ARCHITECTURE.md` — implementation-oriented architecture design
- `ERROR_SYSTEM_DESIGN.md` — current error system implementation reference
- `SYNC_STRATEGY.md` — runtime sync strategy baseline (post-initialization)
- `SYNC_INITIALIZATION_STRATEGY.md` — first-sync initialization strategy baseline
- `COMMANDS.md` — command module structure and command catalog
- `TROUBLESHOOTING.md` — troubleshooting guide and common debugging checks
- `TASKS.md` — development tasks
- `AGENTS.md` — agents rules
- `zh-CN/` — Chinese translations for design/specification docs

## Storage

- Sync index stored in IndexedDB via Dexie (settings remain in plugin data).
