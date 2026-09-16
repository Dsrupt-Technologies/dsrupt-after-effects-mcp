#!/usr/bin/env node
// Build skills/manifest.json from the files under skills/.
//
// The manifest is what ae_get_skill serves as its index, so it must be
// regenerated whenever a skill document changes: each document's SHA-256 is
// recorded and the runtime refuses to serve a document that no longer
// matches. `--check` fails when the committed manifest is stale.

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_DIR = resolve(fileURLToPath(import.meta.url), "../../skills");
const MANIFEST = join(SKILLS_DIR, "manifest.json");
const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;
const REFERENCE = /^references\/[a-z0-9][a-z0-9/_-]*\.md$/;

const check = process.argv.includes("--check");
if (process.argv.slice(2).some((a) => a !== "--check")) {
  console.error("usage: node scripts/generate-skills-manifest.mjs [--check]");
  process.exit(2);
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function walkMarkdown(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir).toSorted()) {
    const full = join(dir, entry);
    const rel = prefix + entry;
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`symlinks are not allowed in skills/: ${full}`);
    if (stat.isDirectory()) out.push(...walkMarkdown(full, `${rel}/`));
    else if (entry.endsWith(".md")) out.push(rel);
  }
  return out;
}

export function buildManifest(root = SKILLS_DIR) {
  const skills = [];
  for (const name of readdirSync(root).toSorted()) {
    if (name === "manifest.json" || name.startsWith(".")) continue;
    const dir = join(root, name);
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink()) throw new Error(`symlinks are not allowed in skills/: ${dir}`);
    if (!stat.isDirectory()) throw new Error(`unexpected file in skills/: ${name}`);
    if (!SKILL_NAME.test(name)) throw new Error(`skill directory name must be kebab-case: ${name}`);
    const docs = walkMarkdown(dir);
    if (!docs.includes("SKILL.md")) throw new Error(`${name} has no SKILL.md`);
    const entry = readFileSync(join(dir, "SKILL.md"), "utf8");
    const frontmatter = entry.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter) throw new Error(`${name}/SKILL.md must start with YAML frontmatter`);
    const fmName = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (fmName !== name)
      throw new Error(`${name}/SKILL.md frontmatter name is '${fmName}', expected '${name}'`);
    if (!description) throw new Error(`${name}/SKILL.md frontmatter needs a description`);
    const references = [];
    const hashes = {};
    for (const doc of docs) {
      if (doc !== "SKILL.md") {
        if (!REFERENCE.test(doc)) {
          throw new Error(
            `${name}/${doc}: only SKILL.md and references/**/*.md (lowercase, kebab-case) are served`,
          );
        }
        references.push(doc);
      }
      hashes[doc] = sha256(join(dir, doc));
    }
    skills.push({ name, description, references, sha256: hashes });
  }
  if (skills.length === 0) throw new Error("no skills found");
  return { version: 1, skills };
}

const content = `${JSON.stringify(buildManifest(), null, 2)}\n`;
if (check) {
  let committed = "";
  try {
    committed = readFileSync(MANIFEST, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (committed !== content) {
    console.error(
      "skills/manifest.json is stale. Run `npm run skills:manifest` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`skills/manifest.json is current (${JSON.parse(content).skills.length} skills).`);
} else {
  writeFileSync(MANIFEST, content);
  console.log(`Wrote ${MANIFEST} (${JSON.parse(content).skills.length} skills).`);
}
