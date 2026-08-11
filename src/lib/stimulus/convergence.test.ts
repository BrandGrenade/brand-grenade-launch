import { describe, it, expect } from "vitest";
import {
  parseBigIdeaResponse,
  parseCollisionField,
  buildBigIdeaUserMessage,
} from "@/lib/stimulus/big-idea-prompt";
import {
  parseLedger,
  missingLedgerIds,
  symmetrise,
  type LedgerIdea,
} from "@/lib/stimulus/convergence-ledger.server";
import { STIMULUS_LENSES } from "@/lib/stimulus/lenses";

describe("in-sweep collision field", () => {
  it("parses CLEAR as no collisions", () => {
    expect(parseCollisionField("CLEAR")).toEqual([]);
  });
  it("parses single and multiple collisions", () => {
    const c = parseCollisionField(
      "COLLIDES WITH a3 — same root tension: refusal dressed as patience\nCOLLIDES WITH a7 — identical conceit",
    );
    expect(c.map((x) => x.lensId)).toEqual(["a3", "a7"]);
    expect(c[0].why).toContain("refusal");
  });
  it("surfaces collisions through the full parser", () => {
    const raw = `### LENS: a1\nTHE BIG IDEA\nIdea.\n\nROOT TENSION\nThe cost of being early.\n\nIDEA COLLISION CHECK\nCOLLIDES WITH a3 — same underlying territory\n\nCANDIDATE MASTER LINE\nEarly Costs Everything\n\nWHY IT WINS\nBecause.`;
    const p = parseBigIdeaResponse(raw).a1;
    expect(p.rootTension).toBe("The cost of being early.");
    expect(p.collisions).toEqual([{ lensId: "a3", why: "same underlying territory" }]);
    expect(p.line).toBe("Early Costs Everything");
  });
  it("legacy output with no new fields still parses clear", () => {
    const raw = `### LENS: a1\nTHE BIG IDEA\nIdea.\n\nCAMPAIGN LINE\nOld line\n\nWHY IT WINS\nY.`;
    const p = parseBigIdeaResponse(raw).a1;
    expect(p.collisions).toEqual([]);
    expect(p.rootTension).toBe("");
  });
  it("user message carries prior tensions and the regeneration directive", () => {
    const base = {
      brandName: "B",
      category: "C",
      smp: "S",
      detonationLine: "",
      truths: "",
      strategicEvidence: "",
      lenses: [STIMULUS_LENSES[0]],
    };
    expect(buildBigIdeaUserMessage(base)).toContain("NO IDEAS HAVE BEEN PRODUCED YET");
    const withPrior = buildBigIdeaUserMessage({
      ...base,
      priorTensions: [{ lensId: "a3", lensName: "Third", rootTension: "Being early costs" }],
      regenerationNote: "collided with a3",
    });
    expect(withPrior).toContain("a3 (Third): Being early costs");
    expect(withPrior).toContain("FORCED REGENERATION");
    expect(withPrior).toContain("not only the one it previously collided with");
  });
});

describe("full-set convergence ledger", () => {
  const ideas: LedgerIdea[] = [
    { lensId: "a3", lensName: "A3", rootTension: "t1" },
    { lensId: "a7", lensName: "A7", rootTension: "t1" },
    { lensId: "a15", lensName: "A15", rootTension: "t1" },
    { lensId: "a32", lensName: "A32", rootTension: "t2" },
  ];

  it("parses clear and collides rows", () => {
    const raw = [
      "a3 | COLLIDES | a7, a15 | one contradiction in three genres",
      "a7 | COLLIDES | a3, a15 | same",
      "a15 | CLEAR | its own territory",
      "a32 | CLEAR | distinct",
    ].join("\n");
    const e = parseLedger(raw, ideas);
    expect(e).toHaveLength(4);
    expect(e.find((x) => x.lensId === "a3")?.collidesWith).toEqual(["a7", "a15"]);
    expect(missingLedgerIds(ideas, e)).toEqual([]);
  });

  it("symmetrises a cluster so every member is flagged", () => {
    const raw = ["a3 | COLLIDES | a7, a15 | shared", "a7 | CLEAR | x", "a15 | CLEAR | y", "a32 | CLEAR | z"].join("\n");
    const e = symmetrise(parseLedger(raw, ideas));
    expect(e.find((x) => x.lensId === "a15")?.verdict).toBe("COLLIDES");
    expect(e.find((x) => x.lensId === "a7")?.collidesWith).toContain("a3");
    expect(e.find((x) => x.lensId === "a32")?.verdict).toBe("CLEAR");
  });

  it("reports uncovered ids for the coverage retry", () => {
    const e = parseLedger("a3 | CLEAR | x", ideas);
    expect(missingLedgerIds(ideas, e).map((m) => m.lensId)).toEqual(["a7", "a15", "a32"]);
  });

  it("ignores unknown ids and verdict-less lines", () => {
    const e = parseLedger("zz9 | CLEAR | nope\na3 | | blank\na7 | CLEAR | ok", ideas);
    expect(e.map((x) => x.lensId)).toEqual(["a7"]);
  });
});
