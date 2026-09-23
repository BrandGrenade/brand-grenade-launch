import { describe, expect, it } from "vitest";
import { contentIntegrityFindings } from "./content-integrity";

describe("content integrity count context", () => {
  it("does not treat a remaining subset as a conflicting whole-set count", () => {
    const html = [
      '<section><p class="kicker"><span class="idx">01</span>Recommendation</p><p>Four strategic territories were assessed.</p></section>',
      '<section><p class="kicker"><span class="idx">02</span>Decision</p><p>The remaining three territories are retained as subordinate claims.</p></section>',
    ].join("");

    expect(contentIntegrityFindings(html).filter((f) => f.criterion === "CONSISTENT")).toEqual([]);
  });

  it("still rejects contradictory whole-set counts", () => {
    const html = [
      '<section><p class="kicker"><span class="idx">01</span>Recommendation</p><p>Four strategic territories were assessed.</p></section>',
      '<section><p class="kicker"><span class="idx">02</span>Decision</p><p>Three territories were assessed.</p></section>',
    ].join("");

    expect(contentIntegrityFindings(html).some((f) => f.criterion === "CONSISTENT")).toBe(true);
  });
});