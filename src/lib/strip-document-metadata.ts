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

export function stripDocumentMetadata(input: string | null | undefined): string {
  if (!input) return "";
  let t = input;

  for (const re of BLOCK_PATTERNS) t = t.replace(re, "");
  for (const re of EQUALS_SECTION_PATTERNS) t = t.replace(re, "");

  t = t
    .split("\n")
    .filter((line) => !LINE_STRIP.some((re) => re.test(line)))
    .join("\n");

  // Collapse runs of blank lines created by removals.
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}
