// Translates internal pipeline terminology to user-facing language and
// strips internal-only sections from displayed stage outputs.

const TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  // Multi-word phrases first (order matters)
  [/\bStrategic\s+Territory\s+Reference\s+Layer\b/gi, "Historical Territory Validation"],
  [/\bSingle[-\s]Minded\s+Propositions?\b/gi, "Strategic Proposition"],
  [/\bStrategic\s+Interpretation\s+Set\b/gi, "Strategic Universes"],
  [/\bStrategic\s+Field\s+Synthesis\b/gi, ""],
  [/\bStrategic\s+Constraint\s+Statements?\b/gi, "Strategic Foundation"],
  [/\bConstraint\s+Statements?\b/gi, "Strategic Foundation"],
  [/\bConstraint\s+Matrix\b/gi, "Strategic Framework"],
  [/\bconstraint\s+set\b/gi, "Strategic Framework"],
  [/\bCategory\s+Memory\s+Object\b/gi, "Category Intelligence"],
  [/\bCMM\s+Forbidden\s+Zone\b/gi, "Overcrowded Territory"],
  [/\bForbidden\s+Zone\b/gi, "Overcrowded Territory"],
  [/\bCMM\s+Whitespace\s+Zone\b/gi, "Available Territory"],
  [/\bWhitespace\s+Zone\b/gi, "Available Territory"],
  [/\bCategory\s+Dominant\s+Logic\b/gi, "Category Assumption"],
  [/\bHuman\s+Contradiction\s+Statement\b/gi, "Core Human Insight"],
  [/\bCategory\s+Tension\s+Summary\b/gi, "Category Opportunity"],
  [/\bPriority\s+Insights?\b/gi, (m: string) => (m.endsWith("s") ? "Key Insights" : "Key Insight") as unknown as string],
  [/\bInsight\s+Gap\s+Flag\b/gi, ""],
  [/\bSIS\s+frame\s+architecture\b/gi, ""],
  [/\bSIS\s+frames?\b/gi, "Strategic Universe"],
  [/\bTension\s+Axis\b/gi, ""],
  [/\bTruth\s+Configuration\b/gi, ""],
  [/\bStrategic\s+Routes?\b/gi, ""],
  [/\bIconic\s+Tier\b/gi, ""],
  [/\bBrief\s+Depth\s+Level\b/gi, ""],
  [/\bStage\s+1B\b/gi, "Brief Enhancement"],
  [/\bStage\s+13B\b/gi, "Historical Validation"],
  // Acronyms
  [/\bSMPs?\b/g, "Strategic Proposition"],
  [/\bCMM\b/g, "Category Intelligence"],
  [/\bSIS\b/g, "Strategic Universes"],
  [/\bSFS\b/g, ""],
  [/\bSTRL\b/g, "Historical Territory Validation"],
  [/\bBC[1-5]\b/g, ""],
  // Single-word terms
  [/\bStrategic\s+Fields?\b/gi, "Strategic Territory"],
  [/\bBrand\s+Role\b/g, "Strategic Role"],
  // Pipeline → Strategy Process
  [/\bpipeline\b/g, "strategy process"],
  [/\bPipeline\b/g, "Strategy Process"],
  // Version/Level markers
  [/\bLEVEL\s+[123]\b/g, ""],
  [/\b[Vv][1-9]\b/g, ""],
];

export function sanitizeStageOutput(raw: string): string {
  if (!raw) return raw;
  let text = raw;

  // 1. Strip the PIPELINE DATA HEADER block (from "PIPELINE DATA HEADER"
  //    up to the first markdown heading or blank section boundary).
  text = text.replace(
    /^[ \t]*PIPELINE DATA HEADER[\s\S]*?(?=\n##\s|\n#\s|\n={3,}|\n---|\Z)/im,
    ""
  );
  // Also strip any stray header field lines that may appear at the top.
  text = text.replace(
    /^[ \t]*(STRATEGIC MODE SELECTED|BRIEF DEPTH LEVEL|CATEGORY KNOWLEDGE CONFIDENCE|BRIEF ELEMENTS PRESENT|ASSUMPTIONS MADE|CMM VERSION|SIS VERSION|PROMPT VERSION):.*\n?/gim,
    ""
  );

  // 2. Strip Self-Audit section onward.
  text = text.replace(/\n#{0,6}\s*\**\s*SELF[- ]AUDIT[\s\S]*$/i, "");

  // 3. Strip Failure Routing section onward (if present and not after self-audit).
  text = text.replace(/\n#{0,6}\s*\**\s*FAILURE\s+ROUTING[\s\S]*$/i, "");

  // 4. Apply terminology translations.
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement as string);
  }

  // 5. Collapse triple+ blank lines and trim.
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
