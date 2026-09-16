// The skill store and ae_get_skill: served progressively, never reaching
// After Effects, and refusing anything the manifest does not list.

import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SkillLookupError, SkillStore } from "../src/skills.js";
import { getSkillTool } from "../src/tools/get-skill.js";
import { ALL_TOOLS } from "../src/tools/index.js";
import { McpTestClient } from "./harness.js";
import { nullTransport } from "./helpers/null-transport.js";

export const BUNDLED_SKILLS = [
  "ae-animation",
  "ae-clean-rig",
  "ae-depth",
  "ae-mcp-realities",
  "ae-transitions",
  "ae-ui",
];

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copyOfBundle(): string {
  const dir = mkdtempSync(join(tmpdir(), "dsrupt-skills-"));
  scratch.push(dir);
  cpSync(resolve("skills"), dir, { recursive: true });
  return dir;
}

describe("SkillStore", () => {
  it("indexes the bundled skills with descriptions and reference lists", () => {
    const index = new SkillStore().index();
    expect(index.skills.map((s) => s.name)).toEqual(BUNDLED_SKILLS);
    const rig = index.skills.find((s) => s.name === "ae-clean-rig")!;
    expect(rig.description.length).toBeGreaterThan(20);
    expect(rig.references).toContain("references/sliders.md");
    expect(rig.references).toContain("references/validation.md");
    // The index never carries document bodies: that is the whole point.
    expect(JSON.stringify(index)).not.toContain("## ");
  });

  it("serves the entry and one reference at a time, verifying hashes", () => {
    const store = new SkillStore();
    const entry = store.read("ae-clean-rig");
    expect(entry.document).toBe("SKILL.md");
    expect(entry.content).toMatch(/^---\nname: ae-clean-rig\n/);
    expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    const ref = store.read("ae-clean-rig", "references/sliders.md");
    expect(ref.document).toBe("references/sliders.md");
    expect(ref.content).toMatch(/^# /);
    expect(ref.content).not.toBe(entry.content);
  });

  it("every bundled document reads back and names only real tools", () => {
    const store = new SkillStore();
    const tools = new Set(ALL_TOOLS.map((t) => t.name));
    const verified = store.verifyAll();
    expect(verified.skills).toBe(BUNDLED_SKILLS.length);
    expect(verified.documents).toBeGreaterThan(BUNDLED_SKILLS.length);
    for (const skill of store.manifest.skills) {
      for (const doc of ["SKILL.md", ...skill.references]) {
        const { content } = store.read(skill.name, doc);
        expect(content.length).toBeGreaterThan(200);
        for (const m of content.matchAll(/\bae_[a-z_]+\b/g)) {
          expect(tools.has(m[0]), `${skill.name}/${doc} names ${m[0]}`).toBe(true);
        }
        expect(content, `${skill.name}/${doc}`).not.toMatch(/higgsfield|\bfnf\b/i);
      }
    }
  });

  it("rejects unknown skills with a suggestion", () => {
    const store = new SkillStore();
    expect(() => store.read("ae-clean-rg")).toThrow(SkillLookupError);
    try {
      store.read("ae-clean-rg");
    } catch (err) {
      expect((err as SkillLookupError).suggestion).toBe("ae-clean-rig");
    }
    for (const name of ["__proto__", "../ae-clean-rig", "constructor"]) {
      expect(() => store.read(name)).toThrow(/unknown skill/);
    }
  });

  it.each([
    "../../package.json",
    "/etc/passwd",
    "references/../../../package.json",
    "references/sliders.md/",
    "SKILL.MD",
    "references%2Fsliders.md",
  ])("refuses unlisted reference %s", (reference) => {
    expect(() => new SkillStore().read("ae-clean-rig", reference)).toThrow(/no reference/);
  });

  it("refuses a document whose bytes no longer match the manifest", () => {
    const dir = copyOfBundle();
    writeFileSync(
      join(dir, "ae-clean-rig", "SKILL.md"),
      "---\nname: ae-clean-rig\ndescription: x\n---\nedited\n",
    );
    expect(() => new SkillStore(dir).read("ae-clean-rig")).toThrow(
      /does not match the manifest hash/,
    );
  });

  it("refuses a manifest that lists a skill twice", () => {
    const dir = copyOfBundle();
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFile(manifestPath)) as { skills: unknown[] };
    manifest.skills.push(manifest.skills[0]);
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(() => new SkillStore(dir)).toThrow(/twice/);
  });
});

function readFile(p: string): string {
  // Small local helper so the test reads like prose above.
  return require("node:fs").readFileSync(p, "utf8") as string;
}

describe("ae_get_skill", () => {
  it("never touches the transport", async () => {
    const transport = nullTransport();
    expect((await getSkillTool.handler({}, transport)).isError).toBe(false);
    expect((await getSkillTool.handler({ name: "ae-clean-rig" }, transport)).isError).toBe(false);
    expect(
      (
        await getSkillTool.handler(
          { name: "ae-clean-rig", reference: "references/sliders.md" },
          transport,
        )
      ).isError,
    ).toBe(false);
    expect(transport.calls).toHaveLength(0);
  });

  it("returns INVALID_ARGS for a reference without a name, and for unknown names", async () => {
    const transport = nullTransport();
    const noName = await getSkillTool.handler({ reference: "references/sliders.md" }, transport);
    expect(noName.isError).toBe(true);
    expect(noName.content[0]).toMatchObject({ text: expect.stringContaining("[INVALID_ARGS]") });
    const unknown = await getSkillTool.handler({ name: "nope" }, transport);
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0]).toMatchObject({ text: expect.stringContaining("[INVALID_ARGS]") });
    expect(transport.calls).toHaveLength(0);
  });

  it("is served over stdio in read-only mode with After Effects absent", async () => {
    const client = new McpTestClient();
    await client.connect({ AE_MCP_READONLY: "1" });
    try {
      const index = await client.call<{ skills: Array<{ name: string }> }>("ae_get_skill");
      expect(index.skills.map((s) => s.name)).toEqual(BUNDLED_SKILLS);
      const entry = await client.call<{ content: string; references: string[] }>("ae_get_skill", {
        name: "ae-clean-rig",
      });
      expect(entry.content).toContain("# After Effects through Dsrupt");
      expect(entry.references).toContain("references/scripting.md");
      const ref = await client.call<{ document: string }>("ae_get_skill", {
        name: "ae-mcp-realities",
        reference: "references/errors.md",
      });
      expect(ref.document).toBe("references/errors.md");
      expect(await client.callExpectError("ae_get_skill", { name: "missing" })).toContain(
        "[INVALID_ARGS]",
      );
    } finally {
      await client.close();
    }
  });
});
