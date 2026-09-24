import type { Spec } from "./opus55-wave";
const H2 = ["## Stage 11 — Proposition Pressure Test", "## Per-Proposition Pressure Blocks", "## Pressure Test Report", "## Cross-Proposition Integrity", "## Final Surviving Proposition Set", "## Self-Audit"];
export const SPECS_D: Spec[] = [{
  id: "11", name: "Integrity Testing", factBound: true,
  cols: "brand_name, category, stage_2_output, stage_8_output, stage_10_output, is_preflight_test",
  build: async (s) => {
    const m = await import("../src/lib/stage11-prompt"); const { countPropositions } = await import("../src/lib/count-helpers");
    return { system: m.STAGE_11_SYSTEM_PROMPT, user: m.buildStage11UserMessage({ brandName: s.brand_name, category: s.category, stage10Output: s.stage_10_output, cmm: s.stage_2_output ?? "", propositionCount: countPropositions(s.stage_8_output ?? s.stage_10_output), isPreflight: s.is_preflight_test === true }), maxTokens: 64000 };
  },
  check: (out, s) => {
    const h2 = out.match(/^## .+$/gm) ?? [];
    const h3 = (out.match(/^### SMP: "/gm) ?? []).length;
    // eslint-disable-next-line
    const { parseStage11Verdicts } = require("../src/lib/stage12-filter");
    const v = parseStage11Verdicts(out);
    const withTags = v.filter((x: any) => x.fatal !== undefined && x.flags !== undefined).length;
    // A parsed block with an empty verdict means the "SMP VERDICT:" line was missing.
    const withVerdict = v.filter((x: any) => typeof x.verdict === "string" && x.verdict.length > 0).length;
    const h2ok = JSON.stringify(h2.map((x) => x.trim())) === JSON.stringify(H2);
    return { pass: h2ok && h3 > 0 && v.length === h3 && withTags === v.length && withVerdict === v.length && out.trimStart().startsWith("## Stage 11"), detail: `h2ok=${h2ok} smpBlocks=${h3} parsedBlocks=${v.length} verdictsRead=${withVerdict} withFatalFlags=${withTags} verdicts=${JSON.stringify(v.map((x: any) => x.verdict))}` };
  },
}];
