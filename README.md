# Dsrupt After Effects MCP

A local MCP server that connects an AI agent to Adobe After Effects, with the agent's
working knowledge served by the same server as skills.

```text
Desktop agent / MCP client (Codex, Claude Code, Claude Desktop, Cursor, ...)
        |  stdio
Dsrupt After Effects MCP  (Node)
        |  file mailbox + OS scripting (AppleScript / AfterFX.exe -r)
Adobe After Effects
```

Two surfaces, one process:

- **Tools**: inspect the project, comps and layers; discover the 197 catalogued operations
  and run them; render a frame to check the result; save.
- **Skills**: `ae_get_skill` serves an index, then one skill, then one reference, so the agent
  loads only what the current task needs instead of carrying every guide in context.

The runtime derives from the MIT-licensed [kumoproductions/mcp-aftereffects](https://github.com/kumoproductions/mcp-aftereffects);
see [UPSTREAM.md](UPSTREAM.md). Windows and macOS, After Effects 2024 to 2026, Node 24+.
No panel or plugin is installed in After Effects.

> **This tool edits the open After Effects project.** Anything the agent reads (comp names,
> expressions, footage paths) may be sent to the AI service behind your client. Try it on a
> copy first, and keep `AE_MCP_READONLY=1` for inspection-only sessions.

## Install

```bash
git clone https://github.com/Dsrupt-Technologies/dsrupt-after-effects-mcp.git
cd dsrupt-after-effects-mcp
npm ci --ignore-scripts
npm run build
node dist/cli/index.js doctor
```

`doctor` checks Node and npm, the built server, the skill bundle, the mailbox directory,
and where After Effects is installed. It does not launch After Effects. Then register the
server with your client:

```bash
node dist/cli/index.js install-codex          # Codex CLI
node dist/cli/index.js install-claude-code    # Claude Code
node dist/cli/index.js config                 # JSON block for Claude Desktop, Cursor, others
node dist/cli/index.js install-skill          # entry skill for Codex/Claude Code sessions
```

`install-skill` copies a small `dsrupt-after-effects` skill into `~/.agents/skills` and
`~/.claude/skills`, so an agent that has not been told about the server can still find it
(in Codex or ChatGPT desktop: `/dsrupt-after-effects`). Every real instruction stays on the
server behind `ae_get_skill`.

Platform notes: [Windows](docs/SETUP-WINDOWS.md), [macOS](docs/SETUP-MACOS.md), and
[MCP clients](docs/MCP-CLIENTS.md).

## Verify the connection

Installation and a working After Effects link are different facts, so they are checked
separately:

```bash
node dist/cli/index.js doctor      # 1. Node/npm, files, skills, AE location
node dist/cli/index.js check-ae    # 2. server starts, 3. tools advertised, 4. skills served,
                                   # 5. After Effects answers ae_project_info (read-only)
```

`check-ae` only talks to an After Effects that is already running, so it never boots one by
surprise; pass `--allow-launch` to change that. The sixth state, whether **your agent's
current conversation** can call the tools, is only visible from inside the client: ask it to
run `ae_get_skill({})` and then `ae_project_info({})`.

## First calls from the agent

1. `ae_get_skill({})`: the skill index.
2. `ae_get_skill({ name: "ae-clean-rig" })`: the entry skill. It routes to references such as
   `references/sliders.md` and to companion skills.
3. `ae_project_info({})`: what is open. This is the live connection test.
4. `ae_catalog({})`, then `ae_catalog({ category: "layer" })`: exact operations and parameters.
5. `ae_do({ operation: "layer.create_text", args: { comp: "Main", text: "Hello", name: "Title" } })`.
6. `ae_render_frame({ compNameOrId: "Main", time: 1, outPath: "/tmp/check.png" })`, then look at it.
7. `ae_save_project({})`.

The twelve tools are listed in [docs/TOOLS.md](docs/TOOLS.md). Operations are not tools;
the agent discovers them through `ae_catalog` at runtime.

## Skills

| Skill              | Load it for                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ae-clean-rig`     | Every task. Inspect first, build native and editable, animate sparsely, verify by rendering, save where intended. Routes to nine references: construction, reference motion, typography, effects, media, editable rigs, sliders, validation, scripting. |
| `ae-animation`     | Timing, easing, anticipation and settle, reveals, expressions, motion proof.                                                                                                                                                                            |
| `ae-ui`            | Interface layouts: static design first, tokens, component anatomy.                                                                                                                                                                                      |
| `ae-depth`         | Parallax, 3D layers and cameras, shadows, glass surfaces.                                                                                                                                                                                               |
| `ae-transitions`   | Reusable A-to-B transitions with a progress control.                                                                                                                                                                                                    |
| `ae-mcp-realities` | How the transport works, policy switches, error codes, recovery after timeouts.                                                                                                                                                                         |

Skills live in `skills/`, are described by `skills/manifest.json`, and are verified by hash
before being served. See [docs/SKILLS.md](docs/SKILLS.md) to edit or add one.

## Safety

- Every `ae_do` call is one undo group. `batch.run` is one undo group too, but not a
  transaction: earlier steps stay applied if a later one fails.
- A `TIMEOUT` may mean the change already applied. The skills tell the agent to inspect before
  retrying a mutation.
- `AE_MCP_READONLY=1` withholds saving and importing and limits `ae_do` to read operations.
  `AE_MCP_ALLOW_CATEGORIES` narrows the catalog. Arbitrary ExtendScript (`eval.run`) is off
  unless `AE_MCP_ENABLE_EVAL=1`.
- Operations that change After Effects application settings (not the project) require
  `confirm: true`.
- The connection test and the doctor never mutate the project. The live smoke test
  (`npm run smoke`) refuses to run in anything but a fresh, empty, unsaved project.

## Environment

| Variable                  | Meaning                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DSRUPT_AE_EXE`           | After Effects to use: `AfterFX.exe` on Windows, the `.app` bundle on macOS. Also read: `AE_MCP_EXE`, `AE_EXE`. |
| `DSRUPT_AE_SEARCH_DIRS`   | Extra folders to probe for an install (`;`-separated on Windows, `:` on macOS).                                |
| `AE_MCP_READONLY`         | `1` for inspection-only sessions.                                                                              |
| `AE_MCP_ALLOW_CATEGORIES` | Comma-separated operation categories to allow.                                                                 |
| `AE_MCP_ENABLE_EVAL`      | `1` to enable `eval.run`.                                                                                      |
| `AE_MCP_RUNTIME_DIR`      | Move the request/response mailbox (keep it per-user).                                                          |

Without an override, After Effects is found in this order: a running After Effects process,
then installed copies under Program Files, the Windows registry, Start Menu shortcuts,
`/Applications`, `~/Applications`, a Spotlight bundle-id query, and `DSRUPT_AE_SEARCH_DIRS`.
Newest year wins; `locate-ae` shows every candidate and what was probed.

## Development

```bash
npm run check          # skills check, typecheck, lint, format, JSX ES3 lint, docs drift
npm run test:offline   # 300+ tests, no After Effects needed
npm test               # adds the e2e suites, which self-skip without a running AE
npm run smoke          # live demo in a fresh empty project; writes runtime/dsrupt-smoke/
npm run test:package   # pack, install to a temp prefix, start the server from there
```

Internals, error codes and how to add an operation are in [CONTRIBUTING.md](CONTRIBUTING.md).
The comparison with the upstream project and the reference fork is in
[docs/COMPARISON.md](docs/COMPARISON.md); what has actually been verified, and where, is in
[docs/VALIDATION.md](docs/VALIDATION.md).

## License

MIT. Copyright (c) 2026 kumo.productions, Inc. (upstream runtime) and Dsrupt Technologies
(modifications). Adobe and Adobe After Effects are trademarks of Adobe Inc.; this project is
independent and not affiliated with or endorsed by Adobe.
