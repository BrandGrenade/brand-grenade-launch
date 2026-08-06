// SMP verbatim carriage verifier — Tier Two Check 14.
//
// The validated SMP must travel through Stage 20, Stage 20B, and Stage 21
// unaltered. Every one of those stages receives the SMP through
// smpGoverningBlock() in src/lib/phase2-shared.ts, which mandates a verbatim
// "SMP (VERBATIM):" line in the output. This module is the machine check on
// that contract — it is deliberately strict: a paraphrase, a re-punctuation,
// or a channel-specific rewrite is a failure, not a warning.

/** Normalise only what is typographically lossless: smart quotes/dashes,
 *  whitespace runs, and surrounding quote marks. Case and wording are NOT
 *  normalised — a case change or a reworded SMP is a carriage failure. */
export function normaliseForCarriage(input: string): string {
  return input
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["'.]+$/g, "")
    .trim();
}

export type CarriageStageInput = {
  /** Human label, e.g. "Stage 20B". */
  label: string;
  /** Full stage output text. Stage 21 passes all channel briefs joined. */
  output: string | null | undefined;
};

export type CarriageStageResult = {
  label: string;
  present: boolean;
  /** True when the stage printed the mandated "SMP (VERBATIM):" heading line
   *  with the exact SMP under/after it. */
  headingPresent: boolean;
  /** Nearest paraphrase evidence when the verbatim string is missing. */
  evidence: string | null;
};

const HEADING = /SMP\s*\(VERBATIM\)\s*:?\s*/i;

function nearestParaphrase(normOutput: string, normSmp: string): string | null {
  // Find the densest window of SMP words as evidence the stage reinterpreted
  // rather than carried the line.
  const words = normSmp.toLowerCase().split(" ").filter((w) => w.length > 3);
  if (words.length === 0) return null;
  const lower = normOutput.toLowerCase();
  let best: { at: number; hits: number } | null = null;
  for (const w of words) {
    const at = lower.indexOf(w);
    if (at < 0) continue;
    const window = lower.slice(Math.max(0, at - 120), at + 240);
    const hits = words.filter((x) => window.includes(x)).length;
    if (!best || hits > best.hits) best = { at, hits };
  }
  if (!best || best.hits < Math.max(2, Math.ceil(words.length / 2))) return null;
  return normOutput.slice(Math.max(0, best.at - 120), best.at + 240).trim();
}

export function checkSmpCarriage(
  selectedSmp: string | null | undefined,
  stages: CarriageStageInput[],
): { smp: string; results: CarriageStageResult[] } {
  const smp = normaliseForCarriage(selectedSmp ?? "");
  const results = stages.map<CarriageStageResult>((s) => {
    const out = normaliseForCarriage(s.output ?? "");
    if (!smp || !out) {
      return { label: s.label, present: false, headingPresent: false, evidence: null };
    }
    const present = out.includes(smp);
    const headingMatch = out.match(new RegExp(HEADING.source + escapeRe(smp), "i"));
    return {
      label: s.label,
      present,
      headingPresent: Boolean(headingMatch),
      evidence: present ? null : nearestParaphrase(out, smp),
    };
  });
  return { smp, results };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Throws with a specific, actionable message on any carriage failure.
 *  Returns the pass detail string. */
export function assertSmpVerbatimCarriage(
  selectedSmp: string | null | undefined,
  stages: CarriageStageInput[],
): string {
  const { smp, results } = checkSmpCarriage(selectedSmp, stages);
  if (!smp) throw new Error("No selected_smp on the session — SMP carriage cannot be verified.");

  const missing = results.filter((r) => !r.present);
  if (missing.length > 0) {
    const parts = missing.map(
      (m) =>
        `${m.label}: SMP not present verbatim.${
          m.evidence ? ` Nearest text found (paraphrase evidence): "${m.evidence.slice(0, 220)}…"` : " No related text found at all."
        }`,
    );
    throw new Error(
      `SMP verbatim carry-through broken for "${smp}". ${parts.join(" | ")}`,
    );
  }

  const noHeading = results.filter((r) => !r.headingPresent).map((r) => r.label);
  if (noHeading.length > 0) {
    throw new Error(
      `SMP present but the mandated "SMP (VERBATIM):" carriage heading is missing in: ${noHeading.join(", ")}. The heading is the machine-checkable contract — without it the next regression cannot distinguish carriage from coincidence.`,
    );
  }

  return `SMP "${smp}" carried verbatim, under the mandated SMP (VERBATIM) heading, through ${results
    .map((r) => r.label)
    .join(", ")}.`;
}
