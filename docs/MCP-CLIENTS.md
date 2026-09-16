# Registering with MCP clients

The server is a stdio process: `node <checkout>/dist/index.js`. Every client needs the
absolute path of a Node 24+ binary and of that file. `node dist/cli/index.js config` prints
both for the copy you built, and `--env KEY=VALUE` adds environment variables (repeatable).

The registration name is `dsrupt-after-effects`.

## Codex CLI

```bash
node dist/cli/index.js install-codex
```

Runs `codex mcp add dsrupt-after-effects -- <node> <dist/index.js>`. It refuses to overwrite an
existing registration that points elsewhere; inspect that one with `codex mcp get`, remove
it with `codex mcp remove`, then rerun. Restart Codex or reconnect its MCP servers afterwards.

To write the config by hand, `node dist/cli/index.js config --client codex` prints the
`config.toml` block:

```toml
[mcp_servers.dsrupt_after_effects]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/dsrupt-after-effects-mcp/dist/index.js"]
```

## Claude Code

```bash
node dist/cli/index.js install-claude-code
```

Runs `claude mcp add --scope user dsrupt-after-effects -- <node> <dist/index.js>`. Without the
`claude` CLI on PATH, `config --client claude-code` prints the command to run yourself. Start a
new Claude Code session so it connects.

## Claude Desktop, Cursor, Windsurf and other JSON-configured clients

```bash
node dist/cli/index.js config
```

prints:

```json
{
  "mcpServers": {
    "dsrupt-after-effects": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/dsrupt-after-effects-mcp/dist/index.js"]
    }
  }
}
```

Merge it into the client's MCP configuration file (Claude Desktop: Settings > Developer >
Edit Config; Cursor: `.cursor/mcp.json` or the global MCP settings). Restart the client.

## Environment variables per client

Add an `env` block for read-only sessions or an explicit After Effects path:

```bash
node dist/cli/index.js config --env AE_MCP_READONLY=1
node dist/cli/index.js config --env "DSRUPT_AE_EXE=C:\Apps\AE 2026\Support Files\AfterFX.exe"
```

## After registering

Inside the client, ask the agent to call `ae_get_skill({})` and then `ae_project_info({})`.
The first proves the server is connected to that conversation; the second proves After
Effects answers from that client (on macOS, each client app gets its own Automation prompt).
A client that was started before the registration shows no tools until it reconnects.

## Remote clients

Web chat clients (claude.ai, ChatGPT in the browser) cannot launch a local stdio process.
This server is for desktop agents on the machine that runs After Effects.
