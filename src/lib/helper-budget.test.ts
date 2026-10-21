import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guard the actual call-site limits, not a parallel unused configuration.
describe("pipeline helper calls reserve at least 8000 tokens", () => {
  const cases = [
    ["Stage 8 compression", "stage8-disruption.server.ts", [16000, 8000, 8000]],
    ["LOC abstraction", "loc/engine-prompts.ts", [8000]],
    ["LOC stimulus adjudication", "loc.functions.ts", [8000]],
    ["Stage 9 coverage retry", "stage9.functions.ts", [64000, 8000]],
    ["Stage 9 LOC coverage retry", "stage9-loc-batch.server.ts", [32000, 8000]],
    ["Stage 20 scorer", "stage20-scorer.ts", [8000]],
    ["Stage 21 fidelity check", "stage21-fidelity.server.ts", [8000]],
  ] as const;
  for (const [label, file, expected] of cases) {
    it(label, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      const budgets = [...source.matchAll(/maxTokens:\s*(\d+)\s*[,}]/g)].map(match => Number(match[1]));
      expect(budgets).toEqual(expected);
      for (const budget of budgets) expect(budget).toBeGreaterThanOrEqual(8000);
    });
  }
});