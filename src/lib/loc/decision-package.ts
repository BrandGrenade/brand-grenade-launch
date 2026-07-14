// Renders the LOC decision packages into the markdown stored in
// stage_9_leftofcentre_output, which the existing Stage 9 UI already
// displays. All structural data is also persisted separately in
// loc_engine_outputs / loc_validation / loc_decision_packages so the
// working is preserved as an audit trail, not just rendered text.

import type { EngineName, LocTaskType } from "./task-types";
import { LOC_TASK_TYPE_LABEL, LOC_ENGINE_QUESTIONS, LOC_TASK_CONSTRAINT } from "./task-types";
import type { EngineOutput } from "./engine-prompts";
import type { LocValidationResult } from "./validation-prompts";
import type { LocClassifierResult } from "./classifier-prompt";
import { LOC_CASE_LIBRARY } from "./case-library";

export type LocEnginePackage = {
  engine: EngineName;
  taskType: LocTaskType;
  engineOutput: EngineOutput;
  validation: LocValidationResult | null;
  validationError?: string;
};

const ENGINE_LABEL: Record<EngineName, string> = {
  breach: "BREACH — Disruption / SCAMPER Reverse",
  synect: "SYNECT — Compressed Conflict + Klement JTBD",
  displace: "DISPLACE — Random Entry",
  naive: "NAIVE — Category Outsider",
};

export const LOC_MARKDOWN_DIVIDER =
  "\n\n---\n\n# LEFT-OF-CENTRE ENGINES — Strategic Decision Packages\n\n";

function propositionOrRawMaterial(engine: EngineName, out: EngineOutput): { text: string; label: string } {
  if (!out.proposition) return { text: "(no credible territory found)", label: "STATUS" };
  // For Displace and Naive, the proposition may be raw material rather than a
  // finished line. Label transparently per spec.
  if (engine === "displace" || engine === "naive") {
    return { text: out.proposition, label: "PROPOSITION (raw material)" };
  }
  return { text: out.proposition, label: "PROPOSITION" };
}

function renderCases(taskType: LocTaskType): string {
  return LOC_CASE_LIBRARY[taskType]
    .map((c) => `- ${c.case} — ${c.principle}`)
    .join("\n");
}

function renderEngineWorking(engine: EngineName, out: EngineOutput): string {
  const acknowledged = out.cases_acknowledged?.length
    ? out.cases_acknowledged.map((p) => `  - ${p}`).join("\n")
    : "  (none acknowledged)";

  const commonHeader = `**Cases acknowledged (then set aside):**\n${acknowledged}\n`;

  switch (out.engine) {
    case "breach":
      return `${commonHeader}
**Dominant assumption:** ${out.dominant_assumption}
**Assumption reversed:** ${out.assumption_reversed}
**Human truth in the opposite:** ${out.human_truth_in_the_opposite || "(none)"}
**Territory:** ${out.territory || "(no credible territory)"}`;
    case "synect":
      return `${commonHeader}
**Compressed conflict:** ${out.compressed_conflict}
**Paradox unpacked:** ${out.paradox_unpacked}
**Identity aspiration:** ${out.identity_aspiration}
**Intersection territory:** ${out.intersection_territory || "(no credible territory)"}`;
    case "displace":
      return `${commonHeader}
**Random domain:** ${out.domain}
**Specific stimulus:** ${out.stimulus}
**Brand's fundamental human problem:** ${out.brand_human_problem}
**Connection:** ${out.connection}
**Why the connection is genuine:** ${out.why_connection_is_genuine}
**Strategic insight:** ${out.strategic_insight}`;
    case "naive":
      return `${commonHeader}
**Literal product:** ${out.literal_product}
**Fundamental need:** ${out.fundamental_need}
**Category conventions stripped:**
${(out.category_conventions_stripped ?? []).map((c) => `  - ${c}`).join("\n") || "  (none)"}
**Naive promise:** ${out.naive_promise}
**Underlying want:** ${out.underlying_want}
**Standing check:** ${out.standing_check}`;
  }
}

function renderValidation(v: LocValidationResult): string {
  const score = (label: string, s?: { score?: number; rationale?: string } | null) =>
    `- **${label}: ${s?.score ?? "—"}/10** — ${s?.rationale ?? "(not provided)"}`;
  const loc10 = v.loc10 ?? ({} as LocValidationResult["loc10"]);
  const loc11 = v.loc11 ?? ({} as LocValidationResult["loc11"]);
  const loc13 = v.loc13 ?? ({} as LocValidationResult["loc13"]);
  return `**PROVOCATION SCORES (LOC-10)**
${score("Genuine Surprise", loc10.genuine_surprise)}
${score("Credible Path", loc10.credible_path)}
${score("Territory Richness", loc10.territory_richness)}
${score("Competitive Permanence", loc10.competitive_permanence)}
${score("Category Escape", loc10.category_escape)}

**LOC VALIDATION FINDINGS (LOC-11)**
- **Commitment Test:** ${loc11.commitment_test ?? "(not provided)"}
- **Earn Test:** ${loc11.earn_test ?? "(not provided)"}
- **First-Mover Test:** ${loc11.first_mover_test ?? "(not provided)"}
- **Courage Test:** ${loc11.courage_test ?? "(not provided)"}

**FUTURE FIT ASSESSMENT (LOC-13)**
- **Product Deliverability:** ${loc13.product_deliverability ?? "(not provided)"}
- **Structural Permission:** ${loc13.structural_permission ?? "(not provided)"}
- **Abandonment Capacity:** ${loc13.abandonment_capacity ?? "(not provided)"}`;
}

export function renderLocDecisionPackage(pkg: LocEnginePackage): string {
  const propLabel = propositionOrRawMaterial(pkg.engine, pkg.engineOutput);

  const territory =
    pkg.engineOutput.engine === "breach"
      ? pkg.engineOutput.territory
      : pkg.engineOutput.engine === "synect"
        ? pkg.engineOutput.intersection_territory
        : pkg.engineOutput.engine === "displace"
          ? pkg.engineOutput.strategic_insight
          : `${pkg.engineOutput.naive_promise} / ${pkg.engineOutput.underlying_want}`;

  // Structural principle: pick the first case for this task type. All are
  // proof-of-principle; we display them all in Cases-Acknowledged.
  const primaryCase = LOC_CASE_LIBRARY[pkg.taskType][0];

  const v = pkg.validation;
  const courageSentence = v?.courage_assessment
    ? `> **COURAGE FRAME:** To own this territory, this brand must ${v.what_the_brand_must_abandon} and ${v.what_the_brand_must_become}. — ${v.courage_assessment}`
    : `> **COURAGE FRAME:** (validation not available for this proposition)`;

  const noTerritoryBlock = pkg.engineOutput.no_territory_reason
    ? `\n> **NO CREDIBLE TERRITORY FOUND:** ${pkg.engineOutput.no_territory_reason}\n`
    : "";

  return `## ${ENGINE_LABEL[pkg.engine]}

${courageSentence}
${noTerritoryBlock}
**Task-type question this engine ran on:** ${LOC_ENGINE_QUESTIONS[pkg.taskType][pkg.engine]}

**Constraint imposed:** ${LOC_TASK_CONSTRAINT[pkg.taskType]}

### THE TERRITORY
${territory || "(no territory)"}

### THE ${propLabel.label}
${propLabel.text}

### THE STRUCTURAL PRINCIPLE
${primaryCase.case} — ${primaryCase.principle}

### ENGINE WORKING (audit trail)
${renderEngineWorking(pkg.engine, pkg.engineOutput)}

### WHAT THE BRAND MUST BECOME
${v?.what_the_brand_must_become ?? "(validation unavailable)"}

### WHAT THE BRAND MUST ABANDON
${v?.what_the_brand_must_abandon ?? "(validation unavailable)"}

### THE CREDIBLE PATH
${v?.credible_path_three_steps?.length ? v.credible_path_three_steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(validation unavailable)"}

### THE COURAGE ASSESSMENT
${v?.courage_assessment ?? "(validation unavailable)"}

${v ? renderValidation(v) : "_(LOC-10/11/13 validation unavailable for this engine — see error log.)_"}
${pkg.validationError ? `\n_Validation error: ${pkg.validationError}_\n` : ""}
`;
}

export function renderLocFullMarkdown(args: {
  classifier: LocClassifierResult;
  packages: LocEnginePackage[];
  retryCount: number;
  generatedAt: string;
  sourceNote: string;
}): string {
  const header = `${LOC_MARKDOWN_DIVIDER}_Generated: ${args.generatedAt} (retry ${args.retryCount}) — ${args.sourceNote}_

## LOC TASK CLASSIFIER

**Selected task type:** ${LOC_TASK_TYPE_LABEL[args.classifier.task_type]}

**Rationale:** ${args.classifier.rationale}

**Runner-up:** ${LOC_TASK_TYPE_LABEL[args.classifier.runner_up]} — ${args.classifier.runner_up_rationale}

**Reference cases for this task type:**
${renderCases(args.classifier.task_type)}

`;

  const body = args.packages.map(renderLocDecisionPackage).join("\n\n---\n\n");

  return header + body;
}
