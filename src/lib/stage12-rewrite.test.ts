// A pressure-test rewrite must reach Stage 12 as the authoritative wording,
// whatever emphasis or quote style the model used, and the superseded original
// must never survive anywhere in the block that selection reads back.

import { describe, it, expect } from "vitest";
import { filterValidatedFromStage11 } from "./stage12-filter";

function block(rewriteLine: string) {
  return `### SMP: "The machine can fly it. A human clears it." — FIELD: Left-of-Centre — ICONIC TIER FLAG: NO

Test 1 — Competitive Counter: WOBBLES — the flagged wording, "The machine can fly it. A human clears it.", is borrowable.

SMP VERDICT: REWRITTEN
REWRITE: ${rewriteLine} — Reason: tightens the clearance to the owned territory. ALL HOLD post-rewrite.
`;
}

const FIXED = "The machine can fly it. A named human clears it.";

describe("Stage 11 → Stage 12 rewrite handoff", () => {
  for (const [style, raw] of [
    ["italic + straight quotes", `*"${FIXED}"*`],
    ["straight quotes", `"${FIXED}"`],
    ["smart quotes", `\u201C${FIXED}\u201D`],
    ["underscore emphasis", `_"${FIXED}"_`],
    ["unquoted", FIXED],
  ] as const) {
    it(`carries the rewritten line forward (${style})`, () => {
      const r = filterValidatedFromStage11(block(raw));
      const v = r.validated.find((x) => x.verdict === "REWRITTEN");
      expect(v?.smpLine).toBe(FIXED);
    });
  }

  it("supersedes the pre-rewrite wording everywhere except its one labelled reference", () => {
    const r = filterValidatedFromStage11(block(`*"${FIXED}"*`));
    const v = r.validated.find((x) => x.verdict === "REWRITTEN")!;
    expect(v.block).toContain("SUPERSEDED ORIGINAL (do not use)");
    const after = v.block.split("SUPERSEDED ORIGINAL")[1].split("\n").slice(1).join("\n");
    expect(after).not.toContain("The machine can fly it. A human clears it.");
    expect(after).toContain(FIXED);
  });
});

// Issue 2: a rewrite that ALSO carries a non-fatal flag is reclassified as
// "VALIDATED — EXPOSED". The corrected wording must still carry forward —
// this is precisely the case the rewrite exists to fix.
describe("flagged rewrite", () => {
  const flagged = `### SMP: "The machine can fly it. A human clears it." — FIELD: Left-of-Centre

Test 1 — Competitive Counter: WOBBLES.

SMP VERDICT: REWRITTEN
[FATAL: NONE]
[FLAGS: T1]
REWRITE: "${FIXED}" — Reason: closes the competitive exposure.
`;

  it("keeps the rewritten wording when the verdict is reclassified as exposed", () => {
    const r = filterValidatedFromStage11(flagged);
    const v = r.validated[0];
    expect(v.verdict).toBe("VALIDATED — EXPOSED");
    expect(v.smpLine).toBe(FIXED);
    expect(v.block).toContain("SUPERSEDED ORIGINAL (do not use)");
    const after = v.block.split("SUPERSEDED ORIGINAL")[1].split("\n").slice(1).join("\n");
    expect(after).not.toContain("The machine can fly it. A human clears it.");
  });

  it("does not resurrect a rewrite for an eliminated proposition", () => {
    const killed = flagged.replace("[FATAL: NONE]", "[FATAL: T3]");
    const r = filterValidatedFromStage11(killed);
    expect(r.validated).toHaveLength(0);
    expect(r.eliminated[0].smpLine).toBe("The machine can fly it. A human clears it.");
  });
});
