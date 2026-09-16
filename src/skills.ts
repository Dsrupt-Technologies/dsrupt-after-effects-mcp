// Skills served through MCP, progressively.
//
// The agent should never need the whole corpus in context. It asks for the
// index (names + one-line descriptions + reference lists), then one skill's
// SKILL.md, then one reference at a time. The manifest is what makes the
// index cheap: it is generated from the files on disk (scripts/
// generate-skills-manifest.mjs) and carries a hash per document so a
// tampered or half-edited bundle is reported instead of served.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { PACKAGE_ROOT } from "./config.js";
import { suggestName } from "./opschema.js";

export const SKILLS_DIR = path.join(PACKAGE_ROOT, "skills");
export const ENTRY_DOCUMENT = "SKILL.md";

const skillName = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const referencePath = z.string().regex(/^references\/[a-z0-9][a-z0-9/_-]*\.md$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const manifestSchema = z.object({
  version: z.literal(1),
  skills: z
    .array(
      z.object({
        name: skillName,
        description: z.string().min(1),
        references: z.array(referencePath),
        sha256: z.record(z.string(), sha256),
      }),
    )
    .min(1),
});

export type SkillManifest = z.infer<typeof manifestSchema>;
export type SkillEntry = SkillManifest["skills"][number];

/** A caller mistake (bad name or reference), as opposed to a broken bundle. */
export class SkillLookupError extends Error {
  constructor(
    message: string,
    readonly suggestion: string | null = null,
  ) {
    super(message);
    this.name = "SkillLookupError";
  }
}

export interface SkillDocument {
  name: string;
  document: string;
  content: string;
  sha256: string;
  references: string[];
}

export class SkillStore {
  readonly root: string;
  readonly manifest: SkillManifest;
  private readonly byName: Map<string, SkillEntry>;

  constructor(root: string = SKILLS_DIR) {
    this.root = realpathSync(root);
    const raw = readFileSync(path.join(this.root, "manifest.json"), "utf8");
    this.manifest = manifestSchema.parse(JSON.parse(raw));
    this.byName = new Map();
    for (const skill of this.manifest.skills) {
      if (this.byName.has(skill.name))
        throw new Error(`skills manifest lists '${skill.name}' twice`);
      if (!Object.hasOwn(skill.sha256, ENTRY_DOCUMENT)) {
        throw new Error(`skills manifest has no ${ENTRY_DOCUMENT} hash for '${skill.name}'`);
      }
      for (const ref of skill.references) {
        if (!Object.hasOwn(skill.sha256, ref)) {
          throw new Error(`skills manifest has no hash for '${skill.name}/${ref}'`);
        }
      }
      this.byName.set(skill.name, skill);
    }
  }

  names(): string[] {
    return this.manifest.skills.map((s) => s.name);
  }

  index(): {
    skills: Array<{ name: string; description: string; references: string[] }>;
    usage: string;
  } {
    return {
      skills: this.manifest.skills.map(({ name, description, references }) => ({
        name,
        description,
        references,
      })),
      usage:
        "ae_get_skill({ name }) returns that skill's entry document; " +
        "ae_get_skill({ name, reference }) returns one listed reference. " +
        "Load only what the current task needs.",
    };
  }

  read(name: string, document: string = ENTRY_DOCUMENT): SkillDocument {
    const skill = this.byName.get(name);
    if (!skill) {
      const suggestion = suggestName(name, this.names());
      throw new SkillLookupError(
        `unknown skill '${name}'.` +
          (suggestion ? ` Did you mean '${suggestion}'?` : "") +
          " Call ae_get_skill with no arguments for the index.",
        suggestion,
      );
    }
    if (document !== ENTRY_DOCUMENT && !skill.references.includes(document)) {
      const suggestion = suggestName(document, skill.references);
      throw new SkillLookupError(
        `'${name}' has no reference '${document}'.` +
          (suggestion ? ` Did you mean '${suggestion}'?` : "") +
          ` Listed references: ${skill.references.join(", ") || "(none)"}`,
        suggestion,
      );
    }
    const file = realpathSync(path.join(this.root, name, document));
    const rel = path.relative(this.root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`skill document resolves outside the skills directory: ${file}`);
    }
    const bytes = readFileSync(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== skill.sha256[document]) {
      throw new Error(
        `skill document '${name}/${document}' does not match the manifest hash. ` +
          "The bundle was edited or damaged: run `npm run skills:manifest` after editing skills, or reinstall.",
      );
    }
    return {
      name,
      document,
      content: bytes.toString("utf8"),
      sha256: digest,
      references: skill.references,
    };
  }

  /** Reads every document once; throws on the first broken one. Used by the doctor. */
  verifyAll(): { skills: number; documents: number } {
    let documents = 0;
    for (const skill of this.manifest.skills) {
      this.read(skill.name);
      documents++;
      for (const ref of skill.references) {
        this.read(skill.name, ref);
        documents++;
      }
    }
    return { skills: this.manifest.skills.length, documents };
  }
}
