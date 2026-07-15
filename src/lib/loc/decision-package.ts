// Rendering for the nine-engine LOC output. Each engine contributes a
// single block: ENGINE NAME / [THE LINE] / [one-sentence descriptor].
// No validation, no courage assessment, no credible path, no territory
// description, no strategic rationale.

import type { EngineName } from "./task-types";
import { LOC_ENGINE_LABEL, LOC_ENGINES } from "./task-types";
import type { EngineOutput } from "./engine-prompts";

export type LocEnginePackage = {
  engine: EngineName;
  engineOutput: EngineOutput;
  // Six-dimension validation score (from runValidationPass). Retained as
  // optional/null-friendly for backward compatibility with pre-validation packages.
  validation?: import("./validation").ValidationScore | null;
  validationError?: string | null;
  // Retained purely for schema stability with legacy decision packages.
  taskType?: string;
};

const NUMBER_WORD: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
  7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven",
  12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen",
};

function locHeadingForCount(count: number): string {
  const word = NUMBER_WORD[count] ?? String(count);
  return `\n\n---\n\n# LEFT-OF-CENTRE ENGINES — ${word} Propositions\n\n`;
}

/** Retained for callers that reference a static divider (e.g. Stage 12 split). */
export const LOC_MARKDOWN_DIVIDER = "\n\n---\n\n# LEFT-OF-CENTRE ENGINES —";

export function renderLocDecisionPackage(pkg: LocEnginePackage): string {
  const line = pkg.engineOutput.proposition?.trim() || "(no line generated)";
  const desc = pkg.engineOutput.descriptor?.trim() || "";
  const word = pkg.engineOutput.word?.trim();
  const wordBlock = word ? `**THE WORD:** ${word}\n\n` : "";
  return `## ${LOC_ENGINE_LABEL[pkg.engine]}

${wordBlock}**${line}**

${desc}`;
}

export function renderLocFullMarkdown(args: {
  packages: LocEnginePackage[];
  retryCount: number;
  generatedAt: string;
  sourceNote: string;
}): string {
  // Count only engines that actually produced a proposition line.
  const withOutput = args.packages.filter(
    (p) => !!p.engineOutput?.proposition?.trim(),
  ).length;
  const header = `${locHeadingForCount(withOutput)}_Generated: ${args.generatedAt} (retry ${args.retryCount}) — ${args.sourceNote}_\n\n`;


  // Preserve engine order regardless of Promise.all completion order.
  const byEngine = new Map<EngineName, LocEnginePackage>();
  for (const p of args.packages) byEngine.set(p.engine, p);

  const ordered: string[] = [];
  for (const engine of LOC_ENGINES) {
    const p = byEngine.get(engine);
    if (p) {
      ordered.push(renderLocDecisionPackage(p));
    } else {
      ordered.push(`## ${LOC_ENGINE_LABEL[engine]}\n\n_(engine failed to return output)_`);
    }
  }

  return header + ordered.join("\n\n---\n\n");
}
