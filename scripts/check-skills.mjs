#!/usr/bin/env node
// Content checks over skills/: the things a stale or careless edit breaks
// that the manifest hash cannot see.
//
//   - every ae_* tool a document names is a real tool of this server
//   - every `category.operation` in backticks is a real operation
//   - every relative markdown link resolves inside the same skill
//   - no leftover third-party names, and no em/en dashes (house style)
//   - frontmatter descriptions stay short enough to be an index entry

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SKILLS_DIR = join(ROOT, "skills");
const DIST_TOOLS = join(ROOT, "dist", "tools", "index.js");
const DIST_OPS = join(ROOT, "dist", "operations", "index.js");
const DIST_REGISTRY = join(ROOT, "dist", "registry.js");

const BANNED = [/higgsfield/i, /\bfnf\b/i, /fnf-/i, /\bbridge\b/i, /devday/i, /—/, /–/];
const MAX_DESCRIPTION_WORDS = 60;

const errors = [];

let toolNames = null;
let opNames = null;
if (existsSync(DIST_TOOLS) && existsSync(DIST_OPS) && existsSync(DIST_REGISTRY)) {
  const { ALL_TOOLS } = await import(new URL(`file://${DIST_TOOLS}`).href);
  await import(new URL(`file://${DIST_OPS}`).href);
  const { listOps } = await import(new URL(`file://${DIST_REGISTRY}`).href);
  toolNames = new Set(ALL_TOOLS.map((t) => t.name));
  opNames = new Set(listOps().map((o) => o.name));
} else {
  console.warn(
    "dist/ not built: skipping tool and operation name checks (run npm run build first for the full check)",
  );
}

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir).toSorted()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* markdownFiles(full);
    else if (entry.endsWith(".md")) yield full;
  }
}

const skillDirs = readdirSync(SKILLS_DIR)
  .filter((d) => d !== "manifest.json" && statSync(join(SKILLS_DIR, d)).isDirectory())
  .toSorted();

for (const skill of skillDirs) {
  const dir = join(SKILLS_DIR, skill);
  for (const file of markdownFiles(dir)) {
    const rel = file.slice(SKILLS_DIR.length + 1);
    const text = readFileSync(file, "utf8");

    for (const pattern of BANNED) {
      const m = text.match(pattern);
      if (m) errors.push(`${rel}: contains banned text '${m[0]}'`);
    }

    if (rel.endsWith("SKILL.md")) {
      const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
      const description = fm?.[1].match(/^description:\s*(.+)$/m)?.[1] ?? "";
      const words = description.trim().split(/\s+/).filter(Boolean).length;
      if (words > MAX_DESCRIPTION_WORDS) {
        errors.push(
          `${rel}: description is ${words} words; keep it under ${MAX_DESCRIPTION_WORDS} so the index stays small`,
        );
      }
    }

    for (const m of text.matchAll(/\bae_[a-z_]+\b/g)) {
      if (toolNames && !toolNames.has(m[0])) errors.push(`${rel}: names unknown tool ${m[0]}`);
    }

    if (opNames) {
      const categories = new Set([...opNames].map((o) => o.split(".")[0]));
      for (const m of text.matchAll(/`([a-z]+\.[a-z_]+)`/g)) {
        const candidate = m[1];
        // Only names in a real category count; `comp.frameRate` in prose is AE API, not an operation.
        if (categories.has(candidate.split(".")[0]) && !opNames.has(candidate)) {
          errors.push(`${rel}: names unknown operation ${candidate}`);
        }
      }
    }

    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = m[1];
      if (/^[a-z]+:/.test(link) || link.startsWith("#")) continue;
      const target = resolve(dirname(file), link.split("#")[0]);
      if (!target.startsWith(dir) || !existsSync(target))
        errors.push(`${rel}: broken link ${link}`);
    }

    for (const m of text.matchAll(/reference:\s*"(references\/[^"]+)"/g)) {
      const skillRef = text
        .slice(Math.max(0, m.index - 80), m.index)
        .match(/name:\s*"([a-z0-9-]+)"/);
      const targetSkill = skillRef?.[1] ?? skill;
      if (!existsSync(join(SKILLS_DIR, targetSkill, m[1]))) {
        errors.push(
          `${rel}: ae_get_skill reference '${m[1]}' does not exist in skill '${targetSkill}'`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Checked ${skillDirs.length} skills: no banned text, links resolve, tool and operation names are real.`,
);
