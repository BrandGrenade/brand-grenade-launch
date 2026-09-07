// Strips internal pipeline metadata that must never appear in any
// client-facing document (Phase 1 + Phase 2 renderers and PDF generator).
//
// Applied at the rendering layer — raw stage outputs in the database are
// left untouched so the patterns can be re-stripped if rules change.

const BLOCK_PATTERNS: RegExp[] = [
  // [METADATA] ... [/METADATA]
  /\[METADATA\][\s\S]*?\[\/METADATA\]\s*/gi,
  // [SELECTION_RATIONALE_STUB] ... [/SELECTION_RATIONALE_STUB]
  /\[SELECTION_RATIONALE_STUB\][\s\S]*?\[\/SELECTION_RATIONALE_STUB\]\s*/gi,
];

// ==== SELF-AUDIT ==== ... (until next ==== header or end of document)
// ==== PRESENTATION ORDER LOG ==== ... (until next ==== header or end)
const EQUALS_SECTION_PATTERNS: RegExp[] = [
  /={2,}\s*SELF[-\s]?AUDIT[\s\S]*?(?=\n={2,}\s*[A-Z]|\n#{1,6}\s|$)/gi,
  /={2,}\s*PRESENTATION\s+ORDER(?:\s+LOG)?[\s\S]*?(?=\n={2,}\s*[A-Z]|\n#{1,6}\s|$)/gi,
];

// Per-line strips: fields, standalone ==== markers / DELIVERABLE headers, and
// internal selection UI (the Stage 8 candidate chooser + its option rows).
const LINE_STRIP: RegExp[] = [
  /^\s*FIELD_NAME\s*:.*/i,
  /^\s*ICONIC_TIER_STATUS\s*:.*/i,
  /^\s*PRESSURE_TEST_NOTE\s*:.*/i,
  // ==== DELIVERABLE ... ==== style headers
  /^\s*={2,}\s*DELIVERABLE\b.*$/i,
  // Standalone ==== separator markers
  /^\s*={3,}\s*$/,
  // Any remaining "==== SOMETHING ====" header line (defence in depth)
  /^\s*={2,}\s*[A-Z][A-Z0-9 _\-/\u2013\u2014.,'()]*\s*={0,}\s*$/,
  // Internal selection UI — chooser heading
  /^\s*#{0,6}\s*\*{0,2}\s*CANDIDATE SET\b.*$/i,
  /^\s*#{0,6}\s*\*{0,2}\s*(?:SELECT|CHOOSE)\s+ONE\b.*$/i,
  // Internal selection UI — "A · BASE — ..." / "B · BREACH — ..." option rows
  /^\s*\*{0,2}\s*[A-Z]\s*[·•]\s*(?:BASE|BREACH|FUSE|FLASHPOINT|LOC|OPTION)\b.*$/i,
  // Stage-output bookkeeping headers. A short label line of the form
  // "AUDIT DATE — current cycle" / "SOURCE: LOC (invented_authority)" is how a
  // stage annotates its own run; it is never part of the argument a reader is
  // being shown, so it is stripped wherever a stage output is rendered.
  /^\s*\*{0,2}\s*(?:AUDIT\s?DATE|AUDIT\s?TRAIL|PIPELINE\s+DOCUMENTS?\s+REVIEWED|TOTAL\s+FLAGS?\s+RAISED|COURAGE\s+ASSESSMENT|DERIVATION\s+CHAIN\s+INTEGRITY|SELECTED\s+SMP|SELECTED\s+PROPOSITION|SOURCE|STATUS|SUBMITTED\s+BY|PREPARED\s+BY|RUN\s+ID|SESSION\s+ID|WORD\s+COUNT|DATE)\s*\*{0,2}\s*(?::|—|–|-)\s?.{0,180}$/i,
];

const INLINE_STRIP: RegExp[] = [
  /** Word-count annotations the chooser prints, e.g. "_(4w)_". */
  /\s*_\(\d+\s*w\)_/gi,
  // Generation telemetry the LOC engines prepend: "_Generated: <ISO> (retry 2) — …_"
  /_?\s*Generated\s*:\s*\d{4}-\d{2}-\d{2}T[^_\n]*_?/gi,
  /\s*\(retry\s+\d+\)/gi,
  // Score-correction audit notes written inline into a rating line.
  /\s*[—–-]?\s*RE-?RUN\s+UNDER\s+CORRECTED\s+ANCHORS\s*(?:\(was[^)]*\))?/gi,
  // Any bare ISO timestamp that survives the line-level strips.
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g,
];


/**
 * Post-selection framing strip.
 *
 * Stage 12 writes its proposition set while several options are still live, so
 * its text addresses a reader who is choosing ("Each of the following
 * propositions…", "Read each proposition slowly…", the Q1-Q6 selection
 * questions). Once a proposition is locked, every deliverable presents ONE
 * recommendation, and that comparison scaffolding is a selection-UI artifact
 * rather than content. It is removed wherever a stage output is rendered.
 */
const COMPARISON_PARAGRAPH: RegExp[] = [
  /^\s*\*{0,2}Each of the (?:following|these)\s+propositions\b/i,
  /^\s*\*{0,2}Read each proposition\b/i,
  /^\s*\*{0,2}(?:Taken together,\s*)?These\s+(?:two|three|four|five|six|seven|eight|\d+)\s+propositions\b/i,
  /^\s*\*{0,2}Taken together,\s*these\s+(?:two|three|four|five|six|seven|eight|\d+)?\s*propositions\b/i,
  /^\s*\*{0,2}Q\s?[1-9]\d?\s*\((?:Longevity|Creative Ambition|Commercial Courage|Credibility|Discomfort|Selection)\)/i,
  /^\s*\*{0,2}(?:SELECTION|DECISION)\s+QUESTIONS?\*{0,2}\s*:?\s*$/i,
  /^\s*\*{0,2}(?:Which|Choose which)\s+proposition\s+(?:do you|would you|should)\b/i,
];

export function stripComparisonFraming(input: string): string {
  if (!input) return input;
  return input
    .split(/\n{2,}/)
    .filter((block) => !COMPARISON_PARAGRAPH.some((re) => re.test(block)))
    .join("\n\n");
}

/**
 * Sentence-level strip of set framing.
 *
 * Several stage outputs are written while a whole candidate set is still on
 * the table ("All five propositions reject…", "These propositions are ready
 * for scoring"). Once a document has been scoped to the one locked
 * proposition, those sentences describe a set the reader can no longer see.
 * They are removed sentence by sentence — the surrounding argument is kept.
 */
const PLURAL_SET_SENTENCE: RegExp[] = [
  /^\s*Each of (?:these|the following|the) (?:\w+\s+)?propositions\b/i,
  /^\s*(?:And\s+)?All (?:two|three|four|five|six|seven|eight|\d+) propositions\b/i,
  /^\s*None of (?:these|the) propositions\b/i,
  /^\s*These propositions\b/i,
  /^\s*This set (?:represents|of propositions)\b/i,
  /^\s*What unites them\b/i,
  /^\s*What separates them\b/i,
  /^\s*They do not converge\b/i,
  /^\s*They compete\b/i,
  /^\s*Selecting between them\b/i,
  /^\s*Each represents a genuinely distinctive strategic choice\b/i,
  /^\s*(?:Taken together,\s*)?these (?:two|three|four|five|six|seven|eight|\d+) propositions\b/i,
];

export function stripPluralSetFraming(input: string): string {
  if (!input) return input;
  return input
    .split("\n")
    .map((line) => {
      if (/^\s*#{1,6}\s/.test(line) || !/[.!?]/.test(line)) return line;
      // A blockquote or bullet marker must not hide the sentence behind it.
      const prefix = line.match(/^\s*(?:>\s*|[-—•*]\s+)?/)?.[0] ?? "";
      const body = line.slice(prefix.length);
      // Split on sentence ends, keeping the terminator with its sentence.
      const parts = body.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [body];
      const kept = parts.filter((s) => !PLURAL_SET_SENTENCE.some((re) => re.test(s)));
      if (kept.length === parts.length) return line;
      const rest = kept.join("").trimEnd();
      return rest ? `${prefix}${rest}` : "";
    })
    .filter((line, i, all) => line.trim() !== "" || (all[i - 1] ?? "").trim() !== "" || i === 0)
    .join("\n");
}

/**
 * A heading whose body was removed by an earlier strip promises content that
 * is not there. Any heading followed only by blank lines, rules, or another
 * heading of the same or shallower level is dropped.
 */
export function dropEmptyHeadings(input: string): string {
  if (!input) return input;
  const lines = input.split("\n");
  const level = (l: string) => l.trim().match(/^#{1,6}/)?.[0].length ?? 0;
  const isFiller = (l: string) => !l.trim() || /^\s*(?:[*\-_]{3,}|—+)\s*$/.test(l.trim());
  const drop = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (!level(lines[i])) continue;
    let j = i + 1;
    const filler: number[] = [];
    while (j < lines.length && isFiller(lines[j])) {
      filler.push(j);
      j++;
    }
    const next = j < lines.length ? level(lines[j]) : 0;
    // A parent heading directly above a deeper heading is legitimate.
    if (j < lines.length && next > level(lines[i])) continue;
    if (j >= lines.length || next > 0) {
      drop.add(i);
      for (const f of filler) drop.add(f);
    }
  }
  if (!drop.size) return input;
  return lines
    .filter((_, i) => !drop.has(i))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Stray non-Latin characters.
 *
 * Generation occasionally drops a CJK token mid-sentence ("cultural升級
 * rather than upselling"). It is never content — it is a decoding artifact of
 * the model, and it is unreadable to the audience these documents are written
 * for. Known tokens are translated back into the English word they stand for;
 * anything else is removed and the surrounding spacing repaired.
 */
const SCRIPT_ARTIFACT_TRANSLATIONS: Array<[RegExp, string]> = [
  [/升級|升级/g, "upgrade"],
  [/優化|优化/g, "optimisation"],
  [/品牌/g, "brand"],
];

const CJK_RUN = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/g;

export function stripStrayScriptArtifacts(input: string): string {
  if (!input) return input;
  let t = input;
  for (const [re, word] of SCRIPT_ARTIFACT_TRANSLATIONS) {
    // "cultural升級 rather" → "cultural upgrade rather": a missing space on
    // either side is restored so the repaired sentence reads normally.
    t = t.replace(re, ` ${word} `);
  }
  t = t.replace(CJK_RUN, " ");
  return t.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1");
}

export function stripDocumentMetadata(input: string | null | undefined, telemetryLabel?: string): string {
  if (!input) return "";
  let t = stripStrayScriptArtifacts(stripComparisonFraming(input));



  const found: string[] = [];
  for (const re of BLOCK_PATTERNS) {
    if (re.test(t)) found.push(re.source.slice(0, 40));
    t = t.replace(re, "");
  }
  for (const re of EQUALS_SECTION_PATTERNS) {
    if (re.test(t)) found.push(re.source.slice(0, 40));
    t = t.replace(re, "");
  }

  let strippedLines = 0;
  t = t
    .split("\n")
    .filter((line) => {
      const hit = LINE_STRIP.some((re) => re.test(line));
      if (hit) strippedLines++;
      return !hit;
    })
    .join("\n");

  for (const re of INLINE_STRIP) t = t.replace(re, "");

  // A heading left standing with no body is a defect the strips above create.
  t = dropEmptyHeadings(t.replace(/\n{3,}/g, "\n\n").trim());


  if (telemetryLabel && (found.length > 0 || strippedLines > 0)) {
    console.log(
      `[TELEMETRY] metadata-scan doc=${telemetryLabel} blocks_found=${found.length} lines_stripped=${strippedLines} patterns="${found.join("|")}"`,
    );
  } else if (telemetryLabel) {
    console.log(`[TELEMETRY] metadata-scan doc=${telemetryLabel} status=CLEAN`);
  }

  // Post-strip sanity check — any residual marker words = renderer leak.
  if (telemetryLabel) {
    const residual = /\[METADATA\]|\[SELECTION_RATIONALE_STUB\]|FIELD_NAME\s*:|ICONIC_TIER_STATUS\s*:|PRESSURE_TEST_NOTE\s*:|={3,}/.test(t);
    if (residual) console.log(`[TELEMETRY] metadata-scan doc=${telemetryLabel} status=RESIDUAL_LEAK`);
  }

  return t;
}
