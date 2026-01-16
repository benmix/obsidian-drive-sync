# Obsidian Proton Drive Sync

Sync an Obsidian vault with a Proton Drive folder. This plugin is a work in progress and focuses on safe, observable, and reversible sync operations.

## Status

WIP. See `SPECS.md` and `PLAN.md` for scope, milestones, and design notes.

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
npm install
npm run dev
```

Production build:

```bash
npm run build
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
- `PLAN.md` — implementation milestones
