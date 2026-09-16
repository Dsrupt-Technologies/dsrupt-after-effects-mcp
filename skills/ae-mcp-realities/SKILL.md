---
name: ae-mcp-realities
description: Companion loaded through ae_get_skill when ae-clean-rig routes to it, not a starting point. Covers how this MCP reaches After Effects, what the policy switches hide, the error envelope and its codes, and how to recover safely after timeouts or partial batches.
---

# How this MCP really works

## The path from a tool call to After Effects

The client starts one local server process over stdio. Each tool call writes a request file to a per-user mailbox, launches a small dispatcher inside After Effects (AppleScript on macOS, `AfterFX.exe -r` on Windows), and waits for the response file. There is no panel or plugin in AE and no network service. Consequences:

- Every call is a separate round trip of a few hundred milliseconds. Group related edits in one `batch.run`.
- After Effects runs one script at a time. Calls from this server are serialized; do not run a second server against the same AE.
- If After Effects is not running, the first call will start it. Do not rely on that; ask the user to open the project they mean.
- `ae_get_skill` and `ae_catalog` never touch AE. `ae_project_info` is the real connection test.

## Policy switches

| Switch                              | Effect on what you see                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AE_MCP_READONLY=1`                 | `ae_save_project` and `ae_project_import_json` are not advertised; `ae_catalog` lists only read operations; `ae_do` refuses mutations with `FORBIDDEN`    |
| `AE_MCP_ALLOW_CATEGORIES`           | Only the listed categories appear in the catalog                                                                                                          |
| `AE_MCP_ENABLE_EVAL=1`              | Adds `eval.run` (arbitrary ExtendScript). Off by default; do not ask the user to enable it to work around a missing operation                             |
| Operations marked `appConfig: true` | Change AE application settings, not the project. They require `confirm: true`, which you pass only when the user explicitly asked for that setting change |

Trust the catalog over memory: what it lists is what will run.

## The error envelope

Failures come back as `{ ok: false, error: { code, message, retryable, hint?, details? } }`.

| Code                                     | Meaning                                                         | Do                                         |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `INVALID_ARGS`                           | Arguments failed the schema before reaching AE                  | Read `details.issues`, fix, resend         |
| `UNKNOWN_OPERATION` / `UNKNOWN_CATEGORY` | No such name                                                    | Use `details.suggestion` or `ae_catalog`   |
| `FORBIDDEN`                              | Policy blocked it                                               | Stop; tell the user which switch           |
| `OPERATION_FAILED`                       | Ran, then reported failure (comp not found, index out of range) | Inspect, fix the target                    |
| `JSX_THROW`                              | The script threw inside AE                                      | Read `stack`; often a bad address or state |
| `TIMEOUT`                                | No answer before the deadline                                   | See recovery below                         |
| `TRANSPORT`                              | Node-side spawn or file failure                                 | Retry once; then run the CLI doctor        |
| `AE_NOT_FOUND`                           | After Effects not located                                       | User sets `DSRUPT_AE_EXE`                  |
| `DISPATCHER`                             | The dispatcher failed before running your code                  | AE scripting preference is probably off    |
| `IO` / `VALIDATION`                      | Bad path or bad project JSON                                    | Fix the input                              |

`retryable: true` means the transport may succeed on a repeat. It does not mean the mutation is safe to repeat.

## Recovery

- **Timeout on a mutation:** the request may have been consumed and executed. Call `ae_project_info` and `ae_comp_info` on the target, compare with your expectation, then repeat only what is missing.
- **Partial batch:** `details.result.results` lists each child in order with its own `ok`. Everything before the failure is applied and sits in one undo group. Either continue from the first failed child or `project.undo` once, on its own, never inside a batch.
- **Modal dialog in AE:** every later call times out until the user dismisses it. Say so instead of retrying.
- **Read-only session:** report what you would have changed; do not look for a bypass.

## Verify

- `ae_catalog({})` at session start reflects the live policy; plan only against what it returns.
- After any timeout or failed batch, an inspection call precedes the next mutation.

Load `references/errors.md` for a longer walk-through of each code and `references/tools.md` for the tool and category map.
