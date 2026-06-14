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

// Per-line strips: fields and standalone ==== markers / DELIVERABLE headers.
const LINE_STRIP: RegExp[] = [
  /^\s*FIELD_NAME\s*:.*/i,
  /^\s*ICONIC_TIER_STATUS\s*:.*/i,
  /^\s*PRESSURE_TEST_NOTE\s*:.*/i,
  // ==== DELIVERABLE ... ==== style headers
  /^\s*={2,}\s*DELIVERABLE\b.*$/i,
  // Standalone ==== separator markers
  /^\s*={3,}\s*$/,
  // Any remaining "==== SOMETHING ====" header line (defence in depth)
  /^\s*={2,}\s+[A-Z][A-Z0-9 _\-/]*\s*={0,}\s*$/,
];

export function stripDocumentMetadata(input: string | null | undefined, telemetryLabel?: string): string {
  if (!input) return "";
  let t = input;

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

  t = t.replace(/\n{3,}/g, "\n\n").trim();

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
