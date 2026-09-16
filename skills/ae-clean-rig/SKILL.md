---
name: ae-clean-rig
description: Entry point for every After Effects task through this MCP. Load first whenever the user wants to build, edit, animate, fix, inspect, verify, render or save an After Effects project, comp, layer, text, shape, effect, expression or keyframe. Routes to references and companion skills.
---

# After Effects through Dsrupt: inspect, build native, verify, save

You are driving a real After Effects instance through structured tools. Everything you do lands in the user's open project, so the order of work is fixed: inspect, plan, build in small verified steps, render to check, save only where asked.

## Tools at a glance

| Need                                                              | Tool                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Skill index, one skill, one reference                             | `ae_get_skill({})`, `ae_get_skill({ name })`, `ae_get_skill({ name, reference })` |
| What is open: file, dirty flag, items, active item                | `ae_project_info({})`                                                             |
| One or more comps: size, fps, duration, layer summaries           | `ae_comp_info({ nameOrId })`                                                      |
| Full layer detail: transforms, effects, masks, text, shapes, keys | `ae_layer_info({ compNameOrId, layerIndex })` (`"all"` audits a comp)             |
| Which operations exist and their exact parameters                 | `ae_catalog({})`, then `ae_catalog({ category })`                                 |
| Run one operation, or many in one round trip                      | `ae_do({ operation, args })`, `ae_do({ operation: "batch.run", args: { ops } })`  |
| See the result                                                    | `ae_render_frame({ compNameOrId, time, outPath })`, then look at the PNG          |
| Persist                                                           | `ae_save_project({ path? })`                                                      |

`ae_get_skill` and `ae_catalog` work with After Effects closed. `ae_project_info` is the connection test: cheap, read-only, and it tells you what you are about to touch.

## Rules that do not bend

1. **Inspect before editing.** Read the project, the target comp and the layers you will change. Never assume names, indices, fps or dimensions from memory of an earlier session.
2. **Discover, do not invent.** Operation names and parameters come from `ae_catalog`. If an operation is missing, the server does not support it; say so rather than guessing or asking for `eval.run`, which is off unless the user enabled it.
3. **Preserve unsaved work.** Never create a new project, open another project, close, or purge on your own initiative. Before structural changes to a saved project, save a backup copy with `ae_save_project({ path })` to a clearly named file next to the original, then continue in the original.
4. **Build editable, native objects.** Words are text layers. Graphics are a few meaningful shape primitives or clean paths. UI stays native, never a screenshot or a rasterized card. Photographic content is real media in a named, replaceable precomp.
5. **Animate sparsely and on purpose.** Keys at anticipation, extremes, overshoot and settle, with intentional easing. No idle wobble, breathing or drift that the brief or reference did not ask for.
6. **Keep the user's animation.** When correcting appearance, leave existing keys, expressions, layer order, masks, parents and effects intact unless the request is to replace them.
7. **Verify expressions.** After setting one, read the property back and check its `expressionError`. A script that returned `ok` proves nothing about the expression.
8. **Render, then look.** A tool result is not visual proof. Render the first frame, the fastest frame, the settled frame and any seam, and inspect the images before reporting.
9. **Save only to the intended path.** Ask when the destination is unclear. Do not overwrite the only original with an experiment.

## Workflow

1. `ae_get_skill({})` once per session, then this skill. Load a reference only when the row below matches the task.
2. `ae_project_info({})`. Note the file, the dirty flag and the active comp. If the project is unsaved with changes, say so before any structural edit.
3. `ae_comp_info` and `ae_layer_info` on the targets. Record dimensions, fps, duration, layer names, existing keys and expressions.
4. Write a short plan: comps and layers to create or change, names, controls, motion beats with times in seconds and frames.
5. `ae_catalog({ category })` for every category the plan needs. Read parameter names and required flags.
6. Build one representative element, render it, inspect it. Only then batch the rest with `batch.run` and `stopOnError: true`. A batch is one undo group but not a transaction: on failure, inspect what applied before retrying.
7. Render representative frames; compare against the reference or the brief; correct; re-render.
8. Save with `ae_save_project`. Report the file written, what was verified visually, and any remaining gap or substitution.

## Load the reference that changes the current decision

| Task involves                                                                               | Load                             |
| ------------------------------------------------------------------------------------------- | -------------------------------- |
| Choosing text vs shapes vs media, building UI, logos, products with depth                   | `references/construction.md`     |
| Matching a reference video or image, frame timing, cuts, preserving motion while rebuilding | `references/reference-motion.md` |
| Fonts, kinetic type, tracking, box text, reveals, diagrams                                  | `references/typography.md`       |
| Gradients, glow, travelling light, warps, nested-render problems                            | `references/effects.md`          |
| Sourcing photos or footage, generating plates through a connector, packaging media          | `references/media.md`            |
| Precomps, controllers, Essential Properties, independent sources, additive rigs             | `references/editable-rigs.md`    |
| Galleries, coverflow, cyclic sliders, curved loops, animatable cameras                      | `references/sliders.md`          |
| Final checks, resolution changes, render queue, delivery and reporting                      | `references/validation.md`       |
| Scripting pitfalls: indices, match names, text styles, time remap, timeouts                 | `references/scripting.md`        |

Call as `ae_get_skill({ name: "ae-clean-rig", reference: "references/sliders.md" })`, substituting the file from the table.

## Companion skills

Load through `ae_get_skill({ name })` only when the subject matches: `ae-animation` for timing, easing and motion proof; `ae-ui` for interface layouts and design tokens; `ae-depth` for parallax, 3D layers, cameras and glass; `ae-transitions` for reusable A-to-B transitions; `ae-mcp-realities` for transport limits, policy, error codes and recovery.

## Finish

Before reporting done: no expression errors on touched layers; rendered frames inspected at start, peak motion, settle and seams; one real content edit tested in a duplicate and reverted where editability was promised; project saved to the agreed path; differences from the brief stated plainly.
