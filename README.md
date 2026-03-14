# Obsidian Drive Sync

English | [简体中文](README.zh-CN.md)

Obsidian Drive Sync is an Obsidian plugin that syncs one vault with one remote folder. The project is still under active development. The current priority is a sync engine that is predictable, observable, and recoverable when something goes wrong.

## What Exists Today

- Two-way sync between a local vault and a selected remote root
- Local change watching plus remote change polling or feed fallback
- Conflict detection with a manual review workflow
- Session restore, retry scheduling, and resumable work queues
- Structured logs, diagnostics export, and an in-app status view
- Provider-based architecture; the default remote provider is `proton-drive`

## What Is Still Open

- Mobile compatibility has not been fully validated
- Adapter-level test coverage is still incomplete
- Some manual verification flows are still tracked in [`docs/VERIFICATION.md`](docs/VERIFICATION.md)

## Documentation

- Repository guide: [`docs/README.md`](docs/README.md)
- Technical specification: [`docs/SPECS.md`](docs/SPECS.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Simplified Chinese docs: [`docs/zh-CN/README.md`](docs/zh-CN/README.md)

## Development

```bash
pnpm install
pnpm run link:obsidian -- --vault "/path/to/YourVault"
pnpm run dev
```

Useful commands:

```bash
pnpm run build
pnpm run lint
pnpm run test
```

`pnpm run build` writes `dist/main.js` and copies `manifest.json` and `styles.css` into `dist/`.
