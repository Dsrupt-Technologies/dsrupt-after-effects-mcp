# Media

This server drives After Effects. It generates no images or video, downloads nothing, and holds no provider account. Plates come from the user, the project, or a generation connector in the same session.

## Where the plate comes from

| Situation                                                 | Do                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| The user supplied it                                      | Use it as given. An unrelated fix is never a reason to regenerate approved media.                                  |
| It already exists in the project                          | Find it with `item.list`, reuse that footage item, and swap only the piece the request actually names.             |
| It must be created and the Dsrupt connector is connected  | Plan the shots through its planning guide and brand guidelines, generate there, import with `project.import_file`. |
| It must be created and no generation connector is present | Say so plainly, list the shots needed, and carry on with all AE work that has no dependency on those plates.       |

- Never present a placeholder solid or a screenshot as final media. A still with an invented pan is no substitute for a real camera move.
- Build the rig ahead of the plate with `project.import_placeholder`, then relink: `ae_do({ operation: "footage.replace", args: { item: "Hero Plate", path: "/abs/path/hero_plate.mp4" } })`

## Describe each shot

- Subject, framing and composition; light; how the camera moves; how the subject moves; duration; entry pose; exit pose.
- Ask for a clean plate: no baked-in text, logos or UI. Those stay native and editable in AE above the media.
- Match the comp's aspect ratio and frame rate; request slightly more duration than the cut needs.
- Do not name a specific model; describe the shot and let the connector's plan choose.

## Verify what came back

- Read real dimensions and duration after import (`ae_project_info` or `item.list`); the request wording proves nothing.
- Play the whole clip and render a few frames with `ae_render_frame`; look for unwanted motion, temporal defects and burned-in text.
- Conform frame rate or alpha only when needed: `footage.interpret`. Import timeouts and other transport quirks: `ae_get_skill({ name: "ae-mcp-realities" })`.

## Package

- One named, replaceable media precomp per plate (`comp.precompose`), editable text and graphics above it, exposed as described in `ae_get_skill({ name: "ae-clean-rig", reference: "references/editable-rigs.md" })`.
- Frame for the actual crop: keep faces and key details inside, and review the plate inside the animated card.
- Replacing only the image keeps text, corner radius, shading and timing: `layer.replace_source`.
- Generated scene content is raster. Say so.

## Media manifest

| Field                            | Content                                                 |
| -------------------------------- | ------------------------------------------------------- |
| filename                         | Local relative path                                     |
| purpose                          | Card, shot or role                                      |
| provider and model               | What actually produced it, as reported by the connector |
| requested settings               | Resolution, duration, aspect, reference inputs          |
| returned dimensions and duration | Measured after import                                   |
| generation id                    | When one exists                                         |
| source                           | User supplied, project, or generated                    |

Never store credentials, access tokens or expiring signed URLs. Keep font names and licence terms separate from imagery.

## Verify

- `ae_render_frame` of each media precomp alone and inside its parent card.
- Manifest dimensions and duration match `ae_project_info`.
- No text, logo or UI baked into any plate.
- Every plate is a footage item, not a solid or a screenshot.
