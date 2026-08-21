import { expect, test } from "vitest";
import { applyLocDispositions, parseLocDispositions } from "@/lib/loc/stage9-disposition-apply";
const ledger = `
==== CANDIDATE DISPOSITION — EVERY INPUT CANDIDATE ACCOUNTED FOR ====
LOC-1 | SURVIVED | Buy the car every number stopped mattering to
**LOC-2** | REBUILT INTO | Stop counting. Start looking — the original leaned on a passive observation; rebuilt into an active promise.
LOC-3 | REJECTED | Converges on the category's existing beauty claim.
`;
test("parse", () => {
  const m = parseLocDispositions(ledger);
  expect(m.size).toBe(3);
  expect(m.get(2)?.verdict).toBe("REBUILT");
  expect(m.get(2)?.line).toBe("Stop counting. Start looking");
  expect(m.get(3)?.verdict).toBe("REJECTED");
});
test("apply", () => {
  const pkgs = [1,2,3].map((n) => ({ engine: `e${n}`, engineOutput: { proposition: `line ${n}` } })) as never;
  const r = applyLocDispositions(pkgs, ledger);
  expect(r.packages.length).toBe(2);
  expect(r.rejected.length).toBe(1);
  expect(r.rebuiltCount).toBe(1);
  expect(r.packages[1]!.engineOutput.proposition).toBe("Stop counting. Start looking");
  expect(r.packages[1]!.rebuiltFromLine).toBe("line 2");
});
