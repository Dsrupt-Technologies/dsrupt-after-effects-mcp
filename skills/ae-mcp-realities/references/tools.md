# Tool and category map

## The twelve tools

| Tool                     | Reads or writes                                                             | Use it for                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ae_get_skill`           | reads files only                                                            | Skill index, one skill, one reference                                                                           |
| `ae_project_info`        | read                                                                        | File path, dirty flag, every item with type, active item. The connection test                                   |
| `ae_comp_info`           | read                                                                        | Size, fps, duration, work area, motion blur, layer summaries; accepts an array of comps                         |
| `ae_layer_info`          | read                                                                        | Full property tree, effects, masks, text document, shape contents, keyframes; `layerIndex: "all"` audits a comp |
| `ae_version_info`        | read, but its capability probe adds and removes a scratch comp              | AE version and API capabilities. Not for connection tests on a clean project                                    |
| `ae_context`             | read                                                                        | Ambient state and the ES3 rules for anyone writing `eval.run` code                                              |
| `ae_catalog`             | read                                                                        | Categories, operation names, parameter schemas, current policy                                                  |
| `ae_do`                  | depends on the operation                                                    | Every mutation and every fine-grained read operation                                                            |
| `ae_render_frame`        | writes a PNG; in colour-managed projects adds and removes a transient layer | Visual verification                                                                                             |
| `ae_save_project`        | writes the .aep                                                             | Save, or Save As with `path`                                                                                    |
| `ae_project_export_json` | writes a JSON file                                                          | Whole-project snapshot in this server's own schema                                                              |
| `ae_project_import_json` | rebuilds the project                                                        | Restore from that schema only; never from any other JSON format                                                 |

## Operation categories

Counts reflect the default policy; `ae_catalog({})` shows the live list.

| Category                                                                     | Covers                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`                                                                    | New, open, save-adjacent settings, undo, import files and placeholders, find layers, list effects, purge, memory limits (confirm required)                 |
| `comp`                                                                       | Create, duplicate, delete, precompose, props, guides, renderer selection                                                                                   |
| `layer`                                                                      | Create text, shape, solid, null, camera, light, footage and adjustment layers; move, duplicate, split, parent, track matte, props, bounds                  |
| `text`                                                                       | Content, style, ranges, box settings, variable fonts, measurement                                                                                          |
| `shape`                                                                      | Groups, rects, ellipses, paths, fills, strokes, gradients, trim paths, repeaters, wiggles                                                                  |
| `property`                                                                   | Get, set, add, remove, move, list, select                                                                                                                  |
| `keyframe`                                                                   | Add, batch set, remove, copy, shift, easing, interpolation, spatial tangents, labels                                                                       |
| `expression`                                                                 | Set, remove, list                                                                                                                                          |
| `effect`                                                                     | Add, remove, move, dropdown items                                                                                                                          |
| `mask`                                                                       | Add, remove, path, props                                                                                                                                   |
| `marker`                                                                     | Comp and layer markers                                                                                                                                     |
| `footage`                                                                    | Interpret, reload, replace, missing list, proxies                                                                                                          |
| `font`                                                                       | List, info, glyph coverage, used fonts, substitution policy (confirm required)                                                                             |
| `render`                                                                     | Frame render, render queue items, settings, start, status, templates                                                                                       |
| `transform`, `timeline`, `viewer`, `egp`, `item`, `command`, `pref`, `batch` | Transform helpers, work area and time, viewer controls, Essential Graphics, item props and usages, menu commands, preferences (confirm required), batching |

## Verify

- Before planning against a category, open it with `ae_catalog({ category })` and read required parameters; do not rely on this table for signatures.
