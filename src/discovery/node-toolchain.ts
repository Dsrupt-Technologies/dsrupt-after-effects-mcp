// Node / npm checks for the doctor, written so the common Windows traps are
// named instead of misread:
//
//   - `npm` typed in PowerShell runs `npm.ps1`, which a Restricted execution
//     policy refuses ("running scripts is disabled on this system"). npm is
//     installed; PowerShell just will not run the shim. We probe `npm.cmd`
//     directly, and report the policy as its own item.
//   - Node comes from nvm-windows, Volta, fnm, Homebrew, or an installer, and
//     each puts the binary somewhere else. MCP clients spawn the server with
//     their own PATH, so the printed config pins the absolute node path.

import * as path from "node:path";
import { lines, realHost, type DiscoveryHost } from "./host.js";

export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

export const MIN_NODE_MAJOR = 24;

/** Which version manager or installer is responsible for the running node, if it is recognisable. */
export function describeNodeManager(env: NodeJS.ProcessEnv, execPath: string): string | null {
  const p = execPath.replace(/\\/g, "/").toLowerCase();
  if (env.VOLTA_HOME || p.includes("/.volta/")) return "Volta";
  if (env.NVM_HOME || env.NVM_SYMLINK) return "nvm-windows";
  if (env.NVM_DIR || p.includes("/.nvm/")) return "nvm";
  if (env.FNM_DIR || env.FNM_MULTISHELL_PATH || p.includes("/.fnm/") || p.includes("/fnm/"))
    return "fnm";
  if (p.includes("/n/versions/node/")) return "n";
  if (p.includes("/homebrew/") || p.includes("/usr/local/cellar/")) return "Homebrew";
  if (p.includes("/program files/nodejs/")) return "nodejs.org installer";
  return null;
}

function findOnPath(host: DiscoveryHost, name: string): string[] {
  const out =
    host.platform === "win32" ? host.run("where.exe", [name]) : host.run("which", ["-a", name]);
  return lines(out);
}

/** Run `<tool> --version`, going through cmd.exe only for a Windows `.cmd` shim. */
function toolVersion(host: DiscoveryHost, tool: string, resolved: string | null): string | null {
  if (host.platform === "win32") {
    const target = resolved ?? `${tool}.cmd`;
    return host.runShell(`"${target}" --version`)?.trim() ?? null;
  }
  return host.run(resolved ?? tool, ["--version"])?.trim() ?? null;
}

function checkNpmLike(host: DiscoveryHost, tool: "npm" | "npx"): ToolCheck {
  const hits = findOnPath(host, tool);
  const cmd = hits.find((h) => /\.cmd$/i.test(h)) ?? null;
  const ps1 = hits.find((h) => /\.ps1$/i.test(h)) ?? null;
  const resolved = host.platform === "win32" ? cmd : (hits[0] ?? null);
  const version = toolVersion(host, tool, resolved);
  if (version) {
    return { name: tool, ok: true, detail: `${version} at ${resolved ?? tool}` };
  }
  if (host.platform === "win32" && (cmd || ps1)) {
    // The shim exists; only running it failed. Do not call that "not installed".
    return {
      name: tool,
      ok: true,
      detail: `${tool} shim present at ${cmd ?? ps1} but --version did not run`,
      hint:
        `Run ${tool}.cmd directly or from cmd.exe. If PowerShell reports "running scripts is ` +
        `disabled", that is the execution policy blocking ${tool}.ps1, not a missing ${tool}.`,
    };
  }
  return {
    name: tool,
    ok: false,
    detail: hits.length ? `found ${hits.join(", ")} but it did not run` : "not found on PATH",
    hint:
      tool === "npm"
        ? "npm ships with Node. Reinstall Node 24+, or fix PATH so the node installation's npm shim is visible."
        : "npx ships with npm; only needed for one-off installs, not to run the server.",
  };
}

function checkPowerShellPolicy(host: DiscoveryHost): ToolCheck | null {
  if (host.platform !== "win32") return null;
  const out = host.run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-ExecutionPolicy",
  ]);
  const policy = out?.trim() ?? null;
  if (!policy) {
    return { name: "powershell-policy", ok: true, detail: "could not read the execution policy" };
  }
  const blocks = /^(Restricted|AllSigned)$/i.test(policy);
  return {
    name: "powershell-policy",
    ok: true,
    detail: `${policy}${blocks ? " (blocks npm.ps1 / npx.ps1 in PowerShell)" : ""}`,
    ...(blocks
      ? {
          hint:
            "Typing npm or npx in PowerShell fails with 'running scripts is disabled'. The MCP server is " +
            "unaffected (it runs node directly). For installs use npm.cmd, cmd.exe, or " +
            "`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.",
        }
      : {}),
  };
}

export function nodeToolchainChecks(
  host: DiscoveryHost = realHost(),
  nodeVersion: string = process.versions.node,
  execPath: string = process.execPath,
): ToolCheck[] {
  const checks: ToolCheck[] = [];
  const major = Number(nodeVersion.split(".")[0]);
  const manager = describeNodeManager(host.env, execPath);
  checks.push({
    name: "node",
    ok: major >= MIN_NODE_MAJOR,
    detail: `v${nodeVersion} at ${execPath}${manager ? ` (${manager})` : ""}`,
    ...(major >= MIN_NODE_MAJOR
      ? {}
      : {
          hint: `Node ${MIN_NODE_MAJOR}+ is required. Install it and run the CLI with that node.`,
        }),
  });
  if (manager && /nvm|fnm|Volta|^n$/.test(manager)) {
    checks.push({
      name: "node-manager",
      ok: true,
      detail: `${manager} manages this node; the MCP config pins ${path.basename(execPath)} by absolute path`,
      hint: `After switching Node versions with ${manager}, re-run \`dsrupt-after-effects config\` and update the client so it launches the new binary.`,
    });
  }
  checks.push(checkNpmLike(host, "npm"));
  checks.push(checkNpmLike(host, "npx"));
  const policy = checkPowerShellPolicy(host);
  if (policy) checks.push(policy);
  return checks;
}
