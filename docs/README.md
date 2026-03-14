# Obsidian Drive Sync Documentation

This directory is the working documentation set for the plugin. It is written for contributors first: people changing sync behavior, provider integrations, runtime orchestration, UI flows, or release checks.

If you are new to the repository, read the documents in this order:

1. [`SPECS.md`](SPECS.md) for product scope and behavioral requirements
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) for codebase structure and module ownership
3. [`SYNC_INITIALIZATION_STRATEGY.md`](SYNC_INITIALIZATION_STRATEGY.md) and [`SYNC_STRATEGY.md`](SYNC_STRATEGY.md) for sync decision rules
4. [`ERROR_SYSTEM_DESIGN.md`](ERROR_SYSTEM_DESIGN.md) for structured failure handling
5. [`COMMANDS.md`](COMMANDS.md), [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md), and [`VERIFICATION.md`](VERIFICATION.md) for day-to-day development work

## Repository Summary

The plugin syncs one Obsidian vault with one selected remote folder. The current implementation emphasizes three properties:

- predictable sync decisions
- recoverable failure handling
- enough diagnostics to explain what the runtime actually did

The default remote provider is `proton-drive`, but the runtime and sync kernel are intentionally provider-agnostic.

## Current Status

Implemented:

- local and remote filesystem adapters
- IndexedDB-backed sync state and job queue
- session restore, retry scheduling, auth pause, and startup recovery
- remote root selection, status UI, diagnostics export, and conflict review
- provider-based runtime wiring and structured error handling

Still open:

- mobile compatibility validation
- fuller adapter test coverage
- some manual verification scenarios and release checks

The source of truth for active work is [`TASKS.md`](TASKS.md).

## Development Workflow

Typical local loop:

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

Useful checks:

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run test:watch
```

Optional setup:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/YourVault"
pnpm run link:obsidian
```

Manual install layout:

```text
<Vault>/.obsidian/plugins/<plugin-id>/
  main.js
  manifest.json
  styles.css
```

## Repository Layout

```text
src/
  main.ts                       plugin facade and lifecycle entry
  contracts/                    shared contracts by domain
  provider/                     provider implementations and registries
  runtime/                      session, scheduling, and orchestration
  sync/                         planning, queueing, state, and execution
  commands/                     command registration
  ui/                           settings, modals, and status views
tests/                          unit tests
docs/                           repository documentation
```

## Safety, Privacy, And Storage

- Telemetry is off by default.
- The plugin should only operate inside the active vault and the selected remote root.
- Normal user-facing logs should not expose authentication secrets.
- Settings live in Obsidian plugin data.
- Sync state, jobs, and logs live in IndexedDB through Dexie.

## Document Index

- [`SPECS.md`](SPECS.md): product scope, behavior requirements, milestones, and current plans
- [`ARCHITECTURE.md`](ARCHITECTURE.md): codebase layering, boundaries, and runtime flow
- [`SYNC_INITIALIZATION_STRATEGY.md`](SYNC_INITIALIZATION_STRATEGY.md): first-sync and re-initialization rules
- [`SYNC_STRATEGY.md`](SYNC_STRATEGY.md): runtime sync rules after baseline exists
- [`ERROR_SYSTEM_DESIGN.md`](ERROR_SYSTEM_DESIGN.md): structured error model and ownership
- [`COMMANDS.md`](COMMANDS.md): command layout and command catalog
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md): common debugging entry points
- [`VERIFICATION.md`](VERIFICATION.md): manual verification checklist
- [`TASKS.md`](TASKS.md): completed work and open engineering tasks
- [`CODING_STANDARDS.md`](CODING_STANDARDS.md): repository-specific coding standards
- [`AGENTS.md`](AGENTS.md): instructions for automated contributors
- [`zh-CN/`](zh-CN/README.md): Simplified Chinese version of the documentation set
