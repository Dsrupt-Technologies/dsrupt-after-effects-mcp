// The small slice of the operating system that discovery needs, behind an
// interface so tests can describe a Windows or macOS machine without one.
//
// Every probe must be cheap and bounded: a directory listing, an existence
// check, or one short-lived child process with a timeout. Nothing here walks
// a disk.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import * as os from "node:os";

export interface DiscoveryHost {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homedir: string;
  exists(p: string): boolean;
  /** Entries of a directory, or [] when it is missing or unreadable. */
  listDir(dir: string): string[];
  /** stdout of a command that exited 0, or null on any failure. Never throws. */
  run(command: string, args: string[]): string | null;
  /**
   * Same, but through the platform shell. Only for Windows `.cmd` shims,
   * which Node refuses to spawn directly.
   */
  runShell(commandLine: string): string | null;
}

const CHILD_TIMEOUT_MS = 8_000;

export function realHost(platform: NodeJS.Platform = process.platform): DiscoveryHost {
  return {
    platform,
    env: process.env,
    homedir: os.homedir(),
    exists: (p) => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    },
    listDir: (dir) => {
      try {
        return readdirSync(dir);
      } catch {
        return [];
      }
    },
    run: (command, args) => {
      try {
        const r = spawnSync(command, args, {
          encoding: "utf8",
          timeout: CHILD_TIMEOUT_MS,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (r.error || r.status !== 0) return null;
        return r.stdout;
      } catch {
        return null;
      }
    },
    runShell: (commandLine) => {
      try {
        const r = spawnSync(commandLine, {
          encoding: "utf8",
          timeout: CHILD_TIMEOUT_MS,
          windowsHide: true,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (r.error || r.status !== 0) return null;
        return r.stdout;
      } catch {
        return null;
      }
    },
  };
}

/** Non-empty, trimmed lines of a command's output. */
export function lines(output: string | null): string[] {
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
