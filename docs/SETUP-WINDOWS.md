# Windows setup

## Requirements

- Windows 10 or 11, Adobe After Effects 2024, 2025 or 2026 installed and licensed.
- Node.js 24 or newer. Any source works: the nodejs.org installer, nvm-windows, Volta, fnm.
- In After Effects: Edit > Preferences > Scripting & Expressions > **Allow Scripts to Write
  Files and Access Network** must be on. Without it every call times out.

## Install

Open a terminal (cmd.exe, PowerShell or Windows Terminal), then:

```bat
git clone https://github.com/Dsrupt-Technologies/dsrupt-after-effects-mcp.git
cd dsrupt-after-effects-mcp
npm ci --ignore-scripts
npm run build
node dist\cli\index.js doctor
```

Keep this folder where it is. The MCP configuration points at its absolute path.

### If PowerShell says "running scripts is disabled on this system"

That is PowerShell refusing to run `npm.ps1`. npm is installed. Either:

- run the same commands in cmd.exe, or
- type `npm.cmd` instead of `npm` (`npm.cmd ci --ignore-scripts`), or
- allow local scripts once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

The MCP server itself is unaffected: clients launch `node.exe` directly.

### Node from a version manager

`doctor` names the manager it detects (nvm-windows, Volta, fnm). The printed config pins the
absolute `node.exe`, so after switching Node versions re-run `node dist\cli\index.js config`
and update the client entry, or the client will keep launching the old binary.

## Register with a client

```bat
node dist\cli\index.js install-codex
node dist\cli\index.js install-claude-code
node dist\cli\index.js config
```

`config` prints a `mcpServers` block for Claude Desktop, Cursor and similar clients. See
[MCP-CLIENTS.md](MCP-CLIENTS.md).

## Where After Effects is found

`doctor` and `locate-ae` show what was probed:

1. `DSRUPT_AE_EXE` (or `AE_MCP_EXE`) if set and the file exists.
2. A running `AfterFX.exe` (via PowerShell `Get-Process`).
3. `<Program Files>\Adobe\Adobe After Effects <year>\Support Files\AfterFX.exe` under every
   Program Files root (`ProgramFiles`, `ProgramFiles(x86)`, `ProgramW6432`).
4. Registry values mentioning After Effects under `HKLM\SOFTWARE\Adobe\After Effects`, the
   WOW6432Node mirror, and the Uninstall keys (HKLM and HKCU).
5. Start Menu shortcuts (`Programs` for all users and the current user, one folder deep),
   resolved through WScript.Shell.
6. Folders listed in `DSRUPT_AE_SEARCH_DIRS` (`;`-separated), each checked for
   `AfterFX.exe`, `Support Files\AfterFX.exe`, and `Adobe After Effects*` subfolders.

No drive is scanned. If your install is somewhere unusual, set the override:

```bat
set DSRUPT_AE_EXE=D:\Apps\Adobe After Effects 2026\Support Files\AfterFX.exe
```

and put the same variable into the client's `env` block (`config --env DSRUPT_AE_EXE=...`).

## Verify

```bat
node dist\cli\index.js doctor
node dist\cli\index.js check-ae
```

`check-ae` starts the server, lists tools, reads the skill index, and asks the **running**
After Effects for `ae_project_info` (read-only). If After Effects is not running it says so
and stops; `--allow-launch` lets it start After Effects. Common results:

| Result                            | Cause                                                                            | Fix                                                               |
| --------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `afterEffects` TIMEOUT            | Scripting preference off, a modal dialog open, or AE running as a different user | Enable the preference, dismiss dialogs, run both as the same user |
| `afterEffects` AE_NOT_FOUND       | Discovery found nothing                                                          | Set `DSRUPT_AE_EXE`                                               |
| `tools` missing `ae_save_project` | `AE_MCP_READONLY=1` is set                                                       | Intended for read-only sessions                                   |

The mailbox lives under `%TEMP%\mcp-aftereffects\runtime\`; `dispatcher.log` there records
each dispatcher run if you need to see how far a call got.
