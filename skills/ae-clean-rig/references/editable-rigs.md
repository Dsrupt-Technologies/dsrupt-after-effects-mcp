# Editable rigs and exposed controls

## What editable actually means

Native layers alone prove nothing. A project is editable when:

- Each component has one named source for its wording, color, geometry or replaceable media.
- Shared movement lives on a parent null, not copied into every child.
- Visual copies (shadow, echo, reflection) read from that single source through an expression.
- Layout follows content: bounds, anchors, padding and media fitting update with the text or image. Measure with `layer.bounds` and `text.measure`, never hard-code.
- A routine edit never requires repairing hidden copies or dependent keys.

Many simple circles as particles is fine. One object's surface made of traced fragments is not.

## The controller null

```
ae_do({ operation: "layer.create_null", args: { comp: "Main", name: "CTRL" } })
ae_do({ operation: "effect.add", args: { comp: "Main", layer: "CTRL", matchName: "ADBE Slider Control", name: "Look (deg, -45..45)" } })
ae_do({ operation: "effect.add", args: { comp: "Main", layer: "CTRL", matchName: "ADBE Color Control", name: "Accent Color" } })
ae_do({ operation: "effect.add", args: { comp: "Main", layer: "CTRL", matchName: "ADBE Checkbox Control", name: "Demo Playback" } })
```

- Everyday controls first; units, default and range go in the name or a comp comment (`item.set_props`).
- Read it in an expression: `thisComp.layer("CTRL").effect("Look (deg, -45..45)")("Slider")`.
- Expose top-level controls as Essential Properties on the parent instance via `egp.add_property`.

| Control kind      | Lives                               | User must know                             |
| ----------------- | ----------------------------------- | ------------------------------------------ |
| Source default    | Inside the master comp              | Changes every instance without an override |
| Instance override | On the instance layer in the parent | Wins; editing the source then looks broken |

Say which kind each control is.

## Independent media sources

`comp.duplicate` copies the master but not its nested comps and footage, so two "independent" sets end up sharing images.

- Separate CONTENT comps per independent set. Share a source only where a change should propagate.
- Enumerate consumers first: `ae_do({ operation: "item.usages", args: { item: "Card CONTENT" } })`.
- Test by replacing one item and checking that another did not change.

## Manual control versus demo playback

- Manual control works by default. Keyframing Slide or Look must never compete with a time-driven expression.
- Demo motion sits behind a checkbox or on its own layer, so it switches off without deleting anything.
- One shared phase control drives all parts of a gesture; no per-sublayer timers.
- Keep the user's existing keys when applying cosmetic fixes.

## Additive automatic motion

Automatic motion goes on a parent or helper so the layer's own transform stays keyable. If the rig must drive that same property, combine an authored neutral with the raw value:

- Position and Rotation: `value + offset`, same dimensions, one declared coordinate space.
- Scale: component-wise ratio against a nonzero neutral, e.g. `[value[0] * s, value[1] * s]`.
- Never measure the currently animated bounds to redefine the neutral.

```
ae_do({ operation: "expression.set", args: { comp: "Main", layer: "Hero", property: ["ADBE Transform Group", "ADBE Position"], expression: "var c = thisComp.layer(\"CTRL\").effect(\"Bob (px)\")(\"Slider\"); value + [0, c * Math.sin(time * Math.PI)]" } })
```

A Source Text expression that always rewrites the string destroys manual edits. Make it conditional or drive a separate visible layer.

## Reusing a shared source across scenes

Before replacing a shared source, inspect every instance: time remapping, the source time each expects, per-instance overrides. A montage sampling time zero expects a complete character; an entrance that starts empty erases it with no error. Keep pose sources separate from entrance choreography and check each consumer at its visible time.

## A readable main comp

Semantic object precomps, a handful of controls, a camera when relevant, background layers. Mark helpers shy (`layer.set_props` with `shy: true`) without hiding needed controls. Shared motion libraries must be real project dependencies.

## Test one real edit before delivery

1. `comp.duplicate` the master as `TEST_edit`.
2. Make a real change: `text.set_content` with a longer phrase, a color control, or `layer.replace_source` with another image.
3. `ae_render_frame` during an animated pose; confirm dependent elements still align. Also move the instance by a known amount, confirm the visible change, restore.
4. `comp.delete` the test comp. Report anything baked or fixed that blocks an edit.

## Verify

- `ae_layer_info` on CTRL: controls named with units, sensible defaults, no orphans.
- Render with demo off: neutral pose, and manual keys move it.
- Render after the test edit: text fits, backgrounds hug the label, no unrelated card changed.
- `item.usages` on each content comp: exactly the intended consumers.

Worked controller: `ae_get_skill({ name: "ae-clean-rig", reference: "references/sliders.md" })`.
