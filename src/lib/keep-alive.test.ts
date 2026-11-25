import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { awaitWithDeltaKeepAlive, keepAliveStream, resultOf } from "./keep-alive";

const slow = <T,>(v: T, ms: number) => new Promise<T>((r) => setTimeout(() => r(v), ms));

describe("keep-alive helpers", () => {
  it("sends keep-alives while a silent call runs, then the unchanged result", async () => {
    const chunks: unknown[] = [];
    for await (const c of keepAliveStream(slow({ ok: 1 }, 70), 20)) chunks.push(c);
    expect(chunks.filter((c) => (c as { keepalive?: boolean }).keepalive).length).toBeGreaterThanOrEqual(2);
    expect(chunks.at(-1)).toEqual({ done: true, result: { ok: 1 } });
  });
  it("passes failures through unchanged", async () => {
    await expect(resultOf(keepAliveStream(Promise.reject(new Error("credit")), 10))).rejects.toThrow("credit");
  });
  it("browser unwrap returns the same result and accepts plain values", async () => {
    expect(await resultOf(keepAliveStream(slow("x", 30), 10))).toBe("x");
    expect(await resultOf(Promise.resolve({ a: 1 }))).toEqual({ a: 1 });
  });
  it("delta streams get empty keep-alive deltas and the value", async () => {
    const box: { value?: number } = {};
    const out: string[] = [];
    for await (const c of awaitWithDeltaKeepAlive(slow(7, 50), box, 15)) out.push(c.delta);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d === "")).toBe(true);
    expect(box.value).toBe(7);
  });
});

// Every long, silent model step reached from the browser is wrapped.
const wrapped: [string, string][] = [
  ["src/lib/synthesiser.functions.ts", "synthesiseResearch"],
  ["src/lib/stimulus.functions.ts", "reviseStimulusDirection"],
  ["src/lib/stimulus-rating.functions.ts", "rateStimulusBatch"],
  ["src/lib/stimulus-rating.functions.ts", "runStimulusTiebreaker"],
  ["src/lib/stimulus-attempts.functions.ts", "tryAgainStimulusDirection"],
  ["src/lib/threeTruth.functions.ts", "extractBrandGuidelinesFromPdf"],
  ["src/lib/fact-verify.functions.ts", "reverifyStageFacts"],
];
describe("keep-alive coverage", () => {
  for (const [file, name] of wrapped)
    it(`${name} keeps its connection alive`, () => {
      const src = readFileSync(file, "utf8");
      const start = src.indexOf(`export const ${name} =`);
      const next = src.indexOf("export const ", start + 1);
      expect(src.slice(start, next < 0 ? undefined : next)).toMatch(/\.handler\(async function\* [\s\S]*yield\* keepAliveStream\(/);
    });
  for (const file of ["src/lib/stage2.functions.ts", "src/lib/stage4b.functions.ts"])
    it(`${file} fact checks keep the stage stream alive`, () => {
      expect(readFileSync(file, "utf8")).toMatch(/yield\* awaitWithDeltaKeepAlive\(runStageFactVerification\(/);
    });
});
