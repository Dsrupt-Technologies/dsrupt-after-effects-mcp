# Effects

Backgrounds, gradients, light passes and native effects are designed elements. Build them from a few named layers, then judge the rendered pixels.

## Gradients and atmosphere

- Inspect several timestamps. Record palette, field positions, scale, falloff, dark and clear regions, and any highlight's path and speed.
- Decide the cause before picking an effect: camera move, moving light, colour change, or deformation.
- Build natively: Glow, Gaussian Blur, Gradient Ramp and 4-Color Gradient, shaped by masks and mattes. Confirm match names with `project.list_effects`, then `ae_do({ operation: "effect.add", args: { comp: "BG", layer: "Base", matchName: "ADBE Ramp" } })`
- One named layer per role: base palette, low-frequency depth, diffuse light, specular highlight. Few semantic fields, never many fragments. Name and nest them per `ae_get_skill({ name: "ae-clean-rig", reference: "references/construction.md" })`.
- Avoid visible ellipse edges, banding, muddy overlaps, and a generic background that only shares the reference hue. Add noise only when the reference shows it.

## Travelling light

- Stable path, Stroke, Trim Paths. Animate Start, End and Offset; key the reveal and the trailing fade independently. `ae_do({ operation: "shape.add_trim_paths", args: { comp: "BG", layer: "Ribbon", groupIndex: 1, start: 0, end: 0 } })`
- Rotating a visible filled ribbon is not a stroke travelling along a path.
- When the light wraps an object, split front and back passes with masks and shared source timing.
- Colour crossing a surface: animate the colour field relative to the surface, matted by the object (`layer.set_track_matte`). A fixed gradient moved with the surface has no independent phase.

## Text on a bending band

- Live text over one rectangular surface in a semantic precomp; apply a native warp such as Bezier Warp when it reproduces silhouette and glyph shape.
- Calibrate the interior deformation in an AE render. A boundary-only fit stretches the letters inside.
- Infer the surface from its full construction; an overlap fragment is not the whole card.
- Glyphs the reference keeps rigid stay rigid inside the same rig.

## Glow under a legible core

- Glow washes a coloured fill toward white. Keep a crisp core on top and put the bloom on a duplicate beneath (`layer.duplicate`, glow on the copy only).
- Check clipping margins so bloom is not cut at a precomp edge.
- Confirm secondary motion (hover, bounce, shadow) exists in the reference before rebuilding it as a small keyed cycle.

## Nested render checks

| Symptom                                      | Check                                                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effect shifted after precompose or parenting | Effect coordinates are layer space; re-measure with `layer.convert_point`                                                                                                     |
| Blur clipped at the layer edge               | Repeat Edge Pixels; layer smaller than the blur radius                                                                                                                        |
| Matte gone or inverted                       | Matte layer and type; alpha interpretation (`footage.interpret`)                                                                                                              |
| Colour differs from the parameter            | Effect order (`effect.move`), blend mode, bit depth (`project.get_settings`)                                                                                                  |
| Correct alone, wrong nested                  | Find the first parent comp that fails; inspect inherited layer styles, blend modes, switches, transforms; test a fresh precomp layer with reset transforms before redesigning |

A parameter value is not a rendered result. `property.get` says what was set; only `ae_render_frame` shows what rendered.

## Verify

- Render the effect layer isolated, then in the final parent comp at several timestamps.
- For a travelling highlight, render the start, the passage and the settled palette.
- Save, purge caches (`project.purge`), render a short sequence; a stale preview proves nothing.
- Inspect actual colour and alpha in the PNGs against the reference palette. Wider checklist: `ae_get_skill({ name: "ae-clean-rig", reference: "references/validation.md" })`.
