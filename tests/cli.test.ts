// The setup CLI, driven as a real process. Everything here is static: no
// After Effects, no MCP client registration is attempted.

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { ensureBuilt } from "./harness.js";

const CLI = path.resolve("dist", "cli", "index.js");

function cli(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("dsrupt-after-effects CLI", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  it("prints help by default and for unknown commands exits 1", () => {
    const help = cli([]);
    expect(help.code).toBe(0);
    expect(help.out).toContain("doctor");
    expect(help.out).toContain("check-ae");
    expect(help.out).toContain("install-codex");
    const bad = cli(["frobnicate"]);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain("unknown command");
  });

  it("config pins the absolute node binary and server entry", () => {
    const r = cli(["config"]);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.out) as {
      mcpServers: Record<string, { command: string; args: string[]; env?: unknown }>;
    };
    const server = parsed.mcpServers["dsrupt-after-effects"];
    expect(server.command).toBe(process.execPath);
    expect(server.args).toEqual([path.resolve("dist", "index.js")]);
    expect(server.env).toBeUndefined();
  });

  it("config renders Codex TOML and the Claude Code command with env", () => {
    const codex = cli(["config", "--client", "codex", "--env", "AE_MCP_READONLY=1"]);
    expect(codex.code).toBe(0);
    expect(codex.out).toContain("[mcp_servers.dsrupt_after_effects]");
    expect(codex.out).toContain("[mcp_servers.dsrupt_after_effects.env]");
    expect(codex.out).toContain('AE_MCP_READONLY = "1"');
    const claude = cli(["config", "--client=claude-code", "--env=DSRUPT_AE_EXE=/x/y.app"]);
    expect(claude.code).toBe(0);
    expect(claude.out).toMatch(
      /^claude mcp add --scope user --env DSRUPT_AE_EXE=\/x\/y\.app dsrupt-after-effects -- /,
    );
    const bad = cli(["config", "--client", "vim"]);
    expect(bad.code).toBe(1);
  });

  it("doctor reports separate checks and never claims a live connection", () => {
    const r = cli(["doctor", "--json"]);
    const report = JSON.parse(r.out) as {
      ok: boolean;
      liveConnectionTested: boolean;
      checks: Array<{ name: string; ok: boolean; detail: string }>;
      afterEffects: { notes: string[] };
    };
    expect(report.liveConnectionTested).toBe(false);
    const names = report.checks.map((c) => c.name);
    for (const expected of [
      "node",
      "npm",
      "platform",
      "server",
      "dispatcher",
      "skills",
      "mailbox",
      "after-effects",
      "after-effects-running",
    ]) {
      expect(names).toContain(expected);
    }
    expect(report.checks.find((c) => c.name === "skills")).toMatchObject({ ok: true });
    expect(report.checks.find((c) => c.name === "server")).toMatchObject({ ok: true });
    expect(report.afterEffects.notes.length).toBeGreaterThan(0);
    // Exit code follows the checks: a machine without AE fails the doctor, with AE it passes.
    const aeFound = report.checks.find((c) => c.name === "after-effects")!.ok;
    expect(r.code).toBe(report.ok ? 0 : 1);
    expect(report.ok).toBe(report.checks.every((c) => c.ok));
    expect(typeof aeFound).toBe("boolean");
  });

  it("locate-ae respects an explicit override", () => {
    const r = cli(["locate-ae", "--json"], { DSRUPT_AE_EXE: process.execPath });
    expect(r.code).toBe(0);
    const d = JSON.parse(r.out) as { found: { path: string; source: string } };
    expect(d.found.source).toBe("env DSRUPT_AE_EXE");
    expect(d.found.path).toBe(process.execPath.replace(/\\/g, "/"));
  });

  it("version prints the package version", () => {
    const r = cli(["version"]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
