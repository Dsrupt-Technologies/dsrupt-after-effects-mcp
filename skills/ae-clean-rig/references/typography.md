# Typography

Identify the face, keep glyphs rigid, and make every reveal state explicit.

## Identify the typeface first

- Read what the project uses: `ae_do({ operation: "font.list_used", args: {} })`, then `font.list_missing` and `font.list_duplicates` (the usual cause of a wrong face being picked).
- Compare diagnostic glyphs in an actual AE render against the reference: counters, terminals, M and N joins, numerals, plus a few whole words.
- Pixel overlap supports a choice; it does not make it. Whole-word alignment mis-ranks weights.
- State every substitution and apply it by PostScript name: `ae_do({ operation: "text.set_style", args: { comp: "Card", layer: "Headline", font: "Inter-SemiBold", fontSize: 96 } })`
- Confirm each visible instance in a rendered frame.

## Keep proportions stable

- Tracking and translation animate native tracking and Position with fixed font metrics; share phase through one control.
- Do not key a fitted width and height while Scale divides by `sourceRectAtTime` bounds. Tracking changes the bounds, so the text breathes and squashes.
- Let edits reflow, or expose one explicit fit control. Keep a genuine scale cut when the reference shows one.
- Measure with `layer.bounds` and `text.measure`.

## Kinetic type: name the mechanism

| Observed                   | Rig                                                      |
| -------------------------- | -------------------------------------------------------- |
| Rotated glyph              | Rotation with the anchor at the pivot                    |
| Weight transition          | `text.set_variable_font` axes, or a cut between weights  |
| Custom contour deformation | A few consistent-topology path poses for that glyph only |
| Text change                | `text.set_content` on the cut frame, or a second layer   |

Compare an ordinary and an extreme pose before choosing; easing the wrong representation never recovers the reference. Keep construction overlays separate from editable wording, and expose wording and fit as controls per `ae_get_skill({ name: "ae-clean-rig", reference: "references/editable-rigs.md" })`.

## Reveals: set the hidden state

- AE holds the first key's value backward to the in-point. A reveal whose first key is the visible state shows fully from frame 0.
- Give every delayed reveal an explicit hidden key, or move the in-point: `ae_do({ operation: "keyframe.set_batch", args: { comp: "Card", layer: "Headline", property: ["ADBE Transform Group", "ADBE Opacity"], times: [1.0, 1.4], values: [0, 100] } })`
- Record first visible frame and final hold. Check the frame before each reveal, the last before each cut, the first after it.

## Construction diagrams

- Bind anchors, tangents, dimension rules and labels to the geometry. Inside an expression, reach shapes with `content("Group 1").content("Path 1")`; layer layout rules live in `ae_get_skill({ name: "ae-clean-rig", reference: "references/construction.md" })`.
- Keep independent rules as separate paths; one polyline through two verticals adds a diagonal.
- Use the extrema and corners visible in the reference, not every intermediate font point.
- Match circle proportions and angular phase before animating. A graph growing along a curve is Trim Paths on a progressive path, not a rotating pointer.
- Re-set stroke widths and node sizes after scaling; a correct pre-scale stroke can vanish on a small glyph.

## Box text and inherited styles

- Paragraph text: read box position and anchor through `ae_layer_info` before assuming Position is the top-left corner. Adjust with `text.set_box`.
- New text layers inherit the last Character panel state. Call `text.reset_style`, then set every style explicitly.
- Verify rendered weight and case in a frame, not in property values.

## Verify

- `ae_render_frame` for each visible text instance; compare glyph shapes to the reference.
- Render the frame before each reveal and one extreme kinetic pose.
- Confirm `layer.bounds` stays proportional across a tracking animation.
- Render the nested comp at final viewing scale and check stroke widths.
