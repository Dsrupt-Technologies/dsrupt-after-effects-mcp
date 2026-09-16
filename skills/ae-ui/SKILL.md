---
name: ae-ui
description: Companion skill for interface layouts in After Effects, covering the static design pass, scene spec, design tokens, hierarchy, component anatomy and text fitting. Load through ae_get_skill only when ae-clean-rig routes here; it is not a starting point.
---

# UI layouts

## Design before motion

Settle the still frame first. Nothing moves until a rendered still reads correctly at final size.

- Frame: `comp.create` fixes width, height, fps and duration. Decide the aspect ratio here.
- Safe areas and baseline grid: viewer guides via `comp.add_guide` (guides never render).
- Decide dominant blocks, text wrapping and stacking order first.

## Tokens before layers

Extract the brand or reference system first: `project.parse_swatch` reads an `.ase` palette, `font.list` confirms installed faces. With no reference, pick one coherent direction and keep it.

| Token                     | Starting values                                                 |
| ------------------------- | --------------------------------------------------------------- |
| Spacing                   | 4, 8, 12, 16, 24, 32, 48, 64, 96                                |
| Type                      | 12, 14, 16, 20, 24, 32, 40, 48, 64, scaled to output resolution |
| Palette                   | surface, text, accent, muted                                    |
| Radii, strokes, elevation | two radii, one or two widths, shadow levels 0 to 2              |

Siblings share tokens. Keep reference dimensions as given. Align optically when the arithmetic looks wrong.

## Scene spec

Write it before the first `ae_do` call: unique component names (indices shift), position and size per component, type (font, size, leading, tracking), colors, media file paths, and what the controller will drive.

## Hierarchy

One dominant message, one support level, restrained metadata. Get contrast, whitespace and alignment right before reaching for glow, gradients or blur.

## Component anatomy

Surface, heading, body, media, action, badge.

- Surface: `layer.create_shape`, `shape.add_group`, `shape.add_rect` (size, roundness), `shape.add_fill`, optional `shape.add_stroke`.
- Text: `layer.create_text` with `boxSize` for wrapping, then `text.set_style` (font, fontSize, leading, tracking, fillColor, justification).
- Media: `project.import_file`, then `layer.create_footage`.
- Icons: `shape.add_path` with clean vertices, or an authentic imported asset.

Fit containers from `layer.bounds` or `text.measure` plus padding from the spacing token, added once. If the fit lives in the rig as an expression on the rectangle size, sample sourceRectAtTime at a fixed time; per-frame sampling jitters once text animates.

## Controls

Expose a small set: accent color, corner radius, spacing unit. Add Slider and Color controls to a controller null with `effect.add` (match names from `project.list_effects`) and reference them with `expression.set`. Source defaults stay on the master; instance overrides go on the copy from `layer.duplicate` with `newName`. See `ae_get_skill({ name: "ae-clean-rig", reference: "references/editable-rigs.md" })`.

## Pipeline

1. Scene spec.
2. Discovery: `ae_catalog({})`, then `ae_catalog({ category: "shape" })` and `"text"`.
3. One representative component in a single `batch.run` (one undo group, not transactional).
4. `ae_render_frame`, then look at the PNG.
5. Duplicate the component and try a longer label plus a different image.
6. Assemble the rest, then motion via `ae_get_skill({ name: "ae-animation" })`.

Judge legibility on the rendered still at frame size, never on a zoomed viewer.

## Project JSON

The project JSON written by `ae_project_export_json` is the only format `ae_project_import_json` accepts. Never feed it an animation-interchange file from another tool.

## Verify

- Rendered still of the representative component at 100 percent.
- Rendered still of the long-label, alternate-image duplicate.
- `text.measure` reports no box overflow.
- Rendered still after motion is added; motion can break a correct layout.
