// After Effects discovery against described machines. No real filesystem or
// child processes: the host is a fake, so a Windows layout can be tested on
// macOS and vice versa, and the "no disk walk" property can be asserted.

import { describe, expect, it } from "vitest";

import { discoverAfterEffects, notFoundMessage } from "../src/discovery/after-effects.js";
import type { DiscoveryHost } from "../src/discovery/host.js";

interface FakeSpec {
  platform: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  files?: string[];
  dirs?: Record<string, string[]>;
  commands?: Record<string, string | null>;
}

interface FakeHost extends DiscoveryHost {
  listed: string[];
  ran: string[];
}

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function fake(spec: FakeSpec): FakeHost {
  const files = new Set((spec.files ?? []).map(norm));
  const dirs = new Map(Object.entries(spec.dirs ?? {}).map(([k, v]) => [norm(k), v]));
  const host: FakeHost = {
    platform: spec.platform,
    env: spec.env ?? {},
    homedir: spec.platform === "win32" ? "C:\\Users\\dsrupt" : "/Users/dsrupt",
    listed: [],
    ran: [],
    exists: (p) => files.has(norm(p)) || dirs.has(norm(p)),
    listDir: (dir) => {
      host.listed.push(dir);
      return dirs.get(norm(dir)) ?? [];
    },
    run: (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      host.ran.push(key);
      for (const [pattern, output] of Object.entries(spec.commands ?? {})) {
        if (key.includes(pattern)) return output;
      }
      return null;
    },
    runShell: () => null,
  };
  return host;
}

const WIN_2026 = "C:/Program Files/Adobe/Adobe After Effects 2026/Support Files/AfterFX.exe";
const WIN_2025 = "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files/AfterFX.exe";
const WIN_2024 = "C:/Program Files/Adobe/Adobe After Effects 2024/Support Files/AfterFX.exe";

function windowsMachine(extra: Partial<FakeSpec> = {}): FakeHost {
  return fake({
    platform: "win32",
    env: {
      ProgramFiles: "C:\\Program Files",
      "ProgramFiles(x86)": "C:\\Program Files (x86)",
      ...extra.env,
    },
    files: [WIN_2026, WIN_2025, ...(extra.files ?? [])],
    dirs: {
      "C:\\Program Files\\Adobe": [
        "Adobe After Effects 2025",
        "Adobe After Effects 2026",
        "Adobe Photoshop 2026",
      ],
      "C:\\Program Files (x86)\\Adobe": [],
      ...extra.dirs,
    },
    commands: {
      "Get-Process -Name AfterFX": "",
      ...extra.commands,
    },
  });
}

describe("discoverAfterEffects on Windows", () => {
  it("prefers the newest install under Program Files\\Adobe", () => {
    const host = windowsMachine();
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(WIN_2026);
    expect(d.found?.source).toContain("Adobe");
    expect(d.candidates.map((c) => c.path)).toEqual([WIN_2026, WIN_2025]);
    expect(d.running).toEqual([]);
  });

  it("uses the running process over any installed copy", () => {
    const host = windowsMachine({
      commands: { "Get-Process -Name AfterFX": `${WIN_2025.replace(/\//g, "\\")}\r\n` },
    });
    const d = discoverAfterEffects(host);
    expect(d.running).toEqual([WIN_2025.replace(/\//g, "\\")]);
    expect(d.found?.path).toBe(WIN_2025);
    expect(d.found?.source).toBe("running process");
  });

  it("lets DSRUPT_AE_EXE win over a different running instance", () => {
    const host = windowsMachine({
      env: { DSRUPT_AE_EXE: WIN_2026 },
      commands: { "Get-Process -Name AfterFX": WIN_2025 },
    });
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(WIN_2026);
    expect(d.found?.source).toBe("env DSRUPT_AE_EXE");
  });

  it("reports an override that points nowhere and keeps probing", () => {
    const host = windowsMachine({ env: { AE_MCP_EXE: "D:\\nowhere\\AfterFX.exe" } });
    const d = discoverAfterEffects(host);
    expect(d.notes.join("\n")).toContain("AE_MCP_EXE is set but does not exist");
    expect(d.found?.path).toBe(WIN_2026);
  });

  it("finds an install only the registry knows about", () => {
    const host = windowsMachine({
      files: [WIN_2024],
      commands: {
        "reg.exe query HKLM\\SOFTWARE\\Adobe\\After Effects":
          "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\After Effects\\22.0\r\n" +
          "    InstallPath    REG_SZ    C:\\Program Files\\Adobe\\Adobe After Effects 2024\\Support Files\\\r\n",
      },
    });
    const d = discoverAfterEffects(host);
    const fromRegistry = d.candidates.find((c) => c.source === "registry");
    expect(fromRegistry?.path).toBe(WIN_2024);
    // Newest still wins overall.
    expect(d.found?.path).toBe(WIN_2026);
  });

  it("resolves Start Menu shortcuts through one PowerShell call", () => {
    const custom = "D:/Apps/AE Custom/Support Files/AfterFX.exe";
    const host = fake({
      platform: "win32",
      env: { ProgramData: "C:\\ProgramData", APPDATA: "C:\\Users\\dsrupt\\AppData\\Roaming" },
      files: [custom],
      dirs: {
        "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs": [
          "Adobe After Effects 2026.lnk",
          "Notepad.lnk",
        ],
      },
      commands: {
        "Get-Process -Name AfterFX": "",
        "WScript.Shell": `${custom.replace(/\//g, "\\")}\r\n`,
      },
    });
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(custom);
    expect(d.found?.source).toBe("start menu shortcut");
    expect(host.ran.filter((r) => r.includes("WScript.Shell"))).toHaveLength(1);
  });

  it("honours DSRUPT_AE_SEARCH_DIRS for custom install locations", () => {
    const custom = "E:/Tools/After Effects/Support Files/AfterFX.exe";
    const host = fake({
      platform: "win32",
      env: { DSRUPT_AE_SEARCH_DIRS: "E:\\Tools\\After Effects;E:\\Nothing" },
      files: [custom],
      commands: { "Get-Process -Name AfterFX": "" },
    });
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(custom);
    expect(d.found?.source).toBe("DSRUPT_AE_SEARCH_DIRS");
  });

  it("ranks a release build above a beta of the same year", () => {
    const beta = "C:/Program Files/Adobe/Adobe After Effects (Beta)/Support Files/AfterFX.exe";
    const host = windowsMachine({
      files: [beta],
      dirs: {
        "C:\\Program Files\\Adobe": ["Adobe After Effects (Beta)", "Adobe After Effects 2026"],
      },
    });
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(WIN_2026);
    expect(d.candidates.at(-1)?.beta).toBe(true);
  });

  it("never lists a drive root or walks beyond the known folders", () => {
    const host = windowsMachine();
    discoverAfterEffects(host);
    for (const dir of host.listed) {
      expect(dir).toMatch(/Adobe|Start Menu/);
      expect(dir).not.toMatch(/^[A-Z]:\\?$/);
    }
  });

  it("explains itself when nothing is found", () => {
    const host = fake({ platform: "win32", commands: { "Get-Process -Name AfterFX": "" } });
    const d = discoverAfterEffects(host);
    expect(d.found).toBeNull();
    const message = notFoundMessage(d);
    expect(message).toContain("DSRUPT_AE_EXE");
    expect(message).toContain("AfterFX.exe");
    expect(message).toContain("process check");
  });
});

const MAC_2026 = "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app";
const MAC_2025 = "/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app";

describe("discoverAfterEffects on macOS", () => {
  it("prefers the newest bundle under /Applications", () => {
    const host = fake({
      platform: "darwin",
      files: [MAC_2026, MAC_2025],
      dirs: {
        "/Applications": ["Adobe After Effects 2025", "Adobe After Effects 2026", "Safari.app"],
        "/Applications/Adobe After Effects 2025": ["Adobe After Effects 2025.app", "Plug-ins"],
        "/Applications/Adobe After Effects 2026": ["Adobe After Effects 2026.app", "Plug-ins"],
      },
      commands: { "ps -axo comm=": "/sbin/launchd\n/usr/sbin/cfprefsd\n", mdfind: "" },
    });
    const d = discoverAfterEffects(host);
    expect(d.found?.path).toBe(MAC_2026);
    expect(d.candidates.map((c) => c.path)).toEqual([MAC_2026, MAC_2025]);
  });

  it("maps a running process back to its bundle and prefers it", () => {
    const host = fake({
      platform: "darwin",
      files: [MAC_2026, MAC_2025],
      dirs: {
        "/Applications": ["Adobe After Effects 2026"],
        "/Applications/Adobe After Effects 2026": ["Adobe After Effects 2026.app"],
      },
      commands: {
        "ps -axo comm=": `/sbin/launchd\n${MAC_2025}/Contents/MacOS/After Effects\n`,
        mdfind: "",
      },
    });
    const d = discoverAfterEffects(host);
    expect(d.running).toEqual([MAC_2025]);
    expect(d.found?.path).toBe(MAC_2025);
  });

  it("falls back to a Spotlight bundle-id query and ~/Applications", () => {
    const home = "/Users/dsrupt/Applications/Adobe After Effects 2024/Adobe After Effects 2024.app";
    const elsewhere =
      "/Volumes/Work/Adobe After Effects 2026 (Beta)/Adobe After Effects 2026 (Beta).app";
    const host = fake({
      platform: "darwin",
      files: [home, elsewhere],
      dirs: {
        "/Users/dsrupt/Applications": ["Adobe After Effects 2024"],
        "/Users/dsrupt/Applications/Adobe After Effects 2024": ["Adobe After Effects 2024.app"],
      },
      commands: { "ps -axo comm=": "", mdfind: `${elsewhere}\n` },
    });
    const d = discoverAfterEffects(host);
    expect(d.candidates.map((c) => c.source)).toEqual(["/Users/dsrupt/Applications", "spotlight"]);
    // A release build, even older, outranks the beta.
    expect(d.found?.path).toBe(home);
  });
});
