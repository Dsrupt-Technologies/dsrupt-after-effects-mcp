#!/usr/bin/env node
// Prove the packed tarball works on its own: pack, install into a throwaway
// prefix, run the CLI from there, start the server from an unrelated cwd,
// list tools, read a skill reference. No After Effects involved.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const npmCli = process.env.npm_execpath;
assert(npmCli, "run through `npm run test:package` so npm's own CLI path is available");
const npm = (args, cwd = ROOT) =>
  execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: "utf8" });

const temp = mkdtempSync(join(tmpdir(), "dsrupt-ae-package-"));
const client = new Client(
  { name: "dsrupt-package-verification", version: "1.0.0" },
  { capabilities: {} },
);
try {
  const packed = JSON.parse(
    npm(["pack", "--ignore-scripts", "--json", "--pack-destination", temp]),
  )[0];
  const paths = new Set(packed.files.map((f) => f.path));
  for (const required of [
    "dist/index.js",
    "dist/cli/index.js",
    "jsx/dispatcher.jsx",
    "skills/manifest.json",
    "skills/ae-clean-rig/SKILL.md",
    "LICENSE",
    "UPSTREAM.md",
    "README.md",
  ]) {
    assert(paths.has(required), `tarball is missing ${required}`);
  }
  assert(
    ![...paths].some((p) => /^(tests|reference|runtime|node_modules|src)\//.test(p)),
    "tarball carries sources or tests",
  );

  const prefix = join(temp, "prefix");
  npm([
    "install",
    "--global",
    "--prefix",
    prefix,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    join(temp, packed.filename),
  ]);
  const pkgDir = realpathSync(
    join(npm(["root", "--global", "--prefix", prefix]).trim(), packed.name),
  );
  const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  assert.equal(manifest.name, "dsrupt-after-effects-mcp");

  const cli = join(pkgDir, "dist", "cli", "index.js");
  const config = JSON.parse(
    execFileSync(process.execPath, [cli, "config"], { cwd: temp, encoding: "utf8" }),
  );
  const server = config.mcpServers["dsrupt-after-effects"];
  assert.equal(server.command, process.execPath);
  assert.deepEqual(server.args, [join(pkgDir, "dist", "index.js")]);

  await client.connect(new StdioClientTransport({ ...server, cwd: temp, stderr: "pipe" }));
  assert.equal(client.getServerVersion().name, "dsrupt-after-effects");
  const tools = await client.listTools();
  assert.equal(
    tools.tools.length,
    12,
    `expected 12 tools, got ${tools.tools.map((t) => t.name).join(",")}`,
  );
  const skill = await client.callTool({
    name: "ae_get_skill",
    arguments: { name: "ae-clean-rig", reference: "references/sliders.md" },
  });
  assert(!skill.isError, "ae_get_skill failed from the installed package");
  assert(skill.structuredContent.content.length > 500);
  const catalog = await client.callTool({ name: "ae_catalog", arguments: {} });
  assert(!catalog.isError);
  await client.close();

  // The doctor exits 1 on a machine without After Effects; its JSON is what matters here.
  const doctorRun = spawnSync(process.execPath, [cli, "doctor", "--json"], {
    cwd: temp,
    encoding: "utf8",
  });
  const doctor = JSON.parse(doctorRun.stdout);
  assert.equal(doctor.liveConnectionTested, false);
  assert(doctor.checks.find((c) => c.name === "skills").ok, "installed skills did not verify");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tarball: packed.filename,
        files: packed.files.length,
        tools: tools.tools.length,
        installedAt: pkgDir,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await client.close();
  } catch {
    /* closed */
  }
  rmSync(temp, { recursive: true, force: true });
}
