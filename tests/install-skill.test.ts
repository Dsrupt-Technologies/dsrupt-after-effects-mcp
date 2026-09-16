// The entry skill lands in the agents' skills folders, refreshes our own copy
// on rerun, and never overwrites a stranger's folder of the same name.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { installSkill, SKILL_NAME, skillTargets } from "../src/cli/install-skill.js";

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("installSkill", () => {
  it("copies the skill into every target and is idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "dsrupt-skill-"));
    scratch.push(root);
    const a = join(root, "a");
    const b = join(root, "b");
    const first = installSkill([a, b]);
    expect(first).toHaveLength(2);
    for (const base of [a, b]) {
      const skill = readFileSync(join(base, SKILL_NAME, "SKILL.md"), "utf8");
      expect(skill).toContain(`name: ${SKILL_NAME}`);
      expect(skill).toContain("ae_get_skill");
      expect(readFileSync(join(base, SKILL_NAME, "agents", "openai.yaml"), "utf8")).toContain(
        "display_name",
      );
    }
    expect(installSkill([a])).toHaveLength(1);
  });

  it("leaves a foreign skill of the same name alone", () => {
    const root = mkdtempSync(join(tmpdir(), "dsrupt-skill-"));
    scratch.push(root);
    const dest = join(root, SKILL_NAME);
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "SKILL.md"), "---\nname: something-else\n---\nuser skill\n");
    const report = installSkill([root]);
    expect(report[0]).toMatch(/skipped/);
    expect(readFileSync(join(dest, "SKILL.md"), "utf8")).toContain("user skill");
  });

  it("lists the Codex and Claude Code folders plus DSRUPT_SKILLS_DIRS", () => {
    const targets = skillTargets("/home/x", { DSRUPT_SKILLS_DIRS: "/opt/skills" });
    expect(targets).toEqual(["/home/x/.agents/skills", "/home/x/.claude/skills", "/opt/skills"]);
  });
});
