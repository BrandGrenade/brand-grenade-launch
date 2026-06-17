// Shared structured-brief schema.
// Client-safe (pure data). Used by the brief form, saved briefs, the pipeline
// brief viewer, and the server functions that persist briefs to the database.

export type BriefField = {
  key: string;
  label: string;
  instruction: string;
  minHeight: number;
};

export type BriefSection = {
  num: string;
  title: string;
  instruction?: string;
  tag?: "essential" | "optional";
  fields: BriefField[];
};

export const BRIEF_SECTIONS: BriefSection[] = [
  {
    num: "1",
    title: "The Core Challenge",
    instruction:
      "What is the real problem or opportunity beneath the stated brief? 1–3 sentences. Be brutal. The most useful briefs name the uncomfortable truth the organisation is not saying out loud.",
    tag: "essential",
    fields: [{ key: "s1_core", label: "", instruction: "", minHeight: 120 }],
  },
  {
    num: "2",
    title: "What Success Requires",
    tag: "essential",
    fields: [
      { key: "s2_business", label: "Business objective", instruction: "What commercial outcome must this strategy produce? Be specific.", minHeight: 80 },
      { key: "s2_comms", label: "Communication objective", instruction: "What must shift in how the audience thinks, feels, or behaves?", minHeight: 80 },
      { key: "s2_strategic", label: "Strategic objective", instruction: "What position must the brand own that it does not currently own?", minHeight: 80 },
    ],
  },
  {
    num: "3",
    title: "Who We Are Talking To",
    tag: "essential",
    fields: [
      { key: "s3_behaviour", label: "Behavioural description", instruction: "How do these people actually behave in this category — including contradictions between what they say and what they do. Avoid age ranges. Describe behaviour.", minHeight: 100 },
      { key: "s3_tension", label: "The tension", instruction: "What is the specific gap between what this audience wants to believe about themselves and how they actually behave in this category?", minHeight: 100 },
      { key: "s3_relationship", label: "Current relationship with the brand", instruction: "How does this audience currently see, use, or ignore the brand?", minHeight: 80 },
    ],
  },
  {
    num: "4",
    title: "What Is Genuinely True About This Brand",
    tag: "essential",
    fields: [
      { key: "s4_provable", label: "Provable truths", instruction: "What does this brand or product do that no competitor can honestly claim? Hard facts, performance data, structural advantages.", minHeight: 100 },
      { key: "s4_believed", label: "Believed but unproven truths", instruction: "What do you believe is true about the brand that you cannot yet demonstrate with evidence?", minHeight: 80 },
    ],
  },
  {
    num: "5",
    title: "The Category This Brand Operates In",
    fields: [
      { key: "s5_believes", label: "What does the category currently believe?", instruction: "The dominant assumption every competitor is making — the thing every brand in this space says or implies.", minHeight: 80 },
      { key: "s5_changing", label: "What is changing?", instruction: "The behavioural, cultural, or structural shift that makes now a different moment. What has the category not yet caught up with?", minHeight: 80 },
      { key: "s5_unsaid", label: "What has the category never been willing to say?", instruction: "The uncomfortable truth no established player has named — possibly because naming it would implicate their own model.", minHeight: 100 },
    ],
  },
  {
    num: "6",
    title: "The Competitive Landscape",
    fields: [
      { key: "s6_competitors", label: "Primary competitors and what they own", instruction: "For each main competitor — what is the one thing they stand for in the audience's mind? Not their tagline. What they actually mean.", minHeight: 120 },
      { key: "s6_territory", label: "Territory no competitor credibly occupies", instruction: "Where is the gap? What is available that no one has claimed or been willing to claim?", minHeight: 80 },
    ],
  },
  {
    num: "7",
    title: "Constraints and Commitments",
    fields: [
      { key: "s7_never", label: "What the brand must never say or imply", instruction: "Specific language, claims, associations, or tonal territories that are off-limits and why.", minHeight: 80 },
      { key: "s7_commit", label: "What the brand must commit to beyond communications", instruction: "If this strategy works, what will the brand need to actually do in its product, pricing, or behaviour to make the positioning credible?", minHeight: 80 },
      { key: "s7_equities", label: "Existing equities to protect", instruction: "What has the brand built that any new strategy must not contradict or abandon?", minHeight: 80 },
    ],
  },
  {
    num: "8",
    title: "How We Will Know It Worked",
    tag: "optional",
    fields: [
      { key: "s8_measure", label: "", instruction: "Specific measurable outcomes that would confirm the strategy has succeeded. Commercial, perceptual, or behavioural.", minHeight: 80 },
    ],
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
 * Stage 1 prompts. This must match the historical format produced by
 * brief.index.tsx so existing prompts continue to work.
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
    parts.push(`## 9. Supporting Materials`);
    parts.push(b.supportingMaterials.map((n) => `- ${n}`).join("\n"));
  }
  return parts.join("\n");
}

/**
 * Best-effort parse for legacy plain-text briefs (sessions created before
 * structured briefs existed, or document-upload briefs). Returns a
 * BriefFields with the entire text dropped into s1_core so the editor at
 * least pre-populates with the original content.
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
  b.sections.s1_core = (opts.briefText ?? "").trim();
  return b;
}
