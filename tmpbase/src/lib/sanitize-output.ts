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
  [/\bForbidden\s+Territory\b/gi, "Overcrowded Territory"],
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
  [/\b[Vv][1-9](?:\.\d)?\b/g, ""],
];

// Block headers that should be stripped along with everything that follows them,
// up to the next markdown heading, horizontal rule, or end of document.
const BLOCK_HEADER_PATTERNS: RegExp[] = [
  /PIPELINE\s+DATA\s+HEADER/i,
  /SELF[-\s]AUDIT/i,
  /FAILURE\s+ROUTING/i,
  /PIPELINE\s+ROUTING/i,
  /QUALITY\s+BENCHMARK/i,
  /QUALITY\s+GATE/i,
  /CONSTRAINT\s+FIDELITY/i,
  /ANTI[-\s]CONVERGENCE/i,
  /FRAME\s+VALIDATION/i,
  /FRAME\s+ARCHITECTURE/i,
  /FRAME\s+LOGIC/i,
  /FRAME\s+BOUNDARIES/i,
  /CMM\s+COMPLIANCE/i,
  /BRAND\s+CREDIBILITY/i,
  /BRIEF\s+DEPTH\s+ADAPTATION/i,
  /INPUT\s+REQUIREMENT/i,
  /OUTPUT\s+STRUCTURE/i,
  /INSIGHT\s+GENERATION/i,
  /STAGE\s+\d+[A-Z]?\s+BRIEF/i,
];

// Per-line patterns. Any matching line is removed entirely.
const LINE_STRIP_PATTERNS: RegExp[] = [
  /^\s*BRIEF\s+BRAND\s*:/i,
  /^\s*CATEGORY\s*:\s*\S/i, // strip "CATEGORY: foo" header lines
  /^\s*NUMBER\s+OF\b/i,
  /VERSION\s+REFERENCED\s*:/i,
  /^\s*VERSION\s*:/i,
  /^\s*ASSIGNED\s*:/i,
  /TRUTH\s+CONFIGURATIONS?\s*:/i,
  /TENSION\s+TYPES?\s*:/i,
  /REQUIRED\s+TENSION\s*:/i,
  /EVIDENCE\s+TYPE\s*:/i,
  /^\s*BRAND\s+ROLE\s*:/i,
  /^\s*STRATEGIC\s+ROUTE\s*:/i,
  /^\s*ICONIC\s+TIER\s*:/i,
  /^\s*BRIEF\s+DEPTH\b/i,
  /^\s*FRAMES?\s*:\s*\d/i,
  /^\s*ANTI[-\s]CONVERGENCE\b/i,
  /^\s*CONSTRAINT\b.*:/i,
  /^\s*COMPETITOR\s+AVOIDANCE\s*:/i,
  /^\s*LANGUAGE\s+EXCLUSIONS?\s*:/i,
  /^\s*REJECTION\s+TEST\s*:/i,
  /^\s*FORBIDDEN\s+TERRITORY\s*:/i,
  /^\s*STRATEGIC\s+LOGIC\s+STATEMENT\s*:/i,
  /^\s*[:\-]\s*(NO|YES)\b/i,
  /^\s*Strategic\s+Framework\s+REFERENCE\s*:/i,
  // Validation status lines
  /:\s*PASSED\b/i,
  /:\s*CONFIRMED\b/i,
  /:\s*CLEARED\b/i,
  /:\s*FAILED\b/i,
  /\b(PASSED|CONFIRMED|CLEARED)\b\s*$/,
  // Agency name attributions
  /\((TBWA|BBH|JWT|W\+K|Wieden\+Kennedy|Droga5|Ogilvy|DDB|Leo Burnett|McCann|BBDO|Publicis|Grey|Saatchi|Chiat)\b/i,
];

// Sentence-level removals applied to remaining paragraphs.
const SENTENCE_STRIP_PATTERNS: RegExp[] = [
  /\bthis prompt\b/i,
  /\bthis stage\b/i,
  /\bthe strategy process\b/i,
  /\bdownstream stages?\b/i,
  /\bupstream stages?\b/i,
  /\bStage\s+\d+[A-Z]?\b/i,
  /\bself[-\s]audit\b/i,
  /\bquality (gate|check)\b/i,
];

// Nuclear filter — last line of defence regardless of context.
const NUCLEAR_LINE_PATTERNS: RegExp[] = [
  /^[A-Z\s]+:\s*\d+/,
  /^[A-Z\s]+:\s*(YES|NO|N\/A|PASSED|CONFIRMED|CLEARED|PENDING|COMPLETE)\b/i,
  /^(SMPS?|FRAMES?|FIELDS?|STAGES?|UNIVERSES?|TERRITORIES?)\s+(PRODUCED|GENERATED|SYNTHESISED|VALIDATED|COMPLETED)\s*:/i,
  /^READY\s+FOR/i,
  /^CROSS-/i,
  /^ALL\s+[A-Z]+\s+PASS/i,
  /:\s*\d+\s+confirmed/i,
  /:\s*0\s+(confirmed|downgraded|pending)/i,
  /^DRAFTS?\s+GENERATED/i,
  /^(TOTAL|COUNT|NUMBER OF)\s*:/i,
  /N\/A\s+\(single/i,
  // Stage 3 specific
  /MATRIX\s+HEADER/i,
  /CONSTRAINT\s+MATRIX/i,
  /CONSTRAINT\s+SET\s+\d/i,
  /CONSTRAINT\s+SET\s+NAME\s*:/i,
  /CONSTRAINT\s+SET\s+VALIDATION/i,
  /CONSTRAINT\s+QUALITY/i,
  /BOUNDARY\s+CONDITION/i,
  /\bBC[1-5]\s*[:\-—]/i,
  /^\s*FORBIDDEN\s+TERRITORY\s*:/i,
  /REQUIRED\s+TENSION\s+TYPE\s*:/i,
  /TRUTH\s+CONFIGURATION\s*:/i,
  /STRATEGIC\s+ROUTE\s*:/i,
  /TENSION\s+AXIS\s*:/i,
  /^\s*BRAND\s+ROLE\s*:/i,
  /DIFFERENTIATION\s+CONFIRMED/i,
  /WHITESPACE\s+CONFIRMED/i,
  /CMM\s+REFERENCED/i,
  /FRAMEWORK\s+COUNT\s*:/i,
  /SETS\s+GENERATED\s*:/i,
  /DIVERGENCE\s+SUMMARY\s*:/i,
  /STAGE\s+\d+\s+INSTRUCTION\s*:/i,
  // Orphan colon-value lines (CHANGE 3 & 4)
  /^\s*[*\-]?\s*:\s*\S/,
  /^\s*[*\-]\s*$/,
  // ALL-CAPS / Title Case label followed by short value (1-4 words)
  /^\s*\**\s*[A-Z][A-Z0-9 _\-/&()]{2,40}\s*:\s*\**\s*\S+(?:\s+\S+){0,3}\s*\**\s*$/,
];

// Bullet line with colon and very few words → structured data
const BULLET_DATA_LINE = /^\s*[*\-]\s+[^\n]*:\s*\S/;
function isShortBulletData(line: string): boolean {
  if (!BULLET_DATA_LINE.test(line)) return false;
  const words = line.replace(/^\s*[*\-]\s+/, "").split(/\s+/).filter(Boolean);
  return words.length < 6;
}


// A "label-only" line: e.g. "Foo Bar:" or "**Foo Bar:**" with no content after.
const LABEL_ONLY_LINE = /^[ \t#>*_\-]*\**[A-Za-z][A-Za-z0-9 _\-/&()]{0,80}\**\s*:\s*\**\s*$/;

function stripBlock(text: string, headerPattern: RegExp): string {
  const re = new RegExp(
    `(^|\\n)[ \\t]*(?:#{1,6}\\s*)?\\**\\s*${headerPattern.source}\\b[^\\n]*[\\s\\S]*?(?=\\n#{1,6}\\s|\\n={3,}|\\n-{3,}|$)`,
    "i"
  );
  return text.replace(re, "$1").replace(re, "$1");
}

function stripLeadingMetadata(text: string): string {
  // If there is a ## heading anywhere, drop everything before the first one
  // when that preamble looks like metadata (contains label-colon lines or
  // ALL-CAPS field labels and no real prose).
  const firstHeading = text.search(/^##\s+/m);
  if (firstHeading <= 0) return text;
  const preamble = text.slice(0, firstHeading);
  const looksLikeMetadata =
    /:\s*\S/.test(preamble) && !/[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/.test(preamble);
  return looksLikeMetadata ? text.slice(firstHeading) : text;
}

function stripBadSentences(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*[#>\-*]/.test(line) || !line.trim()) return line;
      const sentences = line.split(/(?<=[.!?])\s+/);
      return sentences
        .filter((s) => !SENTENCE_STRIP_PATTERNS.some((p) => p.test(s)))
        .join(" ");
    })
    .join("\n");
}

export function sanitizeStageOutput(raw: string): string {
  if (!raw) return raw;
  let text = raw;

  // 0. Strip bracketed metadata blocks and internal log sections.
  text = text.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/gi, "");
  text = text.replace(/\[SELECTION_RATIONALE_STUB\][\s\S]*?\[\/SELECTION_RATIONALE_STUB\]/gi, "");
  text = text.replace(/={2,}\s*PRESENTATION\s+ORDER\s+LOG[\s\S]*?(?=\n={2,}\s*\S|$)/gi, "");
  text = text.replace(/={2,}\s*SELF[-\s]AUDIT[\s\S]*?(?=\n={2,}\s*\S|$)/gi, "");

  // 0a. Remove inline "— ICONIC TIER ...: <value>" trailing clauses BEFORE
  // term replacement turns "Iconic Tier" into "" and leaves "— : N/A" orphans.
  text = text.replace(/\s*[—–-]\s*ICONIC\s+TIER[^—–\n]*/gi, "");
  // Defence for any other inline clause that would collapse to "— : <flag>".
  text = text.replace(/\s*[—–-]\s*:\s*(N\/A|YES|NO|CONFIRMED|DOWNGRADED|PENDING|PASSED|CLEARED|FAILED)\b/gi, "");

  const extraLineStrips: RegExp[] = [
    /PRESENTATION\s+ORDER\s+LOG/i,
    /PRESENTATION\s+ORDER/i,
    /Randomisation\s+(Status|Confirmed)/i,
    /^\s*Card\s+\d+\s*:/i,
    /Plain\s+Language\s+Compliance/i,
    /Structural\s+Neutrality/i,
    /Selection\s+Framework\s+Quality/i,
    /internal,?\s*not\s+client[-\s]facing/i,
    /FIELD_NAME\s*:/i,
    /ICONIC_TIER_STATUS\s*:/i,
    /PRESSURE_TEST_NOTE\s*:/i,
    /Stage\s+12\s+awaiting\s+review/i,
    /Overall\s+Readiness\s*:/i,
    /READY\s+FOR\s+CHECKPOINT/i,
  ];
  text = text
    .split("\n")
    .filter((line) => !extraLineStrips.some((p) => p.test(line)))
    .join("\n");

  // 1. Strip internal block sections (header + body until next section).
  for (const header of BLOCK_HEADER_PATTERNS) {
    text = stripBlock(text, header);
  }

  // Strip stray header field lines that may appear at the top.
  text = text.replace(
    /^[ \t]*(?:#{1,6}\s*)?\**\s*(STRATEGIC MODE SELECTED|STRATEGIC MODE APPLIED|BRIEF DEPTH LEVEL|CATEGORY KNOWLEDGE CONFIDENCE|BRIEF ELEMENTS PRESENT|ASSUMPTIONS MADE|CMM VERSION|SIS VERSION|PROMPT VERSION|PIPELINE DATA HEADER)\b[^\n]*\n?/gim,
    ""
  );

  // 2. Terminology translations.
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement as string);
  }

  // 3. Per-line filtering.
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (LINE_STRIP_PATTERNS.some((p) => p.test(line))) continue;
    if (NUCLEAR_LINE_PATTERNS.some((p) => p.test(line))) continue;
    if (LABEL_ONLY_LINE.test(line)) continue;
    if (isShortBulletData(line)) continue;
    kept.push(line);
  }
  text = kept.join("\n");

  // 4. Sentence-level filter for meta references.
  text = stripBadSentences(text);

  // 5. Drop any leading metadata block before the first ## heading.
  text = stripLeadingMetadata(text);

  // 6. Collapse triple+ blank lines and trim.
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // 6a. FORBIDDEN TOKEN NUCLEAR PASS — strip any line that contains an
  //     internal-only header phrase (case-insensitive, any position, any
  //     punctuation). Inline-prose mentions of these tokens are never valid
  //     user-facing output, so the whole containing line is removed.
  const FORBIDDEN_TOKENS = [
    /strategic\s+mode\s+applied/i,
    /strategic\s+mode\s+selected/i,
    /brief\s+depth\s+level/i,
    /category\s+knowledge\s+confidence/i,
    /pipeline\s+data\s+header/i,
  ];
  text = text
    .split("\n")
    .filter((line) => !FORBIDDEN_TOKENS.some((p) => p.test(line)))
    .join("\n");

  // 7. Strip encoded separator artifacts and stray formatting glyphs
  //    that occasionally leak through from upstream models.
  text = text
    // Encoded separator sequences
    .replace(/(%P){2,}/g, "")
    .replace(/%{2,}/g, "")
    // Box-drawing characters
    .replace(/[═─│┌┐└┘├┤┬┴┼]/g, "")
    // Spaced letter sequences e.g. "W H A T  T H I S"
    .replace(/\b([A-Z])\s(?=[A-Z]\s)/g, "$1")
    // Lines of only special characters
    .replace(/^[^a-zA-Z0-9\s]{3,}$/gm, "")
    // Collapse any new blank-line runs introduced above
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
