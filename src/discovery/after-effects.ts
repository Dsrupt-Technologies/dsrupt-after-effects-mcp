// Locating After Effects without assuming a single install path.
//
// Order of trust:
//   1. An explicit override (DSRUPT_AE_EXE, AE_MCP_EXE, or the legacy AE_EXE).
//   2. A running After Effects process: whatever the user has open is what
//      they mean, whichever version it is.
//   3. Installed copies found by bounded probes: the Adobe folder under each
//      Program Files root, the registry, Start Menu shortcuts (Windows);
//      /Applications, ~/Applications and a Spotlight bundle-id query (macOS);
//      plus any directories named in DSRUPT_AE_SEARCH_DIRS. Newest year wins,
//      and a release build beats a beta of the same year.
//
// Nothing here searches a whole disk. Every probe is a directory listing, an
// existence check, or one short child process; the result carries `notes`
// saying what was tried so the doctor can show its work.

import * as path from "node:path";
import { lines, realHost, type DiscoveryHost } from "./host.js";

export const ENV_OVERRIDES = ["DSRUPT_AE_EXE", "AE_MCP_EXE", "AE_EXE"] as const;
export const SEARCH_DIRS_ENV = "DSRUPT_AE_SEARCH_DIRS";

export interface AeCandidate {
  /** AfterFX.exe on Windows; the .app bundle on macOS. */
  path: string;
  source: string;
  year: number | null;
  beta: boolean;
}

export interface AeDiscovery {
  platform: NodeJS.Platform;
  found: AeCandidate | null;
  /** Every distinct install seen, best first. */
  candidates: AeCandidate[];
  /** Executable / bundle paths of After Effects processes alive right now. */
  running: string[];
  /** What was probed, and anything odd, in probe order. */
  notes: string[];
}

const AE_NAME = /after ?effects/i;

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function describe(p: string, source: string): AeCandidate {
  const year = p.match(/(20\d{2})/);
  return {
    path: normalize(p),
    source,
    year: year ? Number(year[1]) : null,
    beta: /beta/i.test(p),
  };
}

function bundleOf(p: string): string | null {
  const m = normalize(p).match(/^(.*?\.app)(\/|$)/);
  return m ? m[1] : null;
}

// --- Windows ------------------------------------------------------------------

function winProgramRoots(env: NodeJS.ProcessEnv): string[] {
  const raw = [
    env.ProgramW6432,
    env.ProgramFiles,
    env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ];
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    const key = normalize(r).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(r);
  }
  return roots;
}

/** `<dir>/<Adobe After Effects …>/Support Files/AfterFX.exe` for each matching child. */
function scanWindowsAdobeFolder(
  host: DiscoveryHost,
  adobeDir: string,
  source: string,
): AeCandidate[] {
  const out: AeCandidate[] = [];
  for (const entry of host.listDir(adobeDir)) {
    if (!AE_NAME.test(entry)) continue;
    const exe = path.win32.join(adobeDir, entry, "Support Files", "AfterFX.exe");
    if (host.exists(exe)) out.push(describe(exe, source));
  }
  return out;
}

function winRunningProcesses(host: DiscoveryHost, notes: string[]): string[] {
  const out = host.run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Get-Process -Name AfterFX -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }",
  ]);
  if (out === null) {
    notes.push("process check: PowerShell query failed (Get-Process AfterFX)");
    return [];
  }
  const found = lines(out).filter((l) => /afterfx\.exe$/i.test(l));
  notes.push(`process check: ${found.length} running AfterFX.exe`);
  return found;
}

const WIN_REGISTRY_KEYS = [
  "HKLM\\SOFTWARE\\Adobe\\After Effects",
  "HKLM\\SOFTWARE\\WOW6432Node\\Adobe\\After Effects",
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

/**
 * Any REG_SZ value mentioning After Effects is a lead; each lead is checked
 * as an exe, as a folder holding AfterFX.exe, and as an install root holding
 * `Support Files/AfterFX.exe`. Only leads that exist on disk become candidates.
 */
function winRegistry(host: DiscoveryHost, notes: string[]): AeCandidate[] {
  const out: AeCandidate[] = [];
  let queried = 0;
  for (const key of WIN_REGISTRY_KEYS) {
    const text = host.run("reg.exe", ["query", key, "/s"]);
    if (text === null) continue;
    queried++;
    for (const line of lines(text)) {
      const m = line.match(/REG_(?:EXPAND_)?SZ\s+(.+)$/i);
      if (!m) continue;
      const value = m[1].trim().replace(/^"|"$/g, "");
      if (!AE_NAME.test(value)) continue;
      const leads = /\.exe$/i.test(value)
        ? [value]
        : [
            path.win32.join(value, "AfterFX.exe"),
            path.win32.join(value, "Support Files", "AfterFX.exe"),
          ];
      for (const lead of leads) {
        if (/afterfx\.exe$/i.test(lead) && host.exists(lead)) out.push(describe(lead, "registry"));
      }
    }
  }
  notes.push(
    `registry: ${queried}/${WIN_REGISTRY_KEYS.length} keys readable, ${out.length} installs`,
  );
  return out;
}

/** Start Menu `.lnk` shortcuts, top level and one folder deep, resolved in one PowerShell call. */
function winStartMenu(host: DiscoveryHost, notes: string[]): AeCandidate[] {
  const menus = [host.env.ProgramData, host.env.APPDATA]
    .filter((v): v is string => !!v)
    .map((base) => path.win32.join(base, "Microsoft", "Windows", "Start Menu", "Programs"));
  const shortcuts: string[] = [];
  for (const menu of menus) {
    for (const entry of host.listDir(menu)) {
      const full = path.win32.join(menu, entry);
      if (/\.lnk$/i.test(entry)) {
        if (AE_NAME.test(entry)) shortcuts.push(full);
      } else if (!/\./.test(entry)) {
        for (const inner of host.listDir(full)) {
          if (/\.lnk$/i.test(inner) && AE_NAME.test(inner))
            shortcuts.push(path.win32.join(full, inner));
        }
      }
    }
  }
  if (shortcuts.length === 0) {
    notes.push("start menu: no After Effects shortcuts");
    return [];
  }
  const list = shortcuts.map((s) => `'${s.replace(/'/g, "''")}'`).join(",");
  const out = host.run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `$sh = New-Object -ComObject WScript.Shell; foreach ($p in @(${list})) { $sh.CreateShortcut($p).TargetPath }`,
  ]);
  const found = lines(out)
    .filter((l) => /afterfx\.exe$/i.test(l) && host.exists(l))
    .map((l) => describe(l, "start menu shortcut"));
  notes.push(`start menu: ${shortcuts.length} shortcuts, ${found.length} resolved to an install`);
  return found;
}

// --- macOS --------------------------------------------------------------------

function macRunningProcesses(host: DiscoveryHost, notes: string[]): string[] {
  const out = host.run("ps", ["-axo", "comm="]);
  if (out === null) {
    notes.push("process check: ps failed");
    return [];
  }
  const found: string[] = [];
  for (const line of lines(out)) {
    if (!/\.app\/Contents\/MacOS\//.test(line) || !AE_NAME.test(line)) continue;
    const bundle = bundleOf(line);
    if (bundle && !found.includes(bundle)) found.push(bundle);
  }
  notes.push(`process check: ${found.length} running After Effects`);
  return found;
}

function scanMacAppFolder(host: DiscoveryHost, dir: string, source: string): AeCandidate[] {
  const out: AeCandidate[] = [];
  for (const entry of host.listDir(dir)) {
    if (!AE_NAME.test(entry)) continue;
    const full = path.posix.join(dir, entry);
    if (/\.app$/i.test(entry)) {
      out.push(describe(full, source));
      continue;
    }
    for (const inner of host.listDir(full)) {
      if (/\.app$/i.test(inner) && AE_NAME.test(inner))
        out.push(describe(path.posix.join(full, inner), source));
    }
  }
  return out;
}

function macSpotlight(host: DiscoveryHost, notes: string[]): AeCandidate[] {
  const out = host.run("mdfind", ["kMDItemCFBundleIdentifier == 'com.adobe.AfterEffects*'"]);
  if (out === null) {
    notes.push("spotlight: mdfind unavailable");
    return [];
  }
  const found = lines(out)
    .filter((l) => /\.app$/i.test(l) && AE_NAME.test(l) && host.exists(l))
    .map((l) => describe(l, "spotlight"));
  notes.push(`spotlight: ${found.length} bundles`);
  return found;
}

// --- Shared -------------------------------------------------------------------

function customDirs(host: DiscoveryHost, notes: string[]): AeCandidate[] {
  const raw = host.env[SEARCH_DIRS_ENV]?.trim();
  if (!raw) return [];
  // Split on the TARGET platform's delimiter: the value describes that machine, not the one running the test.
  const delimiter = host.platform === "win32" ? ";" : ":";
  const dirs = raw
    .split(delimiter)
    .map((d) => d.trim())
    .filter(Boolean);
  const out: AeCandidate[] = [];
  for (const dir of dirs) {
    const source = `${SEARCH_DIRS_ENV}`;
    if (host.platform === "darwin") {
      if (/\.app$/i.test(dir) && host.exists(dir)) out.push(describe(dir, source));
      out.push(...scanMacAppFolder(host, dir, source));
    } else {
      for (const exe of [
        path.win32.join(dir, "AfterFX.exe"),
        path.win32.join(dir, "Support Files", "AfterFX.exe"),
      ]) {
        if (host.exists(exe)) out.push(describe(exe, source));
      }
      out.push(...scanWindowsAdobeFolder(host, dir, source));
    }
  }
  notes.push(`${SEARCH_DIRS_ENV}: ${dirs.length} dirs, ${out.length} installs`);
  return out;
}

function envOverride(host: DiscoveryHost, notes: string[]): AeCandidate | null {
  for (const name of ENV_OVERRIDES) {
    const value = host.env[name]?.trim();
    if (!value) continue;
    if (host.exists(value)) {
      notes.push(`${name} is set and exists`);
      return describe(value, `env ${name}`);
    }
    notes.push(`${name} is set but does not exist: ${value}`);
  }
  return null;
}

function dedupe(candidates: AeCandidate[]): AeCandidate[] {
  const seen = new Set<string>();
  const out: AeCandidate[] = [];
  for (const c of candidates) {
    const key = c.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function rank(a: AeCandidate, b: AeCandidate): number {
  if (a.beta !== b.beta) return a.beta ? 1 : -1;
  return (b.year ?? 0) - (a.year ?? 0);
}

export function discoverAfterEffects(host: DiscoveryHost = realHost()): AeDiscovery {
  const notes: string[] = [];
  const override = envOverride(host, notes);
  const isMac = host.platform === "darwin";

  const running = isMac ? macRunningProcesses(host, notes) : winRunningProcesses(host, notes);
  const runningCandidates = running.map((p) => describe(p, "running process"));

  const installed: AeCandidate[] = [];
  if (isMac) {
    for (const dir of ["/Applications", path.posix.join(normalize(host.homedir), "Applications")]) {
      const found = scanMacAppFolder(host, dir, dir);
      notes.push(`${dir}: ${found.length} installs`);
      installed.push(...found);
    }
    installed.push(...macSpotlight(host, notes));
  } else {
    for (const root of winProgramRoots(host.env)) {
      const adobeDir = path.win32.join(root, "Adobe");
      const found = scanWindowsAdobeFolder(host, adobeDir, adobeDir);
      notes.push(`${adobeDir}: ${found.length} installs`);
      installed.push(...found);
    }
    installed.push(...winRegistry(host, notes));
    installed.push(...winStartMenu(host, notes));
  }
  installed.push(...customDirs(host, notes));

  const candidates = dedupe([
    ...(override ? [override] : []),
    ...runningCandidates,
    ...installed.sort(rank),
  ]);
  const found = override ?? runningCandidates[0] ?? candidates[0] ?? null;
  return { platform: host.platform, found, candidates, running, notes };
}

/** The error a tool call sees when nothing was found: says what was tried. */
export function notFoundMessage(discovery: AeDiscovery): string {
  const example =
    discovery.platform === "darwin"
      ? '"/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app"'
      : '"C:/Program Files/Adobe/Adobe After Effects 2026/Support Files/AfterFX.exe"';
  return (
    `Could not locate After Effects. Set DSRUPT_AE_EXE to the ${
      discovery.platform === "darwin" ? ".app bundle" : "AfterFX.exe path"
    }, e.g. ${example}, or add its parent folder to ${SEARCH_DIRS_ENV}. ` +
    `Probed: ${discovery.notes.join("; ")}`
  );
}
