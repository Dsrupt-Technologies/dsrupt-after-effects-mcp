---
name: ae-animation
description: Timing, easing, anticipation, follow-through, reveals, motion expressions and proof frames for After Effects motion. Companion loaded through ae_get_skill when ae-clean-rig routes to it, not a starting point.
---

# Animation

The user's brief and the existing project win over every default below.

## Motion spec first

Before adding a keyframe, write one line per element: what moves and what stays still, when the beat starts and settles, why the viewer should notice. Stationary elements get no idle drift unless asked for. With reference footage, match it via `ae_get_skill({ name: "ae-clean-rig", reference: "references/reference-motion.md" })`.

## Timing in frames

Read the comp fps with `ae_comp_info`; state every duration in seconds and whole frames. Starting points at 30 fps, scaled by distance, size and style:

| Beat             | Frames   | Seconds      |
| ---------------- | -------- | ------------ |
| Snap             | 2 to 4   | 0.07 to 0.13 |
| Anticipation     | 4 to 6   | 0.13 to 0.20 |
| Quick transition | 8 to 12  | 0.27 to 0.40 |
| Slower entrance  | 18 to 30 | 0.60 to 1.00 |
| Settle           | 6 to 10  | 0.20 to 0.33 |

Hold text long enough to read at delivery size.

## Keyframes

- Few keys, each with a purpose.
- Ease where an object accelerates or comes to rest; keep deliberate linear motion (a scroll, a clock hand) linear.
- Temporal interpolation (speed over time) is separate from spatial tangents (path through space): `keyframe.set_easing` or `keyframe.set_interpolation` for the first, `keyframe.set_spatial` for the second.
- Anticipation is a small move against the coming direction. Overshoot and follow-through share one physical logic and decay; the last key is the rest pose.
- Parts of one gesture share one clock: `layer.set_parent` them. Stagger siblings by a few frames for reading order, never so far that the piece drags.

A 12-frame arrival at 30 fps on layer "Title":

```
ae_do({ operation: "keyframe.add", args: { comp: "Main", layer: "Title",
  property: ["ADBE Transform Group", "ADBE Position"], time: 0.5, value: [960, 1200] } })
ae_do({ operation: "keyframe.add", args: { comp: "Main", layer: "Title",
  property: ["ADBE Transform Group", "ADBE Position"], time: 0.9, value: [960, 540] } })
ae_do({ operation: "keyframe.set_easing", args: { comp: "Main", layer: "Title",
  property: ["ADBE Transform Group", "ADBE Position"], keyIndex: 2, preset: "easeIn" } })
```

Confirm presets and influence ranges with `ae_catalog({ category: "keyframe" })`. `batch.run` folds these into one round trip and one undo group, but earlier steps stay applied if a later one fails.

## Reveals

- A layer that appears late needs an explicit hidden state at the start (opacity 0, offscreen, or a later in-point). After Effects holds the first keyframe backward in time: a lone key at 2 s means visible from 0 s.
- Drawn lines: `shape.add_trim_paths`, animate its end. Wipes: `mask.add` plus `mask.set_path`, or `layer.set_track_matte`.
- Keep anchor points, text bounds and masks stable when text changes.

## Expressions

- Prefer native controls with units in their names; see `ae_get_skill({ name: "ae-clean-rig", reference: "references/sliders.md" })`.
- Gate automatic motion behind a checkbox so manual keyframes still work when it is off.
- No unbounded time-driven randomness: seed and bound any wiggle.
- Loops accepting negative input: `((x % n) + n) % n` with n > 0.
- Expressions are not ExtendScript: use `content("Group 1").content("Rectangle Path 1")` inside one; `property(...)` is script-side only.
- After `expression.set`, read the property back with `ae_layer_info` and check expressionError.

## Verify

Render with `ae_render_frame` at the start, the anticipation frame, the fastest frame, the overshoot peak, the settle and the last visible frame. For loops render both frames across the seam and compare velocity, not only position; watch for a duplicate held endpoint. Check motion blur at delivery settings. A still proves only its own frame.
