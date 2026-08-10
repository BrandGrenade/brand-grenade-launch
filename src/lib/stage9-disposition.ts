// Stage 9 — MANDATORY CANDIDATE DISPOSITION LEDGER
//
// Stage 9's own standard is explicit reasoning for every decision. Previously
// that only applied to propositions it chose to PRESENT: Stage 8 candidates and
// LOC candidates that did not make the cut were dropped with no recorded
// reason anywhere. This module makes the discard path explicit:
//   1. Stage 8 / LOC candidates are enumerated with stable ids as input.
//   2. The prompt requires a closing CANDIDATE DISPOSITION table covering
//      every id (SURVIVED / REBUILT INTO <SMP> / REJECTED — reason).
//   3. Coverage is checked in code; missing ids trigger a targeted retry.
//   4. Anything still unaccounted for (including a failed LOC batch) is
//      written into the ledger as an explicit entry with a stated reason —
//      never silently dropped.

export type LedgerCandidate = {
  /** Stable id shown to the model, e.g. "S8-3" or "LOC-2". */
  id: string;
  /** The candidate line itself. */
  line: string;
  /** Optional extra context (engine name, descriptor). */
  note?: string;
};

export const DISPOSITION_HEADING = "==== CANDIDATE DISPOSITION — EVERY INPUT CANDIDATE ACCOUNTED FOR ====";

/** Pull the Stage 8 candidate propositions out of Stage 8's output. */
export function extractStage8Candidates(stage8Output: string | null | undefined): LedgerCandidate[] {
  const text = stage8Output ?? "";
  const out: LedgerCandidate[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const line = raw.replace(/\s+/g, " ").replace(/^["“”']|["“”']$/g, "").trim();
    if (line.length < 4 || line.length > 200) return;
    const key = line.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: `S8-${out.length + 1}`, line });
  };

  // Primary signal: blockquoted bold proposition lines.
  for (const m of text.matchAll(/^>\s*\*\*([^*\n]{4,180})\*\*/gm)) push(m[1]!);

  if (out.length === 0) {
    // Fallback: "PROPOSITION N" labels — take the next meaningful line.
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*(?:\*\*)?PROPOSITION\s+\d+/i.test(lines[i] ?? "")) continue;
      const inline = (lines[i] ?? "").replace(/^\s*(?:\*\*)?PROPOSITION\s+\d+[^A-Za-z0-9"“]*/i, "").replace(/\*+/g, "").trim();
      if (inline.length >= 4) {
        push(inline);
        continue;
      }
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const cand = (lines[j] ?? "").replace(/^[>\s*#-]+/, "").replace(/\*+/g, "").trim();
        if (cand.length >= 4) {
          push(cand);
          break;
        }
      }
    }
  }

  return out;
}

/** The enumerated candidate block shown to the model as input. */
export function buildCandidateLedgerBlock(candidates: LedgerCandidate[]): string {
  if (candidates.length === 0) return "(no discrete candidates could be enumerated from the upstream output)";
  return candidates
    .map((c) => `${c.id} | "${c.line}"${c.note ? ` | ${c.note}` : ""}`)
    .join("\n");
}

/** The instruction block that makes the disposition table mandatory. */
export function buildDispositionInstruction(candidates: LedgerCandidate[]): string {
  if (candidates.length === 0) return "";
  return `${DISPOSITION_HEADING}
This is MANDATORY and is the LAST thing in your output. Stage 9's standard is explicit reasoning for every decision — that applies to candidates you discard exactly as much as to propositions you present. Silent filtering is a failure of this stage.

Output one row for EVERY one of the ${candidates.length} enumerated candidates above (${candidates[0]!.id} through ${candidates[candidates.length - 1]!.id}), in id order, using exactly this pipe format and nothing else:

<ID> | SURVIVED | <the SMP it appears as, verbatim>
<ID> | REBUILT INTO | <the SMP it was rebuilt into, verbatim> — <one line on what changed and why>
<ID> | REJECTED | <one-line reason grounded in the impossibility analysis, the five stress tests, the anti-convergence rule, or the banned-word rule>

Every id must appear exactly once. Do not merge rows, do not skip an id, do not write "as above", and do not omit an id because it was uninteresting — "not strong enough to carry" is a reason and must be written out.`;
}

const VERDICT = /(SURVIVED|REBUILT\s+INTO|REBUILT|REJECTED)/i;

/** Ids that have an explicit verdict row somewhere in the output. */
export function parseDispositionIds(text: string): Set<string> {
  const found = new Set<string>();
  for (const line of (text ?? "").split("\n")) {
    const idMatch = line.match(/\b((?:S8|LOC)-\d+)\b/i);
    if (!idMatch) continue;
    if (!VERDICT.test(line)) continue;
    found.add(idMatch[1]!.toUpperCase());
  }
  return found;
}

export function missingDispositions(candidates: LedgerCandidate[], text: string): LedgerCandidate[] {
  const found = parseDispositionIds(text);
  return candidates.filter((c) => !found.has(c.id.toUpperCase()));
}

/** Targeted retry note asking only for the rows that are missing. */
export function buildCoverageRetryNote(missing: LedgerCandidate[]): string {
  return `\n\n==== DISPOSITION COVERAGE FAILURE — CORRECTION REQUIRED ====
Your CANDIDATE DISPOSITION table did not account for every enumerated candidate. The following ${missing.length} candidate(s) have no verdict row:

${missing.map((c) => `${c.id} | "${c.line}"`).join("\n")}

Reply with ONLY the missing rows, in the exact pipe format (<ID> | SURVIVED|REBUILT INTO|REJECTED | ...), one per line, no preamble and no other text. Every id listed above must appear.`;
}

/** Fallback rows so the ledger is 100% complete even when the model will not comply. */
export function buildForcedRejectionRows(missing: LedgerCandidate[], reason: string): string {
  return missing.map((c) => `${c.id} | REJECTED | ${reason}`).join("\n");
}

/**
 * Merge a (possibly partial) disposition table into the output so the final
 * saved text always accounts for 100% of the enumerated candidates.
 */
export function appendDispositionCompletion(args: {
  output: string;
  candidates: LedgerCandidate[];
  extraRows: string;
  forcedReason?: string;
}): string {
  const rows = args.extraRows.trim();
  if (!rows) return args.output;
  const header = args.output.includes(DISPOSITION_HEADING)
    ? "\n\nCANDIDATE DISPOSITION — COMPLETION ROWS (added by coverage check)\n"
    : `\n\n${DISPOSITION_HEADING}\n`;
  return `${args.output}${header}${rows}\n`;
}
