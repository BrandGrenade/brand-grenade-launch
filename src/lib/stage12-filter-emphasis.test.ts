import { describe, it, expect } from "vitest";
import {
  filterValidatedFromStage11,
  parseStage10Scores,
} from "@/lib/stage12-filter";

// Verbatim shape of the live TestBrand Stage 11 output that produced
// "Stage 11 produced no VALIDATED SMPs" — every structural label is bolded.
const STAGE_11 = `## Stage 11 — SMP Pressure Test Under Competitive Stress

**SMPS RECEIVED FROM STAGE 10:** 5

### Proposition One

**SMP:** "Energy you dose, not energy you reach for." — **FIELD:** Australian premium energy drink — **ICONIC TIER FLAG:** YES

**Test 1 — Competitive Counter:** HOLDS — rationale.

**SMP VERDICT:** VALIDATED WITH STRATEGIC NOTE

**ICONIC TIER FINAL STATUS:** CONFIRMED

### Proposition Two

**SMP:** "Read the back. We built it to match the front." — **FIELD:** Australian premium energy drink — **ICONIC TIER FLAG:** NO

**SMP VERDICT:** VALIDATED

**ICONIC TIER FINAL STATUS:** N/A

### Proposition Three

**SMP:** "Refusing everything is easy." — **FIELD:** Australian premium energy drink — **ICONIC TIER FLAG:** NO

**SMP VERDICT:** ELIMINATED
`;

const STAGE_10 = `### Proposition One

**SMP:** "Energy you dose, not energy you reach for." — **FIELD:** Australian premium energy drink

**Fame:** 7/10
**Truth Strength:** 8/10
**Competitive Impossibility:** 8/10
**Brand Permission:** 6/10
**Clean Air:** 7/10
**Commercial Precedent:** 5/10
`;

describe("stage 11 → 12 filter tolerates markdown emphasis", () => {
  it("parses bolded SMP/FIELD headings and verdicts", () => {
    const { validated, eliminated } = filterValidatedFromStage11(STAGE_11);
    expect(validated.map((v) => v.smpLine)).toEqual([
      "Energy you dose, not energy you reach for.",
      "Read the back. We built it to match the front.",
    ]);
    expect(eliminated).toHaveLength(1);
    expect(validated[0].fieldName).toBe("Australian premium energy drink");
    expect(validated[0].iconicStatus).toBe("CONFIRMED");
  });

  it("parses bolded Stage 10 dimension scores", () => {
    const [s] = parseStage10Scores(STAGE_10);
    expect(s.fame).toBe(7);
    expect(s.truthStrength).toBe(8);
    expect(s.codeVerdict).toBe("PASS");
  });
});
