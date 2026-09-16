# Construction: text, geometry, UI and 3D

## Pick the representation first

| Reference content                | Build it as                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Words, numbers, labels           | Native text. Match font by glyph shape, weight, width, tracking, baseline and line breaks (`font.list`, `text.set_style`). |
| Icons, badges, objects           | A few named shape primitives plus clean Bezier paths, one path per real silhouette or detail.                              |
| Buttons, fields, dialogs, panels | One semantic precomp per control: text, shapes, gradients, built-in effects.                                               |
| Photos, footage, organic texture | Imported media, sized for its largest on-screen use.                                                                       |
| Logos                            | An authentic standalone asset with clean transparency.                                                                     |

- Keep text live. Outline glyphs only when a glyph itself must deform. Report any font substitution that changes the look.
- Split an object into parts that mean something (body, lid, trim, clasp, shadow). Add a part only when it explains a visible detail or moves on its own.
- No fixed layer budget, but folding hundreds of traced fragments into one precomp hides the mess rather than simplifying the object.
- Simplifying must not turn a distinctive design into a generic one. Keep the proportions, corner radii, stroke weights and palette that make it recognizable.

```
ae_do({ operation: "layer.create_text", args: { comp: "Main", text: "Get started", name: "Button Label" } })
ae_do({ operation: "shape.add_rect", args: { comp: "Button", layer: "Button BG", groupIndex: 1, size: [320, 88], roundness: 24 } })
```

## UI is built, never pasted

- Every control is native, in its own precomp named by role, with states (hover, pressed, disabled) as inner layers or a Checkbox control.
- No generated UI images and no screenshots of controls as finished artwork.
- A glass look still needs native parts: continuous geometry, bevel, gradient and reflection passes, blur, an animatable highlight.

## Reference crops are analysis only

- Masking an object out of a screenshot and calling it the asset is not allowed. A logo seen inside a phone screenshot is not a source asset.
- Get a clean standalone file, rebuild it compactly from native parts, or use an approved generated original. See `ae_get_skill({ name: "ae-clean-rig", reference: "references/media.md" })`.
- A reference video may sit in the comp as a guide layer for comparison (`layer.set_guide`), never as a hidden stand-in.

## Shading

- Real gradients, soft shadows, strokes, glows and controlled highlights.
- Never stacked color bands or clouds of tiny polygons to fake continuous shading.
- Blur does not repair fragmented geometry. Do not soften the whole comp to hide one local defect.
- `shape.add_gradient_fill` cannot set color stops from script (white to black by default). Tell the user which stops to set, or use a gradient effect found via `project.list_effects`.

## Volumetric products need real depth

When a phone or box shows bevels, side faces, perspective shift or changing light, build 3D geometry and a camera. A corner-pinned flat precomp, or a flat layer with its 3D switch on, does not qualify.

- Use 3D shape planes per face, or `layer.create_parametric_mesh` (AE 26.3+) with `comp.set_renderer` on `advanced3d`.
- Keep the screen UI as an editable precomp on the front face and check its registration at several times during the move.

```
ae_do({ operation: "layer.create_camera", args: { comp: "Product Stage", name: "Product Cam" } })
ae_do({ operation: "transform.set", args: { comp: "Product Stage", layer: "Screen", threeDLayer: true } })
```

## Vision measures, it does not build

Use analysis to read bounds, colors, timing and motion paths, then feed those numbers into a stable rig. Auto-tracing every frame, segmenting by palette, or swapping contours are not reconstruction methods: topology must not change per frame.

For motion quality see `ae_get_skill({ name: "ae-clean-rig", reference: "references/reference-motion.md" })`.

## Verify

- `ae_render_frame` at a still moment and mid-transition; compare with the reference side by side.
- `ae_comp_info` on Main: components are named precomps, text is still text, no imported UI screenshots.
- Zoom the render on edges and gradients: no banding, no fragment seams.
- 3D products: render from two camera positions; the screen UI stays registered.
