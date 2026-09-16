# macOS setup

## Requirements

- macOS with Adobe After Effects 2024, 2025 or 2026 installed and licensed.
- Node.js 24 or newer (Homebrew, nvm, fnm, Volta, or the nodejs.org installer).
- In After Effects: After Effects > Settings > Scripting & Expressions > **Allow Scripts to
  Write Files and Access Network** on.
- Automation permission: the first call makes macOS ask whether the process that launched
  the server (your terminal, or the MCP client app) may control After Effects. Allow it. If
  you declined once, re-enable it under System Settings > Privacy & Security > Automation.

## Install

```bash
git clone https://github.com/Dsrupt-Technologies/dsrupt-after-effects-mcp.git
cd dsrupt-after-effects-mcp
npm ci --ignore-scripts
npm run build
node dist/cli/index.js doctor
```

Keep the folder in place; the MCP configuration points at its absolute path. With nvm or
fnm, the printed config pins the absolute node binary of the version you built with; after
switching versions, re-run `node dist/cli/index.js config` and update the client.

## Register with a client

```bash
node dist/cli/index.js install-codex
node dist/cli/index.js install-claude-code
node dist/cli/index.js config
```

See [MCP-CLIENTS.md](MCP-CLIENTS.md) for Claude Desktop, Cursor and manual configuration.

## Where After Effects is found

1. `DSRUPT_AE_EXE` (or `AE_MCP_EXE`) if set and the bundle exists.
2. A running After Effects (from `ps`), mapped back to its `.app` bundle.
3. `/Applications/Adobe After Effects <year>/Adobe After Effects <year>.app` and the same
   layout under `~/Applications`.
4. A Spotlight query for the After Effects bundle identifier (`mdfind`), which also finds
   installs on other volumes without walking the disk.
5. Folders listed in `DSRUPT_AE_SEARCH_DIRS` (`:`-separated).

Newest year wins; a release build beats a beta. `node dist/cli/index.js locate-ae` prints
every candidate. To force one:

```bash
export DSRUPT_AE_EXE="/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app"
```

and add the same variable to the client's `env` (`config --env DSRUPT_AE_EXE=...`).

## Verify

```bash
node dist/cli/index.js doctor
node dist/cli/index.js check-ae
```

`check-ae` starts the server, lists tools, reads the skill index, and asks the **running**
After Effects for `ae_project_info` (read-only). It refuses to launch After Effects unless
you pass `--allow-launch`. Common results:

| Result                                                            | Cause                                                     | Fix                                                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| error mentioning `-1743` or "Not authorized to send Apple events" | Automation permission denied                              | System Settings > Privacy & Security > Automation, allow the terminal or client for After Effects |
| `afterEffects` TIMEOUT                                            | Scripting preference off, or a modal dialog is open in AE | Enable the preference, dismiss the dialog                                                         |
| `afterEffects` AE_NOT_FOUND                                       | No bundle found                                           | Set `DSRUPT_AE_EXE`                                                                               |

The Automation permission is granted per launching app. Your terminal passing `check-ae` does
not grant Claude Desktop or Codex the same permission; the first call from each client
triggers its own prompt.

The mailbox lives under `$TMPDIR/mcp-aftereffects/runtime/`; `dispatcher.log` there records
each dispatcher run.
