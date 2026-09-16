#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { RUNTIME_DIR } from "./config.js";
import { errorResult } from "./errors.js";
import { denyTool, policySummary, readOnlyMode } from "./policy.js";
import { FileIpcTransport } from "./transport/FileIpcTransport.js";

// Load all operations into the registry (must run before catalog/do handle calls).
import "./operations/index.js";
import { ALL_TOOLS, type AnyTool } from "./tools/index.js";

// Read the real package version at runtime so the server never self-reports a
// stale literal. dist/index.js sits one level below package.json in both the
// repo and the published tarball.
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const transport = new FileIpcTransport();

const server = new McpServer(
  {
    name: "dsrupt-after-effects",
    title: "Dsrupt After Effects",
    version,
  },
  {
    instructions:
      "Dsrupt After Effects: local control of Adobe After Effects with bundled skills. " +
      "Before building or editing, read ae_get_skill({ name: 'ae-clean-rig' }) and load only the references it routes you to. " +
      "Inspect the project first (ae_project_info, ae_comp_info, ae_layer_info), discover exact operations with ae_catalog, " +
      "execute with ae_do, verify with ae_render_frame by looking at the image, and save with ae_save_project only to the intended path. " +
      "Skills and the catalog work with After Effects closed; ae_project_info is the connection test. " +
      "A batch.run is one undo group but not a transaction, and a TIMEOUT may mean the change already applied: inspect before retrying a mutation. " +
      "Preserve unsaved user work; never reset or close a project unasked.",
  },
);

/**
 * MCP behaviour hints, derived from each tool's declared `effect` rather than
 * from a name list that has to be kept in sync by hand. `ae_do` declares
 * itself destructive: its real effect depends on the operation it dispatches,
 * and clients that see no annotation at all tend to treat a tool as safe.
 */
function annotationsFor(tool: AnyTool): { readOnlyHint?: boolean; destructiveHint?: boolean } {
  switch (tool.effect) {
    case "read":
      return { readOnlyHint: true };
    case "destructive":
      return { destructiveHint: true };
    case "write":
      return { destructiveHint: false };
  }
}

function register(tool: AnyTool): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputShape,
      annotations: annotationsFor(tool),
    },
    async (args: unknown) => {
      try {
        return await tool.handler(args as any, transport);
      } catch (err) {
        // A handler throwing is a bug in this server, not a modelling error —
        // report it under its own code so it is never mistaken for a
        // retryable AE hiccup.
        return errorResult("TRANSPORT", err instanceof Error ? err.message : String(err), {
          details: { tool: tool.name },
          stack: err instanceof Error ? (err.stack ?? null) : null,
        });
      }
    },
  );
}

const skipped: string[] = [];
for (const tool of ALL_TOOLS) {
  const denial = denyTool(tool.name, tool.blockedInReadOnly);
  if (denial) {
    skipped.push(tool.name);
    continue;
  }
  register(tool);
}

async function main(): Promise<void> {
  console.error(`[dsrupt-after-effects] policy: ${policySummary()}`);
  console.error(`[dsrupt-after-effects] mailbox: ${RUNTIME_DIR}`);
  if (readOnlyMode()) {
    console.error(
      `[dsrupt-after-effects] read-only mode — ${skipped.length > 0 ? `tools withheld: ${skipped.join(", ")}; ` : ""}` +
        "ae_do accepts only operations that cannot modify the project.",
    );
  } else {
    console.error(
      "[dsrupt-after-effects] WRITE ACCESS IS ON — tools can create, mutate and delete project content. " +
        "Set AE_MCP_READONLY=1 for inspection-only sessions.",
    );
  }
  const stdio = new StdioServerTransport();
  await server.connect(stdio);
}

main().catch((err) => {
  process.stderr.write(
    `dsrupt-after-effects fatal: ${err && err.stack ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
