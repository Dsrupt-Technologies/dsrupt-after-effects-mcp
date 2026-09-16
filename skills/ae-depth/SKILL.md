---
name: ae-depth
description: Companion skill for depth and parallax in After Effects, covering native 3D versus layered 2D, depth planes, shadows, perspective, a zero-safe parallax control and glass surfaces. Load through ae_get_skill only when ae-clean-rig routes here; it is not a starting point.
---

# Depth and space

## Pick the representation

| Scene                                              | Representation                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Cards, flat text, two or three illustration planes | Layered 2D: position and scale offsets, no camera                     |
| Perspective rotation, parallax across many planes  | Native 3D: `transform.set` with `threeDLayer: true` plus a camera     |
| Extruded or mesh geometry                          | `comp.set_renderer` to `advanced3d`; read `comp.list_renderers` first |

Check `ae_catalog({ category: "layer" })` for `layer.create_camera` before relying on it. Never add a camera just to slide flat text; a position offset does that.

## Depth planes

Assign each layer a plane and keep its cues consistent. Starting points only:

| Plane | Parallax travel   | Saturation cut | Haze      | Detail         |
| ----- | ----------------- | -------------- | --------- | -------------- |
| Far   | 20 to 30% of near | 30 to 50%      | about 30% | blur 4 to 8 px |
| Mid   | 50 to 70%         | 15%            | about 15% | slight blur    |
| Near  | 100%              | 0              | 0         | sharp          |

Saturation and blur come from `effect.add` (match names via `project.list_effects`); haze is a background-colored solid at low opacity. Match the reference and never wash out readable text.

## Shadows

- Contact shadow: tight, dark, small offset, where surfaces touch.
- Separation shadow: broader, softer, lower opacity, for lifted elements.
- One light direction per comp, stored on the controller and referenced from every shadow expression.
- Build with a Drop Shadow effect or a blurred duplicate shape.
- Re-check after `layer.set_parent` and `comp.precompose`; both change where the shadow lands.

## Rotation and perspective

- Anchor rigid objects first: `transform.set` with `anchorPoint` at the pivot, then rotate.
- Real perspective comes from a camera or `layer.calculate_transform` mapping three corners. Never fake it with skew.
- Cross nested spaces with `layer.convert_point`.

## Parallax control

1. Controller null, `effect.add` with a Slider control named `Depth`.
2. Per layer, via `expression.set`: position = base + parallaxVector _ planeFactor _ (Depth / 100).
3. Keep base positions as literal values, never accumulated, so Depth 0 returns exactly to the flat layout.

Render at Depth 0, 100 and 150; look for uncovered edges, oversized near elements and clipping by precomp bounds or masks. Camera drift only when asked, and small.

## Motion blur

When motion warrants it, set `motionBlur` and `shutterAngle` through `comp.set_props` and the per-layer switch through `layer.set_props` (check its schema). Render at real settings and inspect thin strokes and text.

## Glass surfaces

Glass reacts to what sits behind it: slight distortion, a lit edge, restrained tint, a contact shadow. A translucent white rectangle is not glass. Confirm each effect by match name in `project.list_effects` before building, one effect at a time with a render between. Mattes (`layer.set_track_matte`) and alpha must survive `layer.move` and `comp.precompose`: no helper layer leaks, and the inverted hole cuts the right region.

## Verify

- Frames at Depth 0 (pixel-identical to the flat layout), 100 and 150.
- One mid-motion frame with motion blur on: strokes and text still legible.
- Shadow direction consistent after parenting or precomposing.
- Glass edge crop over a bright and a dark background.
