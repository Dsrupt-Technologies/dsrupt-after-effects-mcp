// Put the agent-facing entry skill where local agents look for skills, so a
// future session knows this server exists before it is asked. The skill is a
// pointer: every real instruction is served by ae_get_skill.
//
// Copied, not symlinked: symlinks need privileges on Windows, and a copy
// survives the checkout moving. Re-running refreshes our copy; a folder of
// the same name that we did not write is left alone.

import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PACKAGE_ROOT } from "../config.js";

export const SKILL_NAME = "dsrupt-after-effects";
export const SKILL_SOURCE = path.join(PACKAGE_ROOT, "agent-skill", SKILL_NAME);

/** Skills directories the common local agents read, whichever exist or are asked for. */
export function skillTargets(
  home: string = os.homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const targets = [
    path.join(home, ".agents", "skills"), // Codex / ChatGPT desktop
    path.join(home, ".claude", "skills"), // Claude Code
  ];
  const extra =
    env.DSRUPT_SKILLS_DIRS?.split(path.delimiter)
      .map((d) => d.trim())
      .filter(Boolean) ?? [];
  return [...targets, ...extra];
}

function isOurs(dir: string): boolean {
  try {
    return readFileSync(path.join(dir, "SKILL.md"), "utf8").includes(`name: ${SKILL_NAME}`);
  } catch {
    return false;
  }
}

export function installSkill(targets: string[] = skillTargets()): string[] {
  if (!existsSync(path.join(SKILL_SOURCE, "SKILL.md"))) {
    throw new Error(`skill source missing: ${SKILL_SOURCE}`);
  }
  const report: string[] = [];
  for (const base of targets) {
    const dest = path.join(base, SKILL_NAME);
    if (existsSync(dest) && !isOurs(dest)) {
      report.push(`skipped ${dest}: a different skill already lives there`);
      continue;
    }
    mkdirSync(base, { recursive: true });
    cpSync(SKILL_SOURCE, dest, { recursive: true });
    report.push(`${existsSync(dest) ? "installed" : "installed"} ${dest}`);
  }
  return report;
}
