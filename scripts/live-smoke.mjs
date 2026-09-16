#!/usr/bin/env node
// Live smoke test against a real After Effects, through the built MCP server
// exactly as a client would use it:
//
//   ae_get_skill -> ae_project_info -> ae_catalog -> ae_do (batch build)
//   -> ae_layer_info (expression check) -> ae_render_frame x3 -> ae_save_project
//
// Safety: it refuses to run unless the open project is empty, clean and
// unsaved (a fresh File > New), so it can never touch real work. With
// DSRUPT_SMOKE_IN_PROJECT=1 it will add its comp to whatever project is
// open but then skips the save, because Save As would re-path the user's
// project. Output goes to runtime/dsrupt-smoke/ (git-ignored).

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const OUT = resolve(ROOT, "runtime", "dsrupt-smoke");
const COMP = "Dsrupt Smoke";
const inProject = process.env.DSRUPT_SMOKE_IN_PROJECT === "1";

const client = new Client({ name: "dsrupt-live-smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [resolve(ROOT, "dist", "index.js")],
    env: { ...process.env },
    stderr: "pipe",
  }),
);

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  const text = (res.content ?? []).map((c) => c.text ?? "").join("\n");
  if (res.isError) throw new Error(`${name} failed:\n${text}`);
  return res.structuredContent ?? JSON.parse(text);
}

const report = { startedAt: new Date().toISOString(), steps: [] };
function step(name, data) {
  report.steps.push({ name, ...data });
  console.log(`[ok] ${name}${data.summary ? `: ${data.summary}` : ""}`);
}

try {
  const index = await call("ae_get_skill");
  step("ae_get_skill index", { summary: `${index.skills.length} skills` });
  const rig = await call("ae_get_skill", { name: "ae-clean-rig" });
  step("ae_get_skill ae-clean-rig", { summary: `${rig.references.length} references` });

  const before = await call("ae_project_info");
  const p = before.result;
  step("ae_project_info", {
    summary: `${p.file ?? "(unsaved)"}, ${p.numItems} items, ${p.dirty ? "dirty" : "clean"}`,
    durationMs: before.durationMs,
  });
  const fresh = p.numItems === 0 && !p.dirty && !p.file;
  if (!fresh && !inProject) {
    throw new Error(
      "Refusing to run: the open project is not a fresh, empty, unsaved one. " +
        "Open File > New > New Project and rerun, or set DSRUPT_SMOKE_IN_PROJECT=1 to add the smoke comp to this project (no save).",
    );
  }
  if (p.items?.some((i) => i.name === COMP)) {
    throw new Error(`A comp named "${COMP}" already exists. Delete it or pick a fresh project.`);
  }

  const catalog = await call("ae_catalog");
  step("ae_catalog", {
    summary: `${catalog.totalOperations} operations, policy ${catalog.policy}`,
  });
  for (const category of ["comp", "layer", "shape", "text", "keyframe", "batch"])
    await call("ae_catalog", { category });

  const ops = [];
  const add = (operation, args) => ops.push({ operation, args });
  const at = (layer, value) =>
    add("property.set", {
      comp: COMP,
      layer,
      property: ["ADBE Transform Group", "ADBE Position"],
      value,
    });
  const opacity = ["ADBE Transform Group", "ADBE Opacity"];

  add("comp.create", { name: COMP, width: 1280, height: 720, fps: 30, duration: 3 });
  for (const [name, size, color, pos, roundness] of [
    ["Background", [1280, 720], [0.06, 0.07, 0.09, 1], [640, 360], 0],
    ["Card", [1040, 480], [0.11, 0.13, 0.17, 1], [640, 360], 28],
    ["Accent", [96, 6], [0.98, 0.42, 0.2, 1], [212, 226], 3],
  ]) {
    add("layer.create_shape", { comp: COMP, name });
    add("shape.add_group", { comp: COMP, layer: name, name: "Surface" });
    add("shape.add_rect", { comp: COMP, layer: name, groupIndex: 1, size, roundness });
    add("shape.add_fill", { comp: COMP, layer: name, groupIndex: 1, color });
    at(name, pos);
  }
  for (const [name, text, fontSize, pos, color] of [
    ["Eyebrow", "DSRUPT / AFTER EFFECTS", 20, [172, 190], [0.98, 0.42, 0.2]],
    ["Title", "Connected.", 92, [166, 372], [0.97, 0.97, 0.98]],
    [
      "Subtitle",
      "Native layers. Local control. Skills on demand.",
      28,
      [172, 438],
      [0.66, 0.7, 0.76],
    ],
    ["Footer", "MCP  >  EXTENDSCRIPT  >  AFTER EFFECTS", 16, [172, 560], [0.45, 0.5, 0.58]],
  ]) {
    add("layer.create_text", { comp: COMP, name, text });
    add("text.set_style", {
      comp: COMP,
      layer: name,
      font: "ArialMT",
      fontSize,
      fillColor: color,
      applyFill: true,
      applyStroke: false,
      justification: "left",
    });
    at(name, pos);
  }
  for (const [layer, delay] of [
    ["Title", 0],
    ["Subtitle", 0.15],
    ["Footer", 0.3],
  ]) {
    add("keyframe.add", { comp: COMP, layer, property: opacity, time: delay, value: 0 });
    add("keyframe.add", { comp: COMP, layer, property: opacity, time: delay + 0.5, value: 100 });
    for (const keyIndex of [1, 2])
      add("keyframe.set_easing", {
        comp: COMP,
        layer,
        property: opacity,
        keyIndex,
        preset: "ease",
      });
  }
  add("expression.set", {
    comp: COMP,
    layer: "Accent",
    property: ["ADBE Transform Group", "ADBE Scale"],
    expression: "var t = Math.min(1, Math.max(0, time / 0.6)); [100 * t, 100]",
  });

  const built = await call("ae_do", {
    operation: "batch.run",
    args: { ops, stopOnError: true },
    timeoutMs: 180_000,
  });
  step("ae_do batch.run", { summary: `${ops.length} operations`, durationMs: built.durationMs });

  const layers = await call("ae_layer_info", {
    compNameOrId: COMP,
    layerIndex: "all",
    includeProperties: false,
  });
  step("ae_layer_info", {
    summary: `${layers.result.count ?? layers.result.layers?.length ?? "?"} layers`,
  });
  const accent = await call("ae_layer_info", { compNameOrId: COMP, layerIndex: 1 });
  const exprErrors = JSON.stringify(accent.result).match(/"expressionError":"[^"]+"/g) ?? [];
  if (exprErrors.length) throw new Error(`expression errors: ${exprErrors.join(", ")}`);
  step("expression check", { summary: "no expressionError on the accent layer" });

  mkdirSync(OUT, { recursive: true });
  const frames = [];
  for (const time of [0, 0.4, 1.2]) {
    const outPath = resolve(OUT, `frame-${time}.png`);
    const r = await call("ae_render_frame", { compNameOrId: COMP, time, outPath });
    const bytes = statSync(outPath).size;
    if (bytes < 1000)
      throw new Error(`render at ${time}s produced a suspiciously small file (${bytes} bytes)`);
    frames.push({ time, outPath, bytes, colorPipeline: r.result.colorPipeline ?? null });
    step(`ae_render_frame t=${time}`, { summary: `${bytes} bytes`, durationMs: r.durationMs });
  }
  report.frames = frames;

  if (fresh) {
    const saved = await call("ae_save_project", { path: resolve(OUT, "dsrupt-smoke.aep") });
    step("ae_save_project", { summary: saved.result.path });
    report.project = saved.result.path;
  } else {
    step("ae_save_project", {
      summary: "skipped (DSRUPT_SMOKE_IN_PROJECT=1: not re-pathing your project)",
    });
  }
  const after = await call("ae_project_info");
  report.after = after.result;
  report.ok = true;
} catch (err) {
  report.ok = false;
  report.error = err instanceof Error ? err.message : String(err);
  console.error(`[!!] ${report.error}`);
  process.exitCode = 1;
} finally {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${resolve(OUT, "report.json")}`);
  console.log("Now open the three PNGs and look at them: a tool result is not visual proof.");
  await client.close();
}
