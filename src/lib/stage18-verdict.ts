import { STAGE_18_DIMENSIONS, STAGE_18_MAX, STAGE_18_PASS_MARK } from "./stage18-scale";
import { splitCards } from "./phase2-shared";

/** Verdict set in code from the eight saved dimension scores: 72 or above out of 80 is PASS. */
export function stage18Verdict(total: number): "PASS" | "REVIEW" {
  return total >= STAGE_18_PASS_MARK ? "PASS" : "REVIEW";
}

const DIM_LINE = /^([A-Z][^,\n]{2,60}), (\d+(?:\.\d+)?)\.(?=\s|$)/gm;

/** Rollout boundary: existing runs keep their original scoring/verdict behavior. */
export const STAGE18_CODE_VERDICT_FROM = "2026-11-26T00:58:33Z";
export function usesStage18CodeVerdict(createdAt: string | null | undefined): boolean {
  return !!createdAt && Number.isFinite(Date.parse(createdAt)) && Date.parse(createdAt) >= Date.parse(STAGE18_CODE_VERDICT_FROM);
}

/**
 * Applied to newly generated Stage 18 output only. For each candidate with exactly eight
 * "<dimension>, <score>." lines, COMPOSITE and STATUS are rewritten from the code sum.
 * Candidates without eight readable scores are left exactly as written.
 */
export function applyStage18CodeVerdict(output: string): string {
  let result = output;
  let cursor = 0;
  for (const card of splitCards(output)) {
    const start = output.indexOf(card.markdown, cursor);
    if (start < 0) throw new Error("Stage 18 candidate boundary could not be read; output not saved.");
    cursor = start + card.markdown.length;
    const headers = [...card.markdown.matchAll(/^EIGHT DIMENSION STRESS TEST RESULTS:?[ \t]*$/gm)];
    const composites = [...card.markdown.matchAll(/^COMPOSITE:[^\n]*/gm)];
    const statuses = [...card.markdown.matchAll(/^STATUS:[^\n]*/gm)];
    const header = headers[0];
    const composite = composites[0];
    if (headers.length !== 1 || composites.length !== 1 || statuses.length !== 1 || !header || !composite) continue;
    const bodyStart = header.index + header[0].length;
    if (composite.index <= bodyStart) continue;
    const hits = [...card.markdown.slice(bodyStart, composite.index).matchAll(DIM_LINE)];
    const names = new Set(hits.map((h) => h[1]));
    if (hits.length !== STAGE_18_DIMENSIONS || names.size !== STAGE_18_DIMENSIONS || hits.some(h => Number(h[2]) < 1 || Number(h[2]) > 10)) continue;
    const total = hits.reduce((s, h) => s + Number(h[2]), 0);
    const revised = card.markdown
      .replace(/^COMPOSITE:[^\n]*/m, `COMPOSITE: ${total}/${STAGE_18_MAX}`)
      .replace(/^STATUS:[^\n]*/m, `STATUS: ${stage18Verdict(total)}`);
    // Replace this exact card only; unrelated text and whitespace stay verbatim.
    const resultStart = result.indexOf(card.markdown, Math.max(0, start + result.length - output.length));
    if (resultStart < 0) throw new Error("Stage 18 candidate replacement failed; output not saved.");
    result = result.slice(0, resultStart) + revised + result.slice(resultStart + card.markdown.length);
  }
  return result;
}
