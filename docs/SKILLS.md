# Skills: how they are served and how to edit them

## Progressive disclosure

The agent never needs the whole corpus in context:

```text
ae_get_skill({})                                             -> index: names, one-line descriptions, reference lists
ae_get_skill({ name: "ae-clean-rig" })                       -> that skill's SKILL.md
ae_get_skill({ name: "ae-clean-rig", reference: "references/sliders.md" })  -> one reference
```

`ae-clean-rig` is the entry point. Its routing table names the reference or companion skill
for each kind of task, so a typical session loads the index, the entry skill and one or two
references: a few thousand tokens rather than the full corpus.

## Layout

```text
skills/
  manifest.json                 generated; the index plus a SHA-256 per document
  ae-clean-rig/
    SKILL.md                    entry skill with YAML frontmatter (name, description)
    references/*.md             loaded on demand
  ae-animation/SKILL.md
  ae-ui/SKILL.md
  ae-depth/SKILL.md
  ae-transitions/SKILL.md
  ae-mcp-realities/
    SKILL.md
    references/errors.md
    references/tools.md
```

Rules enforced by `npm run skills:check`:

- Directory names are kebab-case and match the `name:` in the frontmatter.
- Only `SKILL.md` and `references/**/*.md` (lowercase, kebab-case) are served.
- Descriptions stay under 60 words; they are the index the agent reads first.
- Every `ae_*` name is a real tool of this server; every `` `category.operation` `` in
  backticks is a real catalogued operation.
- Relative links resolve inside the same skill, and every `reference: "..."` in an
  `ae_get_skill` example exists.
- No third-party product names from the reference material, no em or en dashes.

## Editing

1. Edit or add files under `skills/`.
2. `npm run skills:manifest` to regenerate `skills/manifest.json`. The runtime refuses to serve
   a document whose hash differs from the manifest, so a forgotten regeneration shows up
   immediately (`doctor` reports it too).
3. `npm run build && npm run skills:check`.
4. Commit the manifest together with the documents.

## Writing guidance

- Imperative, concrete, short. Tables for decisions, bullets for steps, one example call per
  operation you name, taken from `ae_catalog` output.
- Every document ends with a **Verify** section: what to render or inspect before reporting.
- Facts about the runtime (undo groups, batch semantics, timeouts, error codes) belong in
  `ae-mcp-realities`; creative guidance belongs in the topic skills; the entry skill only
  routes and states the rules that never bend.
- Keep a document under about 600 words. If it grows, split a reference.
