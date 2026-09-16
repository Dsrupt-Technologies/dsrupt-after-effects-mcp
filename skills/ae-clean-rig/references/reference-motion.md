# Reference Motion

## Label every input

| Input                   | It proves                             | Use                          |
| ----------------------- | ------------------------------------- | ---------------------------- |
| Original reference      | The geometry and timing to reproduce  | Source of truth              |
| Approved earlier result | The baseline when no reference exists | Do not regress it            |
| Screenshot of a defect  | That something is wrong               | Never trace it as the target |

When stills disagree, the original video wins, together with whatever role the user assigned.

## Pin observations to real frames

- Note frame index and timestamp beside every observation.
- List real frames: `ffprobe -v error -select_streams v:0 -show_entries frame=pkt_pts_time,coded_picture_number -show_frames -of csv in.mp4`
- Pull exact indices in one pass: `ffmpeg -i in.mp4 -vf "select='eq(n,118)+eq(n,119)'" -vsync 0 f_%03d.png`
- Never seek and resample at a round fps; that silently duplicates or drops decisive frames. Variable frame rate: keep real timestamps.
- Extracted stills are analysis material, not artwork.

## Cuts and half-open intervals

- Per cut, note last outgoing frame, first incoming frame, any overlap.
- Intervals are half-open: last visible frame N puts the out-point at N+1.
- Map global time to layer time via start time, stretch and any time remap; a plain shot-start subtraction is only right for an unretimed instance.
- Render the boundary frames even when the numbers look right.

## Rebuild construction, keep the animation

1. Save a copy first (`ae_save_project` with a new path), then work in a clearly named duplicate of the comp (`comp.duplicate`).
2. Record poses, contacts, silhouette, entry and exit, holds, stepped events. A hard cut stays a cut.
3. Map components as described in `ae_get_skill({ name: "ae-clean-rig", reference: "references/construction.md" })`: one identity per moving part, shared motion on a parent null.
4. Carry existing keys, expressions, timing, layer order and masks onto the replacement: `ae_do({ operation: "keyframe.copy", args: { comp: "Main", layer: "OldLid", property: ["ADBE Transform Group", "ADBE Rotate Z"], targetLayer: "Lid" } })`
5. Validate one rest pose and one extreme pose before propagating.

## Sparse keys, deliberate curves

- Keys at anticipation, extrema, overshoot, settle and state changes only. Curve craft: `ae_get_skill({ name: "ae-animation" })`.
- Shape each key: `ae_do({ operation: "keyframe.set_easing", args: { comp: "Main", layer: "Lid", property: ["ADBE Transform Group", "ADBE Rotate Z"], keyIndex: 2, inSpeed: 0, outSpeed: 140, inInfluence: 33, outInfluence: 60 } })`; spatial tangents via `keyframe.set_spatial`.
- No key per frame, no every-Nth thinning, no blanket Easy Ease. Bake dense keys only on request.
- Check between keys: a skipped turnaround pose reverses an object early.

## Restraint

- Each motion cites a reference interval and visible evidence: direction, amplitude, phase, hold. Habit is not evidence.
- Do not invent wobble, breathing scale, rebounds or evolving noise. Ambiguous secondary motion stays still.
- One named control per cause: camera, object transform, deformation, illumination. A camera push must not also drift the background.

## Match cuts

- Inspect 6 to 12 real frames per side and the gesture at speed. Classify: continuous action, framing change, repeated gesture, unrelated cut.
- Continuous action resumes at the next trajectory sample. It must not repeat the last outgoing frame, restart from rest, or run twice.
- Compare projected position, size, orientation and velocity in the right coordinate space.
- Prefer one shared precomp with time offsets, or matched handoff keys with nonzero speed. An Easy Ease at the cut inserts a stop.
- Keep an intentional rest. Never hide a mismatch behind a dissolve, morph or fly-in.
- Hunt for one-frame holes, both layers visible at once, an incoming pose arriving early, source time reset to zero, and bounds shifted by fonts or anchor expressions.

## Verify

- `ae_render_frame` at N-1, N and N+1 around each cut in the top-level comp, and look at the images.
- Render a rest pose and an extreme pose; stills alone do not validate a match cut, so also watch a real-time preview.
- Record which cuts changed, which are deliberate, and what still differs. Full checklist: `ae_get_skill({ name: "ae-clean-rig", reference: "references/validation.md" })`.
