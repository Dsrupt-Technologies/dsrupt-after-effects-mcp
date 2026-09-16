// The live connection test, reported as separate states:
//
//   1. node          this CLI is running, so Node works
//   2. server        the MCP server process starts over stdio
//   3. tools         the server advertises its tools
//   4. skills        ae_get_skill answers (no After Effects involved)
//   5. afterEffects  After Effects answers a read-only ae_project_info
//   6. agent         whether the user's agent conversation can call these
//                    tools is NOT knowable from here; the report says how to
//                    check it from inside the client
//
// Nothing here mutates the project. ae_project_info is a pure read; it is
// chosen over ae_version_info, whose capability probe creates and removes a
// scratch comp (which dirties the project).
//
// Launching After Effects is itself a side effect the user may not want
// (both `AfterFX.exe -r` and AppleScript will boot it), so the AE step is
// skipped unless an After Effects process is already running or the caller
// passes allowLaunch.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { discoverAfterEffects } from "../discovery/after-effects.js";
import { realHost } from "../discovery/host.js";
import { SERVER_ENTRY, serverLaunch } from "./registration.js";

export interface LiveState {
  name: string;
  status: "ok" | "failed" | "skipped" | "unverifiable";
  detail: string;
  hint?: string;
}

export interface LiveReport {
  ok: boolean;
  states: LiveState[];
}

const EXPECTED_TOOLS = [
  "ae_get_skill",
  "ae_project_info",
  "ae_catalog",
  "ae_do",
  "ae_render_frame",
  "ae_save_project",
];

interface ProjectSummary {
  file: string | null;
  dirty: boolean;
  numItems: number;
  activeItem: { name: string; typeName: string } | null;
}

function hintForAeError(text: string, platform: NodeJS.Platform): string {
  if (/AE_NOT_FOUND/.test(text)) {
    return "After Effects was not found. Set DSRUPT_AE_EXE to its path (see `dsrupt-after-effects locate-ae`).";
  }
  if (/-1743|Not authorized to send Apple events/.test(text)) {
    return "macOS refused Automation. System Settings > Privacy & Security > Automation: allow this terminal (and your MCP client) to control After Effects.";
  }
  if (/TIMEOUT/.test(text)) {
    return (
      "After Effects did not answer. Check that it is running with a project open, that no modal dialog is up, and that " +
      "Preferences > Scripting & Expressions > 'Allow Scripts to Write Files and Access Network' is on." +
      (platform === "win32" ? " On Windows, AE must run as the same user as this command." : "")
    );
  }
  if (/DISPATCHER/.test(text)) {
    return "The dispatcher ran but failed early. Enable 'Allow Scripts to Write Files and Access Network' in AE preferences and look at dispatcher.log in the mailbox.";
  }
  return "Inspect the error code above; `dsrupt-after-effects doctor` lists the static checks.";
}

export async function runLiveCheck(
  options: { allowLaunch?: boolean; timeoutMs?: number } = {},
): Promise<LiveReport> {
  const states: LiveState[] = [];
  states.push({
    name: "node",
    status: "ok",
    detail: `v${process.versions.node} at ${process.execPath}`,
  });

  const launch = serverLaunch();
  const client = new Client(
    { name: "dsrupt-after-effects-check", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    env: { ...process.env } as Record<string, string>,
    stderr: "pipe",
  });
  try {
    try {
      await client.connect(transport);
      const info = client.getServerVersion();
      states.push({
        name: "server",
        status: "ok",
        detail: `${info?.name ?? "?"} ${info?.version ?? ""} started from ${SERVER_ENTRY}`.trim(),
      });
    } catch (err) {
      states.push({
        name: "server",
        status: "failed",
        detail: err instanceof Error ? err.message : String(err),
        hint: "The server did not start. Run `dsrupt-after-effects doctor` and rebuild if the entry is missing.",
      });
      return { ok: false, states };
    }

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    const missing = EXPECTED_TOOLS.filter((t) => !names.includes(t));
    states.push({
      name: "tools",
      status: missing.length === 0 ? "ok" : "failed",
      detail: `${names.length} tools advertised${missing.length ? `, missing: ${missing.join(", ")}` : ""}`,
      ...(missing.length
        ? {
            hint: "AE_MCP_READONLY=1 withholds ae_save_project and ae_project_import_json on purpose.",
          }
        : {}),
    });

    const skill = await client.callTool({ name: "ae_get_skill", arguments: {} });
    const skillOk = !skill.isError;
    const skillCount = skillOk
      ? ((skill.structuredContent as { skills?: unknown[] } | undefined)?.skills?.length ?? 0)
      : 0;
    states.push({
      name: "skills",
      status: skillOk ? "ok" : "failed",
      detail: skillOk ? `${skillCount} skills served` : textOf(skill),
    });

    const discovery = discoverAfterEffects(realHost());
    if (discovery.running.length === 0 && !options.allowLaunch) {
      states.push({
        name: "afterEffects",
        status: "skipped",
        detail: "no After Effects process is running",
        hint: "Open After Effects with a project and rerun, or pass --allow-launch to let the call start it.",
      });
    } else {
      const res = await client.callTool({ name: "ae_project_info", arguments: {} }, undefined, {
        timeout: options.timeoutMs ?? 90_000,
      });
      if (res.isError) {
        const text = textOf(res);
        states.push({
          name: "afterEffects",
          status: "failed",
          detail: text.split("\n")[0] ?? text,
          hint: hintForAeError(text, process.platform),
        });
      } else {
        const payload = res.structuredContent as
          | { result?: ProjectSummary; durationMs?: number }
          | undefined;
        const p = payload?.result;
        states.push({
          name: "afterEffects",
          status: "ok",
          detail: p
            ? `answered in ${payload?.durationMs ?? "?"} ms: ${p.file ?? "(unsaved project)"}, ${p.numItems} items, ` +
              `${p.dirty ? "unsaved changes" : "clean"}, active: ${p.activeItem ? `${p.activeItem.name} (${p.activeItem.typeName})` : "none"}`
            : "answered",
        });
      }
    }
  } finally {
    try {
      await client.close();
    } catch {
      /* already closed */
    }
  }

  states.push({
    name: "agent",
    status: "unverifiable",
    detail:
      "whether your agent's current conversation can call these tools is only visible from inside the client",
    hint: "In the client, ask the agent to call ae_get_skill({}) and then ae_project_info({}). Both must succeed there; a server the client has not (re)connected to shows no tools.",
  });

  const ok = states.every((s) => s.status === "ok" || s.status === "unverifiable");
  return { ok, states };
}

function textOf(res: unknown): string {
  const raw = (res as { content?: unknown } | null)?.content;
  const content = Array.isArray(raw) ? (raw as Array<{ text?: unknown }>) : [];
  return content
    .map((c) => (typeof c.text === "string" ? c.text : ""))
    .join("\n")
    .trim();
}

export function formatLive(report: LiveReport): string {
  const width = Math.max(...report.states.map((s) => s.name.length));
  const mark: Record<LiveState["status"], string> = {
    ok: "[ok]",
    failed: "[!!]",
    skipped: "[--]",
    unverifiable: "[??]",
  };
  const out: string[] = [];
  for (const s of report.states) {
    out.push(`${mark[s.status]} ${s.name.padEnd(width)}  ${s.detail}`);
    if (s.hint) out.push(`${" ".repeat(width + 7)}${s.hint}`);
  }
  return out.join("\n");
}
