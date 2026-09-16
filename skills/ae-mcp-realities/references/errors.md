# Error codes, causes and next steps

Every failure has one code. Branch on the code, not on the prose.

## Before anything reached After Effects

- **INVALID_ARGS.** The operation's declared parameters rejected the call: a missing required field, a wrong type, or a key the operation does not know. `details.issues` names each problem and `details.expected` summarises the schema. A misspelled key is rejected instead of silently ignored, so check `hint` for a "did you mean" suggestion.
- **UNKNOWN_OPERATION.** No operation by that name. `details.suggestion` carries the closest real name. Confirm with `ae_catalog({ category })` before resending.
- **UNKNOWN_CATEGORY.** `ae_catalog` was asked for a category that does not exist; `details.availableCategories` lists the real ones.
- **FORBIDDEN.** Blocked by `AE_MCP_READONLY`, `AE_MCP_ALLOW_CATEGORIES`, the `eval.run` opt-in, or a missing `confirm: true` on an application-configuration operation. This is a deployment decision. Report it; do not try another route to the same effect.

## Inside After Effects

- **OPERATION_FAILED.** The script ran to completion and returned `ok: false`. Typical messages: no comp matching the name, layer index out of range, property not found. Inspect with `ae_comp_info` or `ae_layer_info`, correct the target, resend. For `batch.run` the message says how many children failed and `details.result.results` shows each one.
- **JSX_THROW.** The generated script raised an exception. `stack` points at the statement. Common causes: addressing a property that does not exist on that layer type, setting a value of the wrong dimension, or acting on a layer that was deleted earlier in the same batch.
- **DISPATCHER.** The dispatcher could not run the request at all. Almost always "Allow Scripts to Write Files and Access Network" is off in AE's Scripting & Expressions preferences, or the mailbox is unreadable from AE's side (different user account). Ask the user to check the preference and run the CLI doctor.

## Around After Effects

- **TIMEOUT.** No response before the deadline (60 s by default; `ae_do` accepts `timeoutMs`). Causes, in order of likelihood: AE is showing a modal dialog; AE is busy with a long render or a huge operation; AE is not running and is still starting; the scripting preference is off so the dispatcher never wrote a response. The request may have executed. Inspect before repeating a mutation, and raise `timeoutMs` for legitimately long operations such as `render.start` or a large `batch.run`.
- **TRANSPORT.** Spawning the launcher or writing the mailbox failed on the Node side. Retry once. If it persists, the CLI `doctor` shows the mailbox path and permissions.
- **AE_NOT_FOUND.** No After Effects install could be located. The message lists what was probed. The user sets `DSRUPT_AE_EXE` to the executable (Windows) or `.app` bundle (macOS), or adds the install's parent folder to `DSRUPT_AE_SEARCH_DIRS`.
- **IO.** A path you supplied could not be read or written, or it points inside the server's mailbox, which is refused on purpose. Choose another path.
- **VALIDATION.** A project JSON document for `ae_project_import_json` failed the schema. Use `dryRun` to see the issues without touching the project.

## macOS specifics

An error mentioning `-1743` or "Not authorized to send Apple events" means macOS Automation permission was denied for the process that launched the server (the terminal or the MCP client). The user grants it under System Settings, Privacy & Security, Automation.

## Verify

- After any code other than INVALID*ARGS, UNKNOWN*\* or FORBIDDEN, the next call is an inspection, not a repeat of the mutation.
