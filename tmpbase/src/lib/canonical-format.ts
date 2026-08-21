// Canonical inter-stage data contracts.
//
// The UI rendering of a stage and the database write of its selection are
// SEPARATE concerns. Every selection/handoff written to the `sessions` table
// MUST be normalised to a fixed canonical format here, so downstream stages
// can parse it deterministically regardless of how the prompt or UI evolves.
//
// Contracts defined in this file:
//   * canonicaliseStage17Territory  → sessions.stage_17_selected_territory
//   * canonicaliseStage17bOutput     → sessions.stage_17b_output
//   * parseStage17Territory          → defensive read for Stage 18+
//
// Rules:
//   - Writers normalise; readers parse defensively.
//   - On missing/malformed input, readers throw a clear error rather than
//     silently passing junk to Claude.

// ─── Stage 17 — selected territory ───────────────────────────────────────────
//
// Canonical shape:
//
//   ## [TERRITORY NAME]
//
//   [TERRITORY DESCRIPTION content only]
//
//   THREE TRUTH CONNECTION:
//   [three truth content only]
//
// No "WHY THIS TERRITORY SERVES THE SMP" scaffold. No labelled sub-headers
// other than "THREE TRUTH CONNECTION:". No card decorations.

const TERRITORY_NAME_STRIP = /^[#>*\s-]+|[#*\s]+$/g;

function cleanName(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(TERRITORY_NAME_STRIP, "")
    .trim();
}

function extractSection(text: string, header: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const t = lines[i].trim();
    // Stop at the next ALL-CAPS labelled header line ending in ":" or a new card heading.
    if (/^#{1,6}\s/.test(t)) break;
    if (/^[A-Z][A-Z0-9 \-—/]{3,}:\s*$/.test(t)) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim() || null;
}

/**
 * Normalise any raw Stage 17 card markdown into the canonical
 * stage_17_selected_territory format.
 */
export function canonicaliseStage17Territory(raw: string): string {
  const src = (raw ?? "").trim();
  if (!src) throw new Error("Stage 17 territory: empty input");

  const lines = src.split(/\r?\n/);
  // Name = first non-empty line, stripped of markdown decoration.
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx === -1) throw new Error("Stage 17 territory: no content");
  const name = cleanName(lines[firstIdx]).toUpperCase();
  if (!name) throw new Error("Stage 17 territory: could not derive territory name");

  // Description: prefer a "TERRITORY DESCRIPTION:" labelled block; otherwise
  // take everything between the name line and the first known sub-header
  // (WHY/THREE TRUTH/Territory Status), excluding the scaffolded blocks.
  const body = lines.slice(firstIdx + 1).join("\n");

  let description = extractSection(body, /^TERRITORY DESCRIPTION:?\s*$/i);
  if (!description) {
    // Fallback: take prose up to the first known labelled section, dropping
    // any "WHY THIS TERRITORY SERVES THE SMP" preamble if present.
    const stripWhy = body.replace(
      /^[\s\S]*?WHY THIS TERRITORY SERVES THE SMP:?\s*\n[\s\S]*?(?=\n[A-Z][A-Z0-9 \-—/]{3,}:|\nTHREE TRUTH CONNECTION:|$)/i,
      "",
    );
    const cut = stripWhy.split(/\n(?=THREE TRUTH CONNECTION:|Territory Status:|TERRITORY STATUS:|SMP ALIGNMENT:|> SMP ALIGNMENT:)/i)[0];
    description = cut.trim();
  }
  if (!description) throw new Error("Stage 17 territory: missing description content");

  const truths = extractSection(body, /^THREE TRUTH CONNECTION:?\s*$/i) ?? "";

  const parts = [`## ${name}`, "", description];
  if (truths) parts.push("", "THREE TRUTH CONNECTION:", truths);
  return parts.join("\n").trim() + "\n";
}

/**
 * Defensive read for downstream stages (Stage 18+). Returns `{ name, body }`
 * or throws a clear error if the field is unusable.
 */
export function parseStage17Territory(field: string | null | undefined): {
  name: string;
  body: string;
  canonical: string;
} {
  if (!field || !field.trim()) {
    throw new Error(
      "stage_17_selected_territory is empty — Stage 17 selection must be persisted before downstream stages run.",
    );
  }
  // Idempotent: if already canonical, parse cheaply; otherwise re-canonicalise.
  let canonical: string;
  try {
    canonical = canonicaliseStage17Territory(field);
  } catch (e) {
    throw new Error(
      `stage_17_selected_territory is malformed: ${(e as Error).message}`,
    );
  }
  const lines = canonical.split(/\r?\n/);
  const headIdx = lines.findIndex((l) => /^##\s+/.test(l));
  const name = headIdx >= 0 ? lines[headIdx].replace(/^##\s+/, "").trim() : "";
  const body = lines.slice(headIdx + 1).join("\n").trim();
  if (!name) throw new Error("stage_17_selected_territory: could not parse territory name");
  return { name, body, canonical };
}

// ─── Stage 17B — detonation intelligence output ─────────────────────────────
//
// Each precedent record MUST start with the literal header
// "CAMPAIGN IDENTIFICATION" on its own line. If the model omits it, prepend.

export function canonicaliseStage17bOutput(raw: string): string {
  const src = (raw ?? "").trim();
  if (!src) return src;
  const first = src.split(/\r?\n/, 1)[0].trim();
  if (/^CAMPAIGN IDENTIFICATION\b/i.test(first)) return src;
  return `CAMPAIGN IDENTIFICATION\n\n${src}`;
}
