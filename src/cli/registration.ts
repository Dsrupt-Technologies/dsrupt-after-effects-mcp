// How an MCP client should launch this server, and helpers to register it
// with clients that have a CLI (Codex, Claude Code).
//
// The config pins the absolute node binary and the absolute dist/index.js:
// MCP clients spawn servers with their own PATH, where `node` may be a
// different version or missing (nvm, Volta and friends only alter the shell
// that sourced them).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { PACKAGE_ROOT } from "../config.js";

export const SERVER_NAME = "dsrupt-after-effects";
export const SERVER_ENTRY = path.join(PACKAGE_ROOT, "dist", "index.js");

export interface ServerLaunch {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function serverLaunch(env: Record<string, string> = {}): ServerLaunch {
  const launch: ServerLaunch = { command: process.execPath, args: [SERVER_ENTRY] };
  if (Object.keys(env).length > 0) launch.env = env;
  return launch;
}

/** The `mcpServers` JSON block used by Claude Desktop, Cursor, Windsurf, and most other clients. */
export function mcpServersJson(env: Record<string, string> = {}): string {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: serverLaunch(env) } }, null, 2);
}

/** Codex's config.toml block. */
export function codexToml(env: Record<string, string> = {}): string {
  const launch = serverLaunch(env);
  const lines = [
    `[mcp_servers.${SERVER_NAME.replace(/-/g, "_")}]`,
    `command = ${JSON.stringify(launch.command)}`,
    `args = ${JSON.stringify(launch.args)}`,
  ];
  if (launch.env) {
    lines.push(`[mcp_servers.${SERVER_NAME.replace(/-/g, "_")}.env]`);
    for (const [k, v] of Object.entries(launch.env)) lines.push(`${k} = ${JSON.stringify(v)}`);
  }
  return lines.join("\n");
}

/** The one-line `claude mcp add` command. */
export function claudeCodeCommand(env: Record<string, string> = {}): string {
  const launch = serverLaunch(env);
  const envFlags = Object.entries(env).map(([k, v]) => `--env ${k}=${quote(v)}`);
  return [
    "claude mcp add",
    "--scope user",
    ...envFlags,
    SERVER_NAME,
    "--",
    quote(launch.command),
    ...launch.args.map(quote),
  ].join(" ");
}

function quote(s: string): string {
  return /[\s"']/.test(s) ? JSON.stringify(s) : s;
}

/**
 * Registration must point at a durable install. An `npx` cache directory is
 * cleaned without notice, which would silently break the client later.
 */
export function installLocationProblem(root: string = PACKAGE_ROOT): string | null {
  if (root.split(/[\\/]/).includes("_npx")) {
    return (
      "This copy lives in the npx cache, which can be deleted at any time. Install a persistent copy " +
      "(npm install --global <package or git url>, or a git checkout with npm run build) and register that."
    );
  }
  if (!existsSync(SERVER_ENTRY)) {
    return `Server entry is missing: ${SERVER_ENTRY}. Run \`npm run build\` in the checkout, or reinstall the package.`;
  }
  return null;
}

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runClient(command: string, args: string[]): CommandResult {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    // The client CLIs are npm shims on Windows (.cmd), which need a shell.
    shell: process.platform === "win32",
  });
  if (r.error) return { ok: false, stdout: "", stderr: r.error.message };
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

interface CodexServer {
  name: string;
  enabled?: boolean;
  transport?: { type?: string; command?: string; args?: string[] };
}

export function installCodex(env: Record<string, string> = {}): string {
  const problem = installLocationProblem();
  if (problem) throw new Error(problem);
  const launch = serverLaunch(env);
  const listed = runClient("codex", ["mcp", "list", "--json"]);
  if (!listed.ok) {
    throw new Error(
      "Could not read Codex's MCP configuration (is the `codex` CLI installed and on PATH?). " +
        `Add the server by hand instead:\n${codexToml(env)}`,
    );
  }
  let servers: CodexServer[];
  try {
    servers = JSON.parse(listed.stdout) as CodexServer[];
    if (!Array.isArray(servers)) throw new Error("not an array");
  } catch {
    throw new Error("Unexpected output from `codex mcp list --json`; nothing was changed.");
  }
  const existing = servers.find((s) => s.name === SERVER_NAME);
  if (existing) {
    const same =
      existing.enabled !== false &&
      existing.transport?.type === "stdio" &&
      existing.transport.command === launch.command &&
      JSON.stringify(existing.transport.args) === JSON.stringify(launch.args);
    if (same)
      return `${SERVER_NAME} is already registered with Codex. Restart Codex or reconnect its MCP servers.`;
    throw new Error(
      `${SERVER_NAME} is already registered with Codex but points elsewhere. Inspect it with ` +
        `\`codex mcp get ${SERVER_NAME}\`, remove it with \`codex mcp remove ${SERVER_NAME}\`, then rerun. Nothing was changed.`,
    );
  }
  const envArgs = Object.entries(env).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
  const added = runClient("codex", [
    "mcp",
    "add",
    ...envArgs,
    SERVER_NAME,
    "--",
    launch.command,
    ...launch.args,
  ]);
  if (!added.ok) throw new Error(added.stderr.trim() || "codex mcp add failed");
  return `${added.stdout.trim()}\nRegistered ${SERVER_NAME} with Codex. Restart Codex or reconnect its MCP servers.`.trim();
}

export function installClaudeCode(env: Record<string, string> = {}): string {
  const problem = installLocationProblem();
  if (problem) throw new Error(problem);
  const launch = serverLaunch(env);
  const existing = runClient("claude", ["mcp", "get", SERVER_NAME]);
  if (existing.ok) {
    const text = existing.stdout;
    if (text.includes(launch.command) && text.includes(SERVER_ENTRY)) {
      return `${SERVER_NAME} is already registered with Claude Code. Restart the session so it reconnects.`;
    }
    throw new Error(
      `${SERVER_NAME} is already registered with Claude Code but points elsewhere. Inspect it with ` +
        `\`claude mcp get ${SERVER_NAME}\`, remove it with \`claude mcp remove ${SERVER_NAME}\`, then rerun. Nothing was changed.`,
    );
  }
  const envArgs = Object.entries(env).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
  const added = runClient("claude", [
    "mcp",
    "add",
    "--scope",
    "user",
    ...envArgs,
    SERVER_NAME,
    "--",
    launch.command,
    ...launch.args,
  ]);
  if (!added.ok) {
    throw new Error(
      (added.stderr.trim() || "claude mcp add failed") +
        `\nIf the \`claude\` CLI is not installed, run this yourself:\n${claudeCodeCommand(env)}`,
    );
  }
  return `${added.stdout.trim()}\nRegistered ${SERVER_NAME} with Claude Code. Start a new session so it connects.`.trim();
}
