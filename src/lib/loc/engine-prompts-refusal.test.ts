import { describe, expect, it } from "vitest";
import { getEngineSystemPrompt } from "./engine-prompts";
import { LOC_ENGINES } from "./task-types";

// Claude refused every LOC engine (stop_reason=refusal, category
// reasoning_extraction) while the shared output contract asked for the
// "actual intermediate work" "step by step". These phrases must not return.
const ENGINES = LOC_ENGINES;

describe("LOC engine prompts avoid reasoning-extraction wording", () => {
  for (const engine of ENGINES) {
    it(`${engine} has no step-by-step intermediate-work request`, () => {
      const prompt = getEngineSystemPrompt(engine);
      expect(prompt).not.toMatch(/actual intermediate work/i);
      expect(prompt).not.toMatch(/executed step by step/i);
      expect(prompt).not.toMatch(/auditable and unfakeable/i);
      expect(prompt).toMatch(/"process": "<MANDATORY — 3-5 sentences written for the client/);
    });
  }
});
