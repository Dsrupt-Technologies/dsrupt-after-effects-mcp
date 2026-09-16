#!/usr/bin/env node
// dsrupt-after-effects <command>
//
// Setup and diagnostics for the Dsrupt After Effects MCP. The server itself
// is dist/index.js (bin: dsrupt-after-effects-mcp); this CLI never speaks MCP
// to a client, it only helps install and verify.

import { createRequire } from "node:module";
import { discoverAfterEffects } from "../discovery/after-effects.js";
import { realHost } from "../discovery/host.js";
import { formatChecks, runDoctor } from "./doctor.js";
import { formatLive, runLiveCheck } from "./live-check.js";
import {
  claudeCodeCommand,
  codexToml,
  installClaudeCode,
  installCodex,
  mcpServersJson,
  SERVER_NAME,
} from "./registration.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const HELP = `dsrupt-after-effects ${version}

Usage: dsrupt-after-effects <command> [options]

Commands
  doctor              Static checks: Node/npm, files, skills, mailbox, After Effects location.
  locate-ae           Show every After Effects install found and which one will be used.
  check-ae            Live, non-mutating test: start the server, list tools, read skills,
                      then ask the running After Effects for ae_project_info.
  config              Print the MCP client configuration for this install.
  install-codex       Register the server with the Codex CLI (codex mcp add).
  install-claude-code Register the server with Claude Code (claude mcp add).
  help, version

Options
  --json              Machine-readable output (doctor, locate-ae, check-ae, config).
  --client <name>     config only: json (default), codex, claude-code.
  --env KEY=VALUE     config/install: environment for the server (repeatable),
                      e.g. --env AE_MCP_READONLY=1 or --env DSRUPT_AE_EXE=<path>.
  --allow-launch      check-ae only: let the test start After Effects if it is not running.

Exit codes: 0 ok; 1 a check failed; 2 (check-ae) nothing failed but After Effects was not running.

Server registration name: ${SERVER_NAME}
Environment: DSRUPT_AE_EXE (AE path), DSRUPT_AE_SEARCH_DIRS (extra install folders),
             AE_MCP_READONLY=1, AE_MCP_ALLOW_CATEGORIES, AE_MCP_ENABLE_EVAL=1, AE_MCP_RUNTIME_DIR.
`;

interface Parsed {
  command: string;
  json: boolean;
  client: string;
  allowLaunch: boolean;
  env: Record<string, string>;
}

function parse(argv: string[]): Parsed {
  const parsed: Parsed = {
    command: "help",
    json: false,
    client: "json",
    allowLaunch: false,
    env: {},
  };
  const rest = [...argv];
  const positional: string[] = [];
  while (rest.length) {
    const a = rest.shift()!;
    if (a === "--json") parsed.json = true;
    else if (a === "--allow-launch") parsed.allowLaunch = true;
    else if (a === "--client") parsed.client = rest.shift() ?? "";
    else if (a.startsWith("--client=")) parsed.client = a.slice("--client=".length);
    else if (a === "--env" || a.startsWith("--env=")) {
      const kv = a === "--env" ? (rest.shift() ?? "") : a.slice("--env=".length);
      const eq = kv.indexOf("=");
      if (eq <= 0) throw new Error(`--env expects KEY=VALUE, got '${kv}'`);
      parsed.env[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (a === "-h" || a === "--help") parsed.command = "help";
    else if (a === "-v" || a === "--version") parsed.command = "version";
    else positional.push(a);
  }
  if (positional.length > 1)
    throw new Error(`unexpected arguments: ${positional.slice(1).join(" ")}`);
  if (positional[0]) parsed.command = positional[0];
  return parsed;
}

async function main(argv: string[]): Promise<number> {
  const p = parse(argv);
  switch (p.command) {
    case "help":
    case "--help":
      process.stdout.write(HELP);
      return 0;
    case "version":
      process.stdout.write(`${version}\n`);
      return 0;
    case "doctor": {
      const report = runDoctor();
      if (p.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      else {
        process.stdout.write(`${formatChecks(report.checks)}\n\n`);
        process.stdout.write(
          `${report.ok ? "All static checks passed." : "Some checks failed."} Live AE connection not tested.\n`,
        );
        process.stdout.write(`Next: ${report.next}\n`);
      }
      return report.ok ? 0 : 1;
    }
    case "locate-ae": {
      const d = discoverAfterEffects(realHost());
      if (p.json) process.stdout.write(`${JSON.stringify(d, null, 2)}\n`);
      else {
        process.stdout.write(
          d.found ? `Using: ${d.found.path}  (${d.found.source})\n` : "After Effects not found.\n",
        );
        if (d.running.length) process.stdout.write(`Running now: ${d.running.join(", ")}\n`);
        if (d.candidates.length) {
          process.stdout.write("Installs seen:\n");
          for (const c of d.candidates)
            process.stdout.write(`  ${c.path}  [${c.source}${c.beta ? ", beta" : ""}]\n`);
        }
        process.stdout.write("Probed:\n");
        for (const n of d.notes) process.stdout.write(`  ${n}\n`);
      }
      return d.found ? 0 : 1;
    }
    case "check-ae": {
      const report = await runLiveCheck({ allowLaunch: p.allowLaunch });
      if (p.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      else process.stdout.write(`${formatLive(report)}\n`);
      // 0: everything answered. 2: nothing failed but the AE step was skipped. 1: a step failed.
      if (report.ok) return 0;
      return report.states.some((s) => s.status === "failed") ? 1 : 2;
    }
    case "config": {
      switch (p.client) {
        case "json":
          process.stdout.write(`${mcpServersJson(p.env)}\n`);
          return 0;
        case "codex":
          process.stdout.write(`${codexToml(p.env)}\n`);
          return 0;
        case "claude-code":
        case "claude":
          process.stdout.write(`${claudeCodeCommand(p.env)}\n`);
          return 0;
        default:
          throw new Error(`unknown --client '${p.client}' (json, codex, claude-code)`);
      }
    }
    case "install-codex":
      process.stdout.write(`${installCodex(p.env)}\n`);
      return 0;
    case "install-claude-code":
    case "install-claude":
      process.stdout.write(`${installClaudeCode(p.env)}\n`);
      return 0;
    default:
      throw new Error(`unknown command '${p.command}'. Run dsrupt-after-effects help.`);
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  },
);
