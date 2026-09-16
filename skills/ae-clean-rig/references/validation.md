# Validation and delivery

A finished tool call is not a finished shot. Validation means rendered pixels compared against the intent, at the frames where things can go wrong.

## Which frames to render

| Frame                                         | Why                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| First visible frame of each element           | Reveals leak backward from the first key; hidden state must be explicit |
| Fastest motion                                | Motion blur, overshoot direction, strobing                              |
| Settle and final hold                         | Values land on the intended pose, nothing keeps drifting                |
| One frame each side of every cut or loop seam | Double visibility, one-frame holes, restarted motion                    |
| A mid-transition frame                        | Mattes, alpha and occlusion during the change                           |

Render with `ae_render_frame({ compNameOrId, time, outPath })` and look at every image. Render the top-level comp, not only the nested one you edited: parents change transforms, mattes and effect order.

## Compare, then check for regressions

Keep two comparisons separate:

- **Current render vs the reference or brief** answers "is it right".
- **Current render vs the previous saved render** answers "did anything else move". After changing a shared precomp, render every comp that uses it (`ae_do({ operation: "item.usages", args: { item: "Card" } })` lists them).

Sampled stills prove only the sampled frames. Say which times were checked.

## Expression and dependency checks

- After `expression.set`, read the property back with `ae_layer_info` and check `expressionError` on each touched property. Fix or remove a failing expression before rendering.
- `ae_do({ operation: "footage.list_missing" })` before delivery. Missing footage renders as color bars.
- `ae_do({ operation: "font.list_used" })` and confirm each font resolved; a substituted font changes widths and line breaks.
- Nested comps: confirm fps and duration match the parent where they must, and that no nested layer ends early (check `outPoint` against the parent's use).

## Resolution and format changes

Changing a comp's width and height is not an upgrade. When the user asks for a larger delivery:

1. Inspect nested comps and footage sizes; sources smaller than the new frame will soften.
2. Recheck stroke widths, effect radii, masks, anchor points and any absolute positions.
3. Keep the requested aspect ratio and fps; do not round them to a convention.
4. Render full-resolution frames, not half or quarter previews, before judging edges and gradients.

## Render queue deliveries

When a movie or sequence is requested: `render.add_to_queue`, `render.set_output`, `render.start`, then `render.status` until done. Verify the output file exists and has the expected size and duration before reporting it. A queued or started job is not a delivered file.

## Editability test

Where the user asked for a reusable rig, duplicate the comp, make one real edit (a longer label, a different image, a control at an extreme value), render it, then delete the duplicate. Report anything that did not survive the edit.

## Report honestly

State the saved path, the frames inspected, fonts or effects substituted, and any difference from the reference that remains. Do not describe a match as exact unless the compared frames support it. Keep the backup you saved before structural changes and name it in the report so the user has a way back.

## Verify

- Rendered frames exist on disk and were viewed, at the frames listed above.
- No `expressionError` on touched properties; no missing footage; fonts resolved.
- Project saved to the agreed path; backup path named; remaining gaps listed.
