# Upstream and provenance

## Runtime

This repository's After Effects runtime derives from
[kumoproductions/mcp-aftereffects](https://github.com/kumoproductions/mcp-aftereffects),
version 0.2.0 at commit `11f6ca4` (2026-08-12), released under the MIT license by
kumo.productions, Inc. The full upstream Git history is retained in this repository; the
`upstream` remote points at the original project so future upstream changes can be merged.

The MIT license text and the upstream copyright notice are preserved in [LICENSE](LICENSE).
Dsrupt's modifications are released under the same MIT license.

Unchanged from upstream: the ExtendScript under `jsx/`, the file-IPC transport, the
operation registry and its 197 operations, the eleven original tools, the project JSON
schema, the colour pipeline, and the upstream test suite (one test file was adapted to run
on macOS without After Effects).

Added or changed by Dsrupt:

- `src/skills.ts`, `src/tools/get-skill.ts`: the `ae_get_skill` tool and the manifest-backed
  skill store.
- `src/discovery/`: After Effects discovery (running process, Program Files, registry, Start
  Menu, Spotlight, custom folders) and Node toolchain checks. `src/config.ts` now resolves
  After Effects through it.
- `src/cli/`: the `dsrupt-after-effects` CLI (`doctor`, `locate-ae`, `check-ae`, `config`,
  `install-codex`, `install-claude-code`).
- `src/index.ts`: server name, title and instructions.
- `skills/`: the Dsrupt skill corpus and its manifest.
- `scripts/`: manifest generation, skill content checks, live smoke test, package
  verification. Upstream's npm and MCP Registry publishing scripts were removed.
- Documentation under `docs/` and this file.

## Skills

The skill documents under `skills/` were written by Dsrupt. Their structure (an entry skill
that routes to references and companion skills, served on demand through one MCP tool) and
the topics they cover follow the design of a public fork of the same upstream by another
company, which was studied as an architecture and feature reference. No text from that
fork's skill corpus is reproduced here; that corpus is not MIT-licensed and is not part of
this repository. The functional knowledge (workflow order, verification steps, After
Effects scripting facts) is not proprietary and was rewritten independently.

`scripts/check-skills.mjs` enforces that no third-party product names remain in the corpus.

## Trademarks

Adobe and Adobe After Effects are trademarks of Adobe Inc. This project is independent and
not affiliated with or endorsed by Adobe.
