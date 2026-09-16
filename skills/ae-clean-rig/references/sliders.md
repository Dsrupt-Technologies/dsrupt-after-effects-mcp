# Sliders: galleries, coverflow and 3D loops

## Measure before choosing a rig

| Measurement                      | Why                         |
| -------------------------------- | --------------------------- |
| Card count                       | Sets `n` for wraparound     |
| Front card size, corner radius   | Anchors the layout          |
| Overlap and gap                  | Spacing default             |
| Side angle, scale falloff        | Gallery versus coverflow    |
| Depth (Z) and dimming            | Sorting and shading rules   |
| Stage bounds, camera perspective | Focal length, stage precomp |

| Reference shows                             | Rig                    |
| ------------------------------------------- | ---------------------- |
| Cards fanned on an arc, center readable     | Curved gallery         |
| Flat center card, angled stacks either side | Coverflow on 3D planes |
| Straight runs joined by tight bends         | Loop along a real path |

A loop with tight bends is not a circular carousel; do not swap one for the other just because both hold cards. For a still reference, reproduce the neutral layout first, then add the simplest smooth motion consistent with it.

## One precomp per card

Each replaceable card is its own comp: a media layer named `REPLACE MEDIA`, a native caption, and treatments (shading, border, rounded corners) as native layers or effects.

```
ae_do({ operation: "comp.create", args: { name: "Card 01", width: 600, height: 800, fps: 30, duration: 10 } })
ae_do({ operation: "layer.create_footage", args: { comp: "Card 01", sourceItemId: 42, name: "REPLACE MEDIA" } })
ae_do({ operation: "layer.create_text", args: { comp: "Card 01", text: "Caption", name: "Caption" } })
```

- The Cover or Fit scale expression must account for source and comp pixel aspect, with a framing offset the user can adjust.
- Rounded corners belong to the card (mask or shape matte), so a photo swap cannot lose them.
- No image atlas, no cards cropped from the reference screenshot.

## One Slide control

```
ae_do({ operation: "layer.create_null", args: { comp: "Slider", name: "SLIDER CTRL" } })
ae_do({ operation: "effect.add", args: { comp: "Slider", layer: "SLIDER CTRL", matchName: "ADBE Slider Control", name: "Slide" } })
```

Pick one index convention and state it in the guide: `1` = first card in front, `2` = second, fractions sit between. A labeled `0..100` percent-of-loop convention is also fine. Never mix them.

For `n` cards in a cycle, use positive modulo, because plain `%` goes negative for negative input:

```
var n = 6;
var s = thisComp.layer("SLIDER CTRL").effect("Slide")("Slider");
var i = 3;                            // this card's index, set per card
var rel = (((i - s) % n) + n) % n;    // 0 = front, 1 = next to the right
if (rel > n / 2) rel -= n;            // signed offset in -n/2..n/2
```

Derive position, rotation, Z depth, dimming and shading from that one `rel`. Sorting swaps where cards really exchange order, with no teleport, opacity pop or extra sway at the seam. Keyframe Slide with sparse curves; keep demo keys on a separate switch so manual control works by default (`ae_get_skill({ name: "ae-clean-rig", reference: "references/editable-rigs.md" })`).

Expose only layout controls that matter: Gap, Spacing, Tilt, Side Angle, Depth, Bend Radius. `egp.add_property` can surface Slide to a parent comp; card media still needs unique sources.

## Curved gallery

Center card fully readable; side cards follow the measured fan and perspective. Surrounding headings stay live text. Test the largest and smallest visible card with real images: a good source can still crop badly at the edge.

## Coverflow

- Real 3D card planes: `transform.set` with `threeDLayer: true` per card instance.
- Keep the front-facing center card and the measured side rotation, spacing and overlap. Captions and bottom shading are native; side dimming is one restrained control.
- For a rounded stage on a larger background, put the 3D scene in a stage precomp and clip at the parent level. Do not flatten the cards.
- Create the camera inside the stage (`layer.create_camera`), name it in the guide, and leave its Position and Orientation free of expressions.

## Loop with straight runs and tight bends

- Model the real path: measure each straight run and each bend and keep those ratios.
- Drive travel by arc length so spacing and speed stay uniform; a raw curve parameter is not.
- Orientation comes from the path tangent; confirm the rotation sign and inspect the joins.
- Each card stays its own object and content comp. Rigid loops need rigid cards. A texture sliding over static surfaces is not a slider.
- Hidden faces can still occlude at zero opacity. Zero scale removed one in a tested setup; re-check per renderer (`comp.list_renderers`).
- Camera control stays separate from Slide. Test from a modest alternate angle.

## Verify

Render with `ae_render_frame` and look at every result:

- Slide at an integer, a fraction (2.5), a negative value, and past `n`.
- The loop seam and one full cycle, forward and reverse.
- A short manual key sequence (`keyframe.set_batch` on the Slide slider) at playback speed.
- A camera move, when there is a camera.
- One card swapped to an image of the opposite aspect ratio; one caption made longer; the other cards unchanged.
- Restore the originals afterward and state any layout limit that is genuinely fixed.
