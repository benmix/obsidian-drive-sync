# Obsidian Proton Drive Sync

Sync an Obsidian vault with a Proton Drive folder. This plugin is a work in progress and focuses on safe, observable, and reversible sync operations.

## Status

WIP. See `SPECS.md` and `TASKS.md` for scope, milestones, and design notes.

Recent updates:

- Remote change cursor/feed support with snapshot fallback.
- Remote root folder selector UI.
- Improved exclude patterns (validation + preview).
- Manual conflict resolution workflow + conflict list in status view.
- Priority-aware scheduling with differentiated retry backoff + max retries.
- Diagnostics redaction and in-app log viewer.
- Expanded hardening plan (pre-sync checks, queue visibility, cursor reuse).

## Goals

- Two-way sync between a vault and a single Proton Drive folder.
- Conflict detection with deterministic resolution.
- Crash recovery and resumable jobs.
- Minimal, explicit network usage with clear user controls.

## Non-goals

- Replacing the Obsidian vault adapter.
- Real-time multi-user collaboration.
- Any server-side components beyond Proton Drive.

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
  main.ts           # plugin lifecycle
  settings.ts       # settings + defaults
  commands/         # command handlers
  ui/               # settings tab + views
  sync/             # sync engine + adapters
  utils/            # helpers
```

## Security & Privacy

- No telemetry by default.
- Only accesses files inside the vault.
- Authentication details are not logged; session handling is delegated to the SDK http client.

## Docs

- `SPECS.md` — technical specification
- `TASKS.md` — development tasks
- `AGENTS.md` — agents rules

## Storage

- Sync index stored in IndexedDB via Dexie (settings remain in plugin data).
