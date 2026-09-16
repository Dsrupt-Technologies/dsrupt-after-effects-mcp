// Node / npm checks: the Windows execution-policy trap must read as
// "npm present, PowerShell blocked", never as "npm missing".

import { describe, expect, it } from "vitest";

import type { DiscoveryHost } from "../src/discovery/host.js";
import { describeNodeManager, nodeToolchainChecks } from "../src/discovery/node-toolchain.js";

function host(spec: {
  platform: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  run?: Record<string, string | null>;
  shell?: Record<string, string | null>;
}): DiscoveryHost {
  return {
    platform: spec.platform,
    env: spec.env ?? {},
    homedir: "/home/x",
    exists: () => false,
    listDir: () => [],
    run: (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      for (const [pattern, out] of Object.entries(spec.run ?? {}))
        if (key.includes(pattern)) return out;
      return null;
    },
    runShell: (line) => {
      for (const [pattern, out] of Object.entries(spec.shell ?? {}))
        if (line.includes(pattern)) return out;
      return null;
    },
  };
}

function byName(checks: ReturnType<typeof nodeToolchainChecks>, name: string) {
  const c = checks.find((x) => x.name === name);
  if (!c) throw new Error(`no check named ${name}`);
  return c;
}

describe("nodeToolchainChecks", () => {
  it("passes a healthy macOS toolchain and flags an old node", () => {
    const h = host({
      platform: "darwin",
      run: {
        "which -a npm": "/opt/homebrew/bin/npm\n",
        "which -a npx": "/opt/homebrew/bin/npx\n",
        "--version": "11.0.0\n",
      },
    });
    const good = nodeToolchainChecks(h, "24.2.0", "/opt/homebrew/bin/node");
    expect(byName(good, "node").ok).toBe(true);
    expect(byName(good, "node").detail).toContain("Homebrew");
    expect(byName(good, "npm")).toMatchObject({
      ok: true,
      detail: expect.stringContaining("11.0.0"),
    });
    expect(good.find((c) => c.name === "powershell-policy")).toBeUndefined();

    const old = nodeToolchainChecks(h, "22.18.0", "/usr/local/bin/node");
    expect(byName(old, "node").ok).toBe(false);
    expect(byName(old, "node").hint).toContain("24");
  });

  it("treats a blocked npm.ps1 as npm present, with the policy named separately", () => {
    const h = host({
      platform: "win32",
      run: {
        "where.exe npm": "C:\\Program Files\\nodejs\\npm\r\nC:\\Program Files\\nodejs\\npm.cmd\r\n",
        "where.exe npx": "C:\\Program Files\\nodejs\\npx.cmd\r\n",
        "Get-ExecutionPolicy": "Restricted\r\n",
      },
      // The .cmd shim exists but did not run in this fake shell.
      shell: {},
    });
    const checks = nodeToolchainChecks(h, "24.0.0", "C:\\Program Files\\nodejs\\node.exe");
    const npm = byName(checks, "npm");
    expect(npm.ok).toBe(true);
    expect(npm.detail).toContain("npm.cmd");
    expect(npm.hint).toMatch(/execution policy/);
    const policy = byName(checks, "powershell-policy");
    expect(policy.ok).toBe(true);
    expect(policy.detail).toContain("Restricted");
    expect(policy.hint).toContain("npm.cmd");
  });

  it("runs the Windows .cmd shim through the shell and reports the version", () => {
    const h = host({
      platform: "win32",
      run: {
        "where.exe npm": "C:\\Users\\x\\AppData\\Roaming\\nvm\\v24.0.0\\npm.cmd\r\n",
        "where.exe npx": "C:\\Users\\x\\AppData\\Roaming\\nvm\\v24.0.0\\npx.cmd\r\n",
        "Get-ExecutionPolicy": "RemoteSigned\r\n",
      },
      shell: { 'npm.cmd" --version': "11.4.0\r\n", 'npx.cmd" --version': "11.4.0\r\n" },
    });
    const checks = nodeToolchainChecks(
      h,
      "24.0.0",
      "C:\\Users\\x\\AppData\\Roaming\\nvm\\v24.0.0\\node.exe",
    );
    expect(byName(checks, "npm")).toMatchObject({
      ok: true,
      detail: expect.stringContaining("11.4.0"),
    });
    expect(byName(checks, "powershell-policy").hint).toBeUndefined();
  });

  it("only fails npm when nothing is found at all", () => {
    const h = host({ platform: "win32", run: { "Get-ExecutionPolicy": "RemoteSigned" } });
    const checks = nodeToolchainChecks(h, "24.0.0", "C:\\node\\node.exe");
    expect(byName(checks, "npm").ok).toBe(false);
    expect(byName(checks, "npm").detail).toContain("not found");
  });

  it("names the version manager and adds a pinning reminder", () => {
    expect(
      describeNodeManager(
        { NVM_DIR: "/Users/x/.nvm" },
        "/Users/x/.nvm/versions/node/v24.0.0/bin/node",
      ),
    ).toBe("nvm");
    expect(describeNodeManager({ NVM_HOME: "C:\\nvm" }, "C:\\nvm\\v24.0.0\\node.exe")).toBe(
      "nvm-windows",
    );
    expect(
      describeNodeManager(
        { VOLTA_HOME: "C:\\Users\\x\\.volta" },
        "C:\\Users\\x\\.volta\\tools\\image\\node\\24.0.0\\node.exe",
      ),
    ).toBe("Volta");
    expect(describeNodeManager({}, "/Users/x/.fnm/node-versions/v24/installation/bin/node")).toBe(
      "fnm",
    );
    expect(describeNodeManager({}, "/usr/local/n/versions/node/24.0.0/bin/node")).toBe("n");
    expect(describeNodeManager({}, "C:\\Program Files\\nodejs\\node.exe")).toBe(
      "nodejs.org installer",
    );
    expect(describeNodeManager({}, "/custom/node")).toBeNull();

    const h = host({ platform: "darwin", env: { NVM_DIR: "/Users/x/.nvm" } });
    const checks = nodeToolchainChecks(h, "24.0.0", "/Users/x/.nvm/versions/node/v24.0.0/bin/node");
    expect(byName(checks, "node-manager").hint).toContain("config");
  });
});
