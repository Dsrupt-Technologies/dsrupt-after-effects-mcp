---
name: dsrupt-after-effects
description: Set up and use the Dsrupt After Effects MCP when the user asks to connect After Effects to their AI, install its local integration, or build and edit motion graphics inside an open Adobe After Effects project. Local coding agents only.
---

# Dsrupt After Effects

Describe the motion graphics you need and the agent builds them straight into the open After Effects comp as native, editable layers. The MCP server runs on this computer next to After Effects; no cloud relay, no panel inside the app. Every real instruction lives on that server and is read through its `ae_get_skill` tool. This file only gets you there.

Register the server as `dsrupt-after-effects`. Use "Dsrupt After Effects" as the user-facing name.

## Setup

1. Find the checkout of `dsrupt-after-effects-mcp` on this machine (the user's path, or clone `https://github.com/Dsrupt-Technologies/dsrupt-after-effects-mcp.git`). Requires Windows or macOS, After Effects 2024 to 2026, Node 24 or newer.
2. In that checkout run `npm ci --ignore-scripts`, `npm run build`, then `node dist/cli/index.js doctor`. The doctor checks files, Node and where After Effects is installed; it does not launch After Effects. On Windows, "running scripts is disabled" from PowerShell means `npm.ps1` is blocked, not that npm is missing: use `npm.cmd` or cmd.exe.
3. Register with your own client: `node dist/cli/index.js install-claude-code` (Claude Code), `install-codex` (Codex), or paste the block from `node dist/cli/index.js config` into any other client. Start a new session so the client connects.
4. With After Effects open on a project, run `node dist/cli/index.js check-ae`. It reports the server, the tools, the skills and After Effects as separate results.
5. In your session call `ae_get_skill({})` and then `ae_project_info({})`. Only report "connected" when both succeed here. If After Effects reports that scripts may not write files, ask the user to enable Preferences > Scripting & Expressions > "Allow Scripts to Write Files and Access Network". On macOS, the first call asks for Automation permission.

## Work

Start every task with `ae_get_skill({ name: "ae-clean-rig" })` and follow its routing. Inspect the project before editing, discover operations with `ae_catalog`, build with `ae_do`, verify with `ae_render_frame` by looking at the frame, save only to the path the user agreed. Preserve unsaved work. A skill cannot create a tool that is not advertised in the session.

When the Dsrupt connector is also connected, it supplies the media and the brand: read `get_agent_guide key=after_effects` there for how the two work together.
