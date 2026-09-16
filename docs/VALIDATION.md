# What has been verified, and where

Last updated 2026-09-16. Machine: macOS (Darwin 24.6), Node 24.21.0 via nvm, **no After
Effects installed**. Everything below that needs After Effects is still to be run on a
machine that has it; the commands are listed so the result can be recorded here.

## Verified offline (this machine)

| Check                                                                                                               | Command                                | Result                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks: skills manifest and content, typecheck (src and tests), oxlint, oxfmt, JSX ES3 lint, tool docs drift | `npm run check`                        | pass (warnings only, inherited from upstream style rules)                                                                                                                                                                        |
| Offline test suite                                                                                                  | `npm run test:offline`                 | 24 files, 302 tests, all pass. Upstream's 276 tests plus skills (15), discovery (13), toolchain (5), CLI (6); one upstream test file adapted so its timeout tests run on macOS without After Effects                             |
| Full suite including e2e collection                                                                                 | `npm test`                             | e2e suites detect no running After Effects and self-skip with a banner; no collection errors                                                                                                                                     |
| Package                                                                                                             | `npm run test:package`                 | tarball packed, installed to a temporary global prefix, CLI run from there, server started from an unrelated cwd, 12 tools listed, `ae-clean-rig/references/sliders.md` served, doctor JSON parsed                               |
| `dsrupt-after-effects doctor`                                                                                       | text and `--json`                      | node, npm, npx, platform, server, dispatcher, install location, skills (6 skills, 17 documents), mailbox pass; `after-effects` fails as expected with the probe log (process, /Applications, ~/Applications, Spotlight)          |
| `dsrupt-after-effects locate-ae`                                                                                    |                                        | reports not found and what was probed; with `DSRUPT_AE_EXE` set it reports the override as the source                                                                                                                            |
| `dsrupt-after-effects check-ae`                                                                                     |                                        | node, server, tools (12), skills (6) pass; the After Effects step is reported as skipped because no process is running; the agent step is reported as unverifiable from the CLI; exit code 2                                     |
| `dsrupt-after-effects config`                                                                                       | json, codex, claude-code, with `--env` | prints absolute node and server paths                                                                                                                                                                                            |
| Windows discovery logic                                                                                             | `tests/discovery.test.ts`              | exercised through a fake host: Program Files roots, registry parsing, Start Menu resolution, running process precedence, override precedence, missing override reported, custom search dirs, beta ranking, no drive-root listing |
| Windows toolchain logic                                                                                             | `tests/toolchain.test.ts`              | blocked `npm.ps1` reported as present-with-policy-hint, `.cmd` shim run through the shell, version manager detection                                                                                                             |

## Not yet verified (needs a machine with After Effects)

Run these on Windows and macOS with After Effects 2026 open on a fresh empty project, and
paste the output here:

```bash
node dist/cli/index.js doctor
node dist/cli/index.js check-ae
npm run smoke
```

`npm run smoke` runs `scripts/live-smoke.mjs`: skill index, entry skill, `ae_project_info`,
catalog, a 24-operation `batch.run` building a 1280x720 comp with three shape layers, four
text layers, opacity keys with easing and one expression, an `expressionError` check, three
`ae_render_frame` calls (0 s, 0.4 s, 1.2 s) with file-size checks, `ae_save_project` to
`runtime/dsrupt-smoke/dsrupt-smoke.aep`, and a `report.json`. It refuses to run in a
project that is not fresh, empty and unsaved.

Then look at the three PNGs. The expected images: a dark card on a dark background with an
orange accent bar growing from the left; the title invisible at 0 s, partly faded at 0.4 s,
and fully settled by 1.2 s.

Also to be confirmed live:

- The upstream e2e suites (`AE_MCP_E2E=1 npm test`), which mutate the open session. Run them
  only with no real work open.
- macOS Automation prompt flow from Claude Desktop and Codex (each client gets its own prompt).
- Windows: the PowerShell `Get-Process` and Start Menu `.lnk` resolution against a real
  install, and behaviour when After Effects runs as a different user than the MCP client.

## How to record a live result

Append a dated section with the OS, After Effects version, Node version, the three command
outputs, and a note on the rendered frames. Keep `report.json` out of Git (it lives under
`runtime/`, which is ignored).
