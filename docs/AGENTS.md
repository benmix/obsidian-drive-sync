# Obsidian Drive Sync Agent Guide

## Purpose

This file defines how agents should use repository documentation.

It should stay thin. If guidance already exists in an indexed document, keep the detailed rule there instead of duplicating it in this file.

## Agent Rules

- Treat the indexed documents below as the source of truth for architecture, coding, verification, commands, sync behavior, and error design.
- Extend existing modules and flows before introducing new abstractions.
- Do not add compatibility shims, alias exports, or migration glue unless explicitly requested.
- If documentation conflicts with the actual repository structure, update the documentation instead of forcing code toward stale guidance.
- When adding, renaming, or substantially changing user-facing docs under `docs/`, keep English and Chinese variants in sync and update this index.

## Source Of Truth Map

- [`docs/README.md`](./README.md): repository overview, development workflow, project structure, and storage model
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md): coding standards, layering rules, side-effect boundaries, and testing expectations
- [`docs/VERIFICATION.md`](./VERIFICATION.md): manual verification flows and validation steps
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md): implementation architecture and responsibility boundaries
- [`docs/COMMANDS.md`](./COMMANDS.md): command layout and command behavior
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md): common failure cases and debugging entry points
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md): runtime sync behavior after initialization
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md): first-sync initialization behavior
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md): structured error model and migration plan
- [`docs/TASKS.md`](./TASKS.md): implementation tracking and pending work

## Document Index

Core docs:

- [`docs/README.md`](./README.md): repository overview, development workflow, and project structure
- [`docs/SPECS.md`](./SPECS.md): technical specification and product constraints
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md): implementation-oriented architecture design
- [`docs/COMMANDS.md`](./COMMANDS.md): command layout and command catalog
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md): troubleshooting guide and common debugging checks
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md): runtime sync behavior after initialization
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md): first-sync initialization behavior
- [`docs/VERIFICATION.md`](./VERIFICATION.md): manual verification checklist
- [`docs/TASKS.md`](./TASKS.md): implementation task tracking
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md): repository-specific coding standards and architectural coding rules
- [`docs/AGENTS.md`](./AGENTS.md): agent instructions for this repository
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md): structured error system design

Chinese docs:

- [`docs/zh-CN/README.md`](./zh-CN/README.md)
- [`docs/zh-CN/SPECS.md`](./zh-CN/SPECS.md)
- [`docs/zh-CN/ARCHITECTURE.md`](./zh-CN/ARCHITECTURE.md)
- [`docs/zh-CN/COMMANDS.md`](./zh-CN/COMMANDS.md)
- [`docs/zh-CN/TROUBLESHOOTING.md`](./zh-CN/TROUBLESHOOTING.md)
- [`docs/zh-CN/SYNC_STRATEGY.md`](./zh-CN/SYNC_STRATEGY.md)
- [`docs/zh-CN/SYNC_INITIALIZATION_STRATEGY.md`](./zh-CN/SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/zh-CN/VERIFICATION.md`](./zh-CN/VERIFICATION.md)
- [`docs/zh-CN/TASKS.md`](./zh-CN/TASKS.md)
- [`docs/zh-CN/CODING_STANDARDS.md`](./zh-CN/CODING_STANDARDS.md)
- [`docs/zh-CN/AGENTS.md`](./zh-CN/AGENTS.md)
- [`docs/zh-CN/ERROR_SYSTEM_DESIGN.md`](./zh-CN/ERROR_SYSTEM_DESIGN.md)

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian API documentation: https://docs.obsidian.md
- Obsidian developer policies: https://docs.obsidian.md/Developer+policies
- Obsidian plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian style guide: https://help.obsidian.md/style-guide
