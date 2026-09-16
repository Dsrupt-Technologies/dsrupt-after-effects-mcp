import { z } from "zod";

import { errorResult } from "../errors.js";
import { SkillLookupError, SkillStore } from "../skills.js";
import { defineTool, jsonResult } from "./define-tool.js";

let store: SkillStore | null = null;

function skills(): SkillStore {
  store ??= new SkillStore();
  return store;
}

export const getSkillTool = defineTool({
  name: "ae_get_skill",
  title: "After Effects skills",
  description:
    "Read the bundled After Effects skills, one document at a time, without touching After Effects or the network. " +
    "No arguments: the index (skill names, one-line descriptions, reference lists). " +
    "{ name }: that skill's entry document. { name, reference }: one reference listed by the entry. " +
    "Start every AE task with ae_get_skill({ name: 'ae-clean-rig' }); load references only when the task needs them.",
  group: "inspect",
  blockedInReadOnly: false,
  effect: "read",
  inputShape: {
    name: z
      .string()
      .min(1)
      .optional()
      .describe("Skill name exactly as listed in the index, e.g. 'ae-clean-rig'."),
    reference: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Reference path exactly as listed by the skill, e.g. 'references/sliders.md'. Requires name.",
      ),
  },
  handler: async (args, _transport) => {
    if (args.reference && !args.name) {
      return errorResult("INVALID_ARGS", "reference requires name", {
        hint: "Call ae_get_skill({}) for the index, then ae_get_skill({ name, reference }).",
      });
    }
    try {
      const s = skills();
      return jsonResult(args.name ? { ...s.read(args.name, args.reference) } : s.index());
    } catch (err) {
      if (err instanceof SkillLookupError) {
        return errorResult("INVALID_ARGS", err.message, {
          details: {
            ...(args.name ? { name: args.name } : {}),
            ...(args.reference ? { reference: args.reference } : {}),
            ...(err.suggestion ? { suggestion: err.suggestion } : {}),
          },
        });
      }
      return errorResult("IO", err instanceof Error ? err.message : String(err), {
        hint: "The skill bundle could not be read. Run `dsrupt-after-effects doctor`.",
      });
    }
  },
});
