import { expect, it } from "vitest";
import { extractLocJson } from "./extract-json";
it("extracts one complete answer instead of concatenating subsequent objects", () => {
  expect(JSON.parse(extractLocJson('## Result\n{"proposition":"A {house}","descriptor":"Say \\"yes\\""}\n{"note":"extra"}')).proposition).toBe("A {house}");
});
it("rejects truncated JSON instead of repairing it into a candidate", () => {
  expect(() => extractLocJson('{"proposition":"partial')).toThrow("incomplete JSON");
});