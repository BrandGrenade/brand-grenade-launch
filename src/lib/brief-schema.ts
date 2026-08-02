// Shared structured-brief schema.
// Client-safe (pure data). Used by the brief form, saved briefs, the pipeline
// brief viewer, and the server functions that persist briefs to the database.

export type BriefFieldKind = "textarea" | "select";

export type BriefFieldOption = {
  value: string;
  label: string;
  description: string;
};

export type BriefField = {
  key: string;
  label: string;
  instruction: string;
  minHeight: number;
  kind?: BriefFieldKind;
  options?: BriefFieldOption[];
};

export type BriefSection = {
  num: string;
  title: string;
  instruction?: string;
  tag?: "essential" | "optional";
  fields: BriefField[];
};

export const STRATEGIC_OBJECTIVE_OPTIONS: BriefFieldOption[] = [
  { value: "Launch", label: "Launch", description: "Introducing a new brand, product or service to a market that does not yet know it exists." },
  { value: "Refresh (Packaging)", label: "Refresh (Packaging)", description: "Renewing the physical or visual expression — pack, identity, design system — without changing what the brand stands for. A bounded change with a reveal moment and a finite lifecycle." },
  { value: "Refresh (Campaign)", label: "Refresh (Campaign)", description: "A new campaign inside an existing, fixed brand platform. Distinctive assets and brand architecture are constraints, not variables." },
  { value: "Repositioning", label: "Repositioning", description: "Moving an established brand from one strategic territory to another it has not previously owned." },
  { value: "Defence", label: "Defence", description: "Protecting an established brand's territory against competitive encroachment or category disruption." },
  { value: "Challenger", label: "Challenger", description: "Taking market share from a dominant incumbent by naming what the category leader cannot say about itself." },
  { value: "Crisis Recovery", label: "Crisis Recovery", description: "Rebuilding trust and relevance after a reputational event, commercial failure or category scandal." },
  { value: "Category Creation", label: "Category Creation", description: "Establishing a new category that did not previously exist and positioning the brand as its defining expression." },
];

export const BRIEF_SECTIONS: BriefSection[] = [
  {
    num: "1",
    title: "Brand and Product or Service",
    instruction: "What are we working on. Name the brand and describe exactly what product or service is being briefed. Be specific about what is being sold, not what the company does. Two to three sentences maximum.",
    tag: "essential",
    fields: [{ key: "f1_brand", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "2",
    title: "Strategic Objective",
    instruction: "What is the primary strategic objective. This is the single most important field — it tells the pipeline what commercial job it is solving. The pipeline cannot run without a strategic objective selected.",
    tag: "essential",
    fields: [
      {
        key: "f2_objective",
        label: "",
        instruction: "",
        minHeight: 0,
        kind: "select",
        options: STRATEGIC_OBJECTIVE_OPTIONS,
      },
    ],
  },
  {
    num: "3",
    title: "The Commercial Outcome",
    instruction: "What specific business result does this brief need to produce in the next twelve months. Name the specific commercial outcome, not a brand metric. Revenue from a new segment. Trial rate among a new audience. Retention of customers being targeted by a competitor. Reappraisal among a lapsed segment. Be specific. A vague outcome produces a vague strategy.",
    tag: "essential",
    fields: [{ key: "f3_outcome", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "4",
    title: "The Primary Barrier",
    instruction: "What is the single biggest thing stopping this brand from achieving that outcome right now. Name one specific obstacle, not a list. The pipeline will find the strategic solution. Your job is to name the problem honestly including the uncomfortable version.",
    tag: "essential",
    fields: [{ key: "f4_barrier", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "5",
    title: "What Has Already Been Tried",
    instruction: "What approaches have already been attempted and why did they not work. Two to three sentences maximum. If nothing has been tried, say so. If something has been tried and failed, name it specifically. The pipeline needs to know what the brand has already ruled out.",
    tag: "essential",
    fields: [{ key: "f5_tried", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "6",
    title: "The Audience",
    instruction: "Who specifically are we talking to. Not a demographic description. The specific person, their behaviour in this category and what they currently believe about this brand. Name their private fear or private desire in this category if you know it.",
    tag: "essential",
    fields: [{ key: "f6_audience", label: "", instruction: "", minHeight: 120 }],
  },
  {
    num: "7",
    title: "Current Belief",
    instruction: "What does the audience currently think about this brand or category. Be honest including the uncomfortable version. The gap between current belief and desired belief is the strategic task. If the current belief is unflattering, name it anyway.",
    tag: "essential",
    fields: [{ key: "f7_current_belief", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "8",
    title: "Desired Belief",
    instruction: "What does the brand need the audience to think after this strategy works. Not a campaign outcome. The specific belief shift that would mean the strategy has worked. One sentence if possible.",
    tag: "essential",
    fields: [{ key: "f8_desired_belief", label: "", instruction: "", minHeight: 80 }],
  },
  {
    num: "9",
    title: "Reason to Believe",
    instruction: "What does the brand have that makes the desired belief credible. Product truth, heritage, proof point or structural advantage. Two to three sentences maximum. The pipeline will develop this further but give it the best material you have.",
    tag: "essential",
    fields: [{ key: "f9_rtb", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "10",
    title: "The Competitive Provocation",
    instruction: "Which competitor is doing something that, if left unanswered, will damage this brand. Name the competitor and name what they are doing. If no single competitor is the primary threat, describe the category dynamic that is most threatening.",
    tag: "essential",
    fields: [{ key: "f10_competitive", label: "", instruction: "", minHeight: 100 }],
  },
  {
    num: "11",
    title: "Mandatories and Never-Says",
    instruction: "What must always be present and what must never appear. Optional but important. List any non-negotiable inclusions and any absolute exclusions. Legal requirements. Brand guardrails. Things a previous agency did that must never be repeated.",
    tag: "optional",
    fields: [{ key: "f11_mandatories", label: "", instruction: "", minHeight: 100 }],
  },
];

export const BRIEF_FIELD_KEYS: string[] = BRIEF_SECTIONS.flatMap((s) =>
  s.fields.map((f) => f.key),
);

export type BriefFields = {
  briefTitle: string;
  brandName: string;
  category: string;
  date: string;
  submittedBy: string;
  sections: Record<string, string>;
  supportingMaterials: string[]; // file names
};

export type BriefVersion = {
  version: number;
  fields: BriefFields;
  submitted_at: string;
};

export function emptyBriefFields(): BriefFields {
  return {
    briefTitle: "",
    brandName: "",
    category: "",
    date: "",
    submittedBy: "",
    sections: Object.fromEntries(BRIEF_FIELD_KEYS.map((k) => [k, ""])),
    supportingMaterials: [],
  };
}

/**
 * Render a structured brief as the canonical markdown text consumed by
 * Stage 1 prompts.
 */
export function composeBriefText(b: BriefFields): string {
  const parts: string[] = [];
  if (b.briefTitle.trim()) parts.push(`# ${b.briefTitle.trim()}`);
  if (b.date) parts.push(`Date: ${b.date}`);
  if (b.submittedBy.trim()) parts.push(`Submitted by: ${b.submittedBy.trim()}`);
  parts.push("");
  for (const s of BRIEF_SECTIONS) {
    const lines: string[] = [];
    for (const f of s.fields) {
      const v = (b.sections[f.key] ?? "").trim();
      if (!v) continue;
      if (f.label) lines.push(`**${f.label}**`);
      lines.push(v);
      lines.push("");
    }
    if (lines.length === 0) continue;
    parts.push(`## ${s.num}. ${s.title}`);
    parts.push(...lines);
  }
  if (b.supportingMaterials.length > 0) {
    parts.push(`## Supporting Materials`);
    parts.push(b.supportingMaterials.map((n) => `- ${n}`).join("\n"));
  }
  return parts.join("\n");
}

/**
 * Best-effort parse for legacy plain-text briefs. Drops the full text into
 * the first field (f1_brand) so the editor at least pre-populates.
 */
export function briefFieldsFromLegacyText(opts: {
  brandName: string;
  category: string;
  briefText: string | null;
}): BriefFields {
  const b = emptyBriefFields();
  b.brandName = opts.brandName ?? "";
  b.category = opts.category ?? "";
  b.briefTitle = opts.brandName ?? "";
  b.sections.f1_brand = (opts.briefText ?? "").trim();
  return b;
}
