import { STAGE_18_DIMENSIONS, STAGE_18_MAX, STAGE_18_PASS_MARK } from "./stage18-scale";

/** Verdict set in code from the eight saved dimension scores: 72 or above out of 80 is PASS. */
export function stage18Verdict(total: number): "PASS" | "REVIEW" {
  return total >= STAGE_18_PASS_MARK ? "PASS" : "REVIEW";
}

const DIM_LINE = /^([A-Z][^,\n]{2,60}), (\d+(?:\.\d+)?)\.(?=\s|$)/gm;

/**
 * Applied to newly generated Stage 18 output only. For each candidate with exactly eight
 * "<dimension>, <score>." lines, COMPOSITE and STATUS are rewritten from the code sum.
 * Candidates without eight readable scores are left exactly as written.
 */
export function applyStage18CodeVerdict(output: string): string {
  const parts = output.split(/(?=^COMPOSITE:)/m);
  let carry = "";
  return parts.map((part, i) => {
    if (i === 0) { carry = part; return part; }
    const before = carry.split(/EIGHT DIMENSION STRESS TEST RESULTS/i).pop() ?? "";
    carry = part;
    const hits = [...before.matchAll(DIM_LINE)];
    const names = new Set(hits.map((h) => h[1]));
    if (hits.length !== STAGE_18_DIMENSIONS || names.size !== STAGE_18_DIMENSIONS) return part;
    const total = hits.reduce((s, h) => s + Number(h[2]), 0);
    return part
      .replace(/^COMPOSITE:[^\n]*/m, `COMPOSITE: ${total}/${STAGE_18_MAX}`)
      .replace(/^STATUS:[^\n]*/m, `STATUS: ${stage18Verdict(total)}`);
  }).join("");
}
