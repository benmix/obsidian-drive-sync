# Obsidian Drive Sync Agent Guide

## Purpose

This file tells automated contributors how to use the repository documentation.

It should stay short. Detailed policy belongs in the document that owns the topic.

## Agent Rules

- Treat the indexed documents below as the source of truth for product behavior, architecture, coding standards, verification, and troubleshooting.
- Extend existing flows before adding new abstractions.
- Do not add compatibility glue, alias exports, or migration layers unless the task explicitly requires them.
- If the code and the docs diverge, update the docs to match the actual repository unless the task is to restore the previous design.
- When changing user-facing docs under `docs/`, keep the English and Chinese files aligned.
- When changing sync behavior, check the relevant strategy document before editing code.

## Source Of Truth Map

- [`docs/README.md`](./README.md): documentation overview, development workflow, and repository map
- [`docs/SPECS.md`](./SPECS.md): product scope and behavioral requirements
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md): implementation layering and ownership boundaries
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md): repository coding rules and layer expectations
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md): initialization-phase sync rules
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md): runtime sync rules after initialization
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md): structured error model and responsibilities
- [`docs/COMMANDS.md`](./COMMANDS.md): command structure and command catalog
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md): common failure cases and debugging starts
- [`docs/VERIFICATION.md`](./VERIFICATION.md): manual verification steps
- [`docs/TASKS.md`](./TASKS.md): implementation tracking and open work

## Document Index

Core English docs:

- [`docs/README.md`](./README.md)
- [`docs/SPECS.md`](./SPECS.md)
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`docs/CODING_STANDARDS.md`](./CODING_STANDARDS.md)
- [`docs/COMMANDS.md`](./COMMANDS.md)
- [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- [`docs/SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/SYNC_STRATEGY.md`](./SYNC_STRATEGY.md)
- [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md)
- [`docs/VERIFICATION.md`](./VERIFICATION.md)
- [`docs/TASKS.md`](./TASKS.md)
- [`docs/AGENTS.md`](./AGENTS.md)

Simplified Chinese docs:

- [`docs/zh-CN/README.md`](./zh-CN/README.md)
- [`docs/zh-CN/SPECS.md`](./zh-CN/SPECS.md)
- [`docs/zh-CN/ARCHITECTURE.md`](./zh-CN/ARCHITECTURE.md)
- [`docs/zh-CN/CODING_STANDARDS.md`](./zh-CN/CODING_STANDARDS.md)
- [`docs/zh-CN/COMMANDS.md`](./zh-CN/COMMANDS.md)
- [`docs/zh-CN/TROUBLESHOOTING.md`](./zh-CN/TROUBLESHOOTING.md)
- [`docs/zh-CN/SYNC_INITIALIZATION_STRATEGY.md`](./zh-CN/SYNC_INITIALIZATION_STRATEGY.md)
- [`docs/zh-CN/SYNC_STRATEGY.md`](./zh-CN/SYNC_STRATEGY.md)
- [`docs/zh-CN/ERROR_SYSTEM_DESIGN.md`](./zh-CN/ERROR_SYSTEM_DESIGN.md)
- [`docs/zh-CN/VERIFICATION.md`](./zh-CN/VERIFICATION.md)
- [`docs/zh-CN/TASKS.md`](./zh-CN/TASKS.md)
- [`docs/zh-CN/AGENTS.md`](./zh-CN/AGENTS.md)

## External References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian API docs: https://docs.obsidian.md
- Obsidian developer policies: https://docs.obsidian.md/Developer+policies
- Obsidian plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian style guide: https://help.obsidian.md/style-guide
