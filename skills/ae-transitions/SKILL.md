---
name: ae-transitions
description: Reusable transition comps with replaceable A and B sources, progress and style controls on a null, and seam testing. Companion loaded through ae_get_skill when ae-clean-rig routes to it, not a starting point.
---

# Transitions

The user's brief and the existing project win over every default below.

## Structure

- One transition comp holding two placeholder layers: A (outgoing) and B (incoming). Each is a precomp or footage layer that `layer.replace_source` can swap without touching keys or expressions.
- Fix the duration up front in frames at the comp fps (`ae_comp_info`).
- Boundary invariant: before the first frame only A is visible; after the last frame only B; no ghosting, no gap.
- When reused at a cut, A's last frame and B's first frame must agree with the neighbouring scenes in placement, opacity and motion.

## Controls

Create a null (`layer.create_null`, name "Transition CTRL") and add native controls with `effect.add`; find slider, checkbox and dropdown matchNames with `project.list_effects`.

| Control       | Type               | Range     | Role                                   |
| ------------- | ------------------ | --------- | -------------------------------------- |
| Progress      | slider             | 0 to 100  | manual position through the transition |
| Direction     | dropdown or slider | 0 to 3    | which side the motion comes from       |
| Edge Softness | slider             | 0 to 100  | feather at the A/B boundary            |
| Auto Play     | checkbox           | on/off    | drive Progress from time when on       |
| Style         | one or two sliders | as needed | angle, bend, shadow strength           |

- Express every distance as a fraction of `thisComp.width` and `thisComp.height`, never in pixels, so the rig survives a resolution change.
- Keep manual progress and automatic playback separate. Auto Play off: the Progress slider and any keys on it rule. On: an expression maps layer time across the duration.
- Out-of-range input: `clamp(p, 0, 100)` for a one-shot; wrap with `((p % 100) + 100) % 100` only for an intended loop. Test with -20 and 140.

## Construction

Run `ae_catalog({})` first and pick from what exists in this server and version.

| Look                                   | Construction                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Wipe, slide, push                      | 2D position plus masks (`mask.add`, `mask.set_path`) driven by the controls                        |
| Dimensional door, card flip, page peel | 3D layers (`transform.set` with threeDLayer), `layer.create_camera`, `comp.set_renderer` if needed |
| Flat door, card or peel                | 2D mattes via `layer.set_track_matte`, no camera                                                   |
| Shape-driven reveal                    | shape matte from `shape.add_rect` or `shape.add_path`                                              |

Keep the content rig (A, B, mattes, control null) independent of decorative shading (gradients, shadows, glints) so shading can be restyled without breaking the wipe. Never flatten A and B into one pre-rendered clip when editability is wanted. Rig conventions: `ae_get_skill({ name: "ae-clean-rig", reference: "references/editable-rigs.md" })`.

## Verify

Render with `ae_render_frame` at Progress 0, midpoint and 100, plus the frame before the transition starts (only A), the frame after it ends (only B), and the first and last frames inside it. Swap A and B with `layer.replace_source` using different aspect ratios and longer sources, then re-render the same set. Inspect for crop, alpha (no stray transparency at edges), overlap (no double image where A meets B) and motion blur at real output settings (`comp.set_props` with motionBlur and shutterAngle). A completed call is not proof; a viewed frame is.
