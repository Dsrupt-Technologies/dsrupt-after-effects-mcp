// Static installation checks. Nothing here launches After Effects or the MCP
// server; that is `check-ae`. Keeping the two apart is deliberate: "installed
// correctly" and "After Effects answers" are different facts with different
// fixes, and a single "connected" light would hide which one is off.

import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { DISPATCHER_JSX, PACKAGE_ROOT, RUNTIME_DIR, runtimeDirWarnings } from "../config.js";
import {
  discoverAfterEffects,
  ENV_OVERRIDES,
  SEARCH_DIRS_ENV,
  type AeDiscovery,
} from "../discovery/after-effects.js";
import { realHost, type DiscoveryHost } from "../discovery/host.js";
import { nodeToolchainChecks, type ToolCheck } from "../discovery/node-toolchain.js";
import { SkillStore } from "../skills.js";
import { installLocationProblem, SERVER_ENTRY } from "./registration.js";

export interface DoctorReport {
  ok: boolean;
  checks: ToolCheck[];
  afterEffects: AeDiscovery;
  liveConnectionTested: false;
  next: string;
}

function checkPlatform(host: DiscoveryHost): ToolCheck {
  const ok = host.platform === "darwin" || host.platform === "win32";
  return {
    name: "platform",
    ok,
    detail: host.platform,
    ...(ok ? {} : { hint: "After Effects runs on Windows and macOS only." }),
  };
}

function checkFiles(): ToolCheck[] {
  const entry = existsSync(SERVER_ENTRY);
  const jsx = existsSync(DISPATCHER_JSX);
  const location = installLocationProblem();
  return [
    {
      name: "server",
      ok: entry,
      detail: SERVER_ENTRY,
      ...(entry ? {} : { hint: "Run `npm run build` in the checkout, or reinstall the package." }),
    },
    {
      name: "dispatcher",
      ok: jsx,
      detail: DISPATCHER_JSX,
      ...(jsx ? {} : { hint: "The jsx/ folder is missing; the package is incomplete." }),
    },
    {
      name: "install-location",
      ok: location === null,
      detail: PACKAGE_ROOT,
      ...(location ? { hint: location } : {}),
    },
  ];
}

function checkSkills(): ToolCheck {
  try {
    const verified = new SkillStore().verifyAll();
    return {
      name: "skills",
      ok: true,
      detail: `${verified.skills} skills, ${verified.documents} documents verified`,
    };
  } catch (err) {
    return {
      name: "skills",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      hint: "Reinstall the package, or in a checkout run `npm run skills:manifest`.",
    };
  }
}

function checkMailbox(): ToolCheck {
  try {
    mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
    accessSync(RUNTIME_DIR, constants.W_OK);
  } catch (err) {
    return {
      name: "mailbox",
      ok: false,
      detail: `${RUNTIME_DIR}: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The request/response mailbox must be writable. Unset AE_MCP_RUNTIME_DIR or point it at a per-user folder.",
    };
  }
  const warnings = runtimeDirWarnings();
  return {
    name: "mailbox",
    ok: warnings.length === 0,
    detail: RUNTIME_DIR,
    ...(warnings.length ? { hint: warnings.join(" ") } : {}),
  };
}

function checkAfterEffects(discovery: AeDiscovery): ToolCheck[] {
  const found = discovery.found;
  const install: ToolCheck = found
    ? {
        name: "after-effects",
        ok: true,
        detail: `${found.path} (${found.source})`,
        ...(discovery.candidates.length > 1
          ? {
              hint: `Other installs seen: ${discovery.candidates
                .filter((c) => c.path !== found.path)
                .map((c) => c.path)
                .join(", ")}. Set ${ENV_OVERRIDES[0]} to pick one explicitly.`,
            }
          : {}),
      }
    : {
        name: "after-effects",
        ok: false,
        detail: `not found. Probed: ${discovery.notes.join("; ")}`,
        hint: `Set ${ENV_OVERRIDES[0]} to the ${
          discovery.platform === "darwin" ? ".app bundle" : "AfterFX.exe"
        } path, or list its parent folder in ${SEARCH_DIRS_ENV}.`,
      };
  const running: ToolCheck = {
    name: "after-effects-running",
    ok: true,
    detail: discovery.running.length
      ? discovery.running.join(", ")
      : "no After Effects process right now",
    ...(discovery.running.length
      ? {}
      : {
          hint: "Informational. Open After Effects (and a project) before `check-ae` or any tool call.",
        }),
  };
  return [install, running];
}

export function runDoctor(host: DiscoveryHost = realHost()): DoctorReport {
  const discovery = discoverAfterEffects(host);
  const checks: ToolCheck[] = [
    ...nodeToolchainChecks(host),
    checkPlatform(host),
    ...checkFiles(),
    checkSkills(),
    checkMailbox(),
    ...checkAfterEffects(discovery),
  ];
  return {
    ok: checks.every((c) => c.ok),
    checks,
    afterEffects: discovery,
    liveConnectionTested: false,
    next: "Open After Effects with a project, then run `dsrupt-after-effects check-ae` for the live, non-mutating connection test.",
  };
}

export function formatChecks(checks: ToolCheck[]): string {
  const width = Math.max(...checks.map((c) => c.name.length));
  const out: string[] = [];
  for (const c of checks) {
    out.push(`${c.ok ? "[ok]" : "[!!]"} ${c.name.padEnd(width)}  ${c.detail}`);
    if (c.hint) out.push(`${" ".repeat(width + 7)}${c.hint}`);
  }
  return out.join("\n");
}
