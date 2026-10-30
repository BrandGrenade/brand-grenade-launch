// Contract regression tests: every Hub allow-list output has a contract, and
// the captured JLR access-point payloads satisfy them. A future change that
// drops a field, renames a schema version or adds an output without a
// contract fails here.
import { describe, expect, it } from "vitest";
import { CONTRACTS, CONTRACT_BY_ID } from "./contracts";
import { OUTPUTS_BY_TABLE } from "./core";
import fixtures from "./fixtures/jlr-access-contracts.json";

describe("access contracts", () => {
  it("covers every allow-list output exactly once", () => {
    const allowed = Object.values(OUTPUTS_BY_TABLE).flat().sort();
    const contracted = CONTRACTS.map((c) => c.output_id).sort();
    expect(contracted).toEqual(allowed);
    expect(new Set(contracted).size).toBe(contracted.length);
  });

  it("gives every contract a schema version and a content schema unless never served", () => {
    for (const c of CONTRACTS) {
      expect(c.schema_version).toMatch(/\.v1$/);
      if (c.status === "unavailable") expect(c.content).toBeNull();
      else expect(c.content).not.toBeNull();
    }
  });
});

describe("JLR payloads satisfy their contracts", () => {
  const byId = new Map(fixtures.map((f) => [`${f.run}:${f.output_id}`, f]));

  it("has a captured payload for every output of the three JLR runs", () => {
    const expected: [string, string[]][] = [
      ["pipeline", OUTPUTS_BY_TABLE.sessions.filter(id=>!id.startsWith('validate.'))],
      ["intelligence", OUTPUTS_BY_TABLE.intelligence_sessions],
      ["synthesiser", OUTPUTS_BY_TABLE.synthesiser_runs],
    ];
    for (const [run, outputs] of expected) for (const oid of outputs) expect(byId.has(`${run}:${oid}`), `${run}:${oid}`).toBe(true);
  });

  for (const f of fixtures) {
    it(`${f.run} ${f.output_id} → ${f.content_status}`, () => {
      const c = CONTRACT_BY_ID.get(f.output_id);
      expect(c, `no contract for ${f.output_id}`).toBeDefined();
      expect(f.schema_version).toBe(c!.schema_version);

      if (c!.status === "conditional") {
        // JLR runs are Campaign briefs: current-position outputs are
        // legitimately not produced.
        expect(f.content_status).toBe("not_produced");
        return;
      }
      if (c!.status === "unavailable") {
        expect(f.content_status).toBe("unavailable");
        expect(f.content).toBeNull();
        return;
      }
      expect(f.content_status).toBe(c!.status);
      const parsed = c!.content!.safeParse(f.content);
      if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      expect(parsed.success).toBe(true);
    });
  }
});
