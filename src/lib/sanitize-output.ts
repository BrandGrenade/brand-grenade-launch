// Translates internal pipeline terminology to user-facing language and
// strips internal-only sections from displayed stage outputs.
//
// Display-layer only: the full raw Claude output remains in the database.

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
  [/\bPriority\s+Insights\b/gi, "Key Insights"],
  [/\bPriority\s+Insight\b/gi, "Key Insight"],
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

// Block headers that should be stripped along with everything that follows them,
// up to the next markdown heading, horizontal rule, or end of document.
const BLOCK_HEADER_PATTERNS: RegExp[] = [
  /PIPELINE\s+DATA\s+HEADER/i,
  /SELF[-\s]AUDIT/i,
  /FAILURE\s+ROUTING/i,
  /PIPELINE\s+ROUTING/i,
  /QUALITY\s+BENCHMARK/i,
  /CONSTRAINT\s+FIDELITY/i,
  /ANTI[-\s]CONVERGENCE/i,
  /FRAME\s+VALIDATION/i,
  /CMM\s+COMPLIANCE/i,
  /BRAND\s+CREDIBILITY/i,
  /STAGE\s+\d+[A-Z]?\s+BRIEF/i,
];

// Per-line patterns. Any matching line is removed entirely.
const LINE_STRIP_PATTERNS: RegExp[] = [
  /VERSION\s+REFERENCED\s*:/i,
  /\bVERSION\s*:/i,
  /\bASSIGNED\s*:/i,
  /TRUTH\s+CONFIGURATIONS?\s*:/i,
  /TENSION\s+TYPES?\s*:/i,
  /\bFRAMES?\s*:\s*\d/i,
  /REJECTION\s+TEST\s*:/i,
  /BRIEF\s+DEPTH\s+ADAPTATION\s*:/i,
  /^\s*[:\-]\s*(NO|YES)\b/i,
  /^\s*Strategic\s+Framework\s+REFERENCE\s*:/i,
  /^\s*Category\s+Intelligence\b/i,
  /\((TBWA|BBH|JWT|W\+K|Droga5)/i,
  /^\s*REQUIRED\s+TENSION\s+TYPE\s*:/i,
  /^\s*EVIDENCE\s+TYPE\s*:/i,
  /^\s*COMPETITOR\s+AVOIDANCE\s*:/i,
  /^\s*LANGUAGE\s+EXCLUSIONS?\s*:/i,
  // Validation status lines (PASSED / CONFIRMED).
  /\b(PASSED|CONFIRMED)\b/,
];

// A "label-only" line: e.g. "Foo Bar:" or "**Foo Bar:**" with no content after.
const LABEL_ONLY_LINE = /^[ \t#>*_\-]*\**[A-Za-z][A-Za-z0-9 _\-/&()]{0,80}\**\s*:\s*\**\s*$/;

function stripBlock(text: string, headerPattern: RegExp): string {
  // Match an optional leading markdown heading or bold marker, the header
  // text, then everything until the next markdown heading, HR, or EOF.
  const re = new RegExp(
    `(^|\\n)[ \\t]*(?:#{1,6}\\s*)?\\**\\s*${headerPattern.source}\\b[^\\n]*[\\s\\S]*?(?=\\n#{1,6}\\s|\\n={3,}|\\n-{3,}|$)`,
    "i"
  );
  return text.replace(re, "$1").replace(re, "$1");
}

export function sanitizeStageOutput(raw: string): string {
  if (!raw) return raw;
  let text = raw;

  // 1. Strip internal block sections (header + body until next section).
  for (const header of BLOCK_HEADER_PATTERNS) {
    text = stripBlock(text, header);
  }

  // Also strip any stray header field lines that may appear at the top.
  text = text.replace(
    /^[ \t]*(STRATEGIC MODE SELECTED|BRIEF DEPTH LEVEL|CATEGORY KNOWLEDGE CONFIDENCE|BRIEF ELEMENTS PRESENT|ASSUMPTIONS MADE|CMM VERSION|SIS VERSION|PROMPT VERSION):.*\n?/gim,
    ""
  );

  // 2. Apply terminology translations BEFORE per-line stripping so the
  //    line predicates match the original internal vocabulary.
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement as string);
  }

  // 3. Per-line filtering: drop any line matching a strip pattern or that is
  //    a pure label with no content.
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (LINE_STRIP_PATTERNS.some((p) => p.test(line))) continue;
    if (LABEL_ONLY_LINE.test(line)) continue;
    kept.push(line);
  }
  text = kept.join("\n");

  // 4. Collapse triple+ blank lines and trim.
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
