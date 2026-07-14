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
  // Retained for backward compatibility with any residual consumer.
  // Always null for the nine-engine rebuild.
  validation?: null;
  validationError?: string;
  // Retained purely for schema stability with legacy decision packages.
  taskType?: string;
};

export const LOC_MARKDOWN_DIVIDER =
  "\n\n---\n\n# LEFT-OF-CENTRE ENGINES — Nine Propositions\n\n";

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
  const header = `${LOC_MARKDOWN_DIVIDER}_Generated: ${args.generatedAt} (retry ${args.retryCount}) — ${args.sourceNote}_\n\n`;

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
