import type { Spec } from "./opus55-wave";
const J = "6ab4ea96-7c3a-4e0a-91a9-24b601752b35"; // Jaguar — full Phase 2 session
const nonEmpty = (out: string) => ({ pass: out.trim().length > 400, detail: `chars=${out.trim().length}` });
const p2 = async (prompt: string, withDirective = true) => {
  const { withPhase2Formatting } = await import("../src/lib/phase2-shared");
  const { getObjectiveDirective } = await import("../src/lib/strategic-objective.server");
  return withPhase2Formatting(prompt, withDirective ? await getObjectiveDirective(J, "phase2") : undefined);
};
let _ph: any; const ph = () => (_ph ??= require("../src/lib/phase2-shared"));
export const SPECS_B: Spec[] = [
  { id: "14", name: "Territory Mapping", sessionId: J, cols: "brand_name, category, selected_smp, stage_8_output, stage_13_output, stage_13b_output", factBound: false,
    build: async (s) => { const m = await import("../src/lib/stage14-prompt"); const { trimBrandFitForDownstream } = await import("../src/lib/context-trim"); const { extractBuyerGainForSmp } = await import("../src/lib/buyer-gain");
      return { system: m.STAGE_14_SYSTEM_PROMPT, user: m.buildStage14UserMessage({ brandName: s.brand_name, category: s.category, selectedSMP: s.selected_smp ?? "", buyerGain: extractBuyerGainForSmp(s.stage_8_output, s.selected_smp), stage12Output: "", stage13Output: trimBrandFitForDownstream(s.stage_13_output ?? ""), stage13bOutput: s.stage_13b_output, cmm: "" }), maxTokens: 64000 }; },
    check: nonEmpty },
  { id: "14b", name: "Channel Expression", sessionId: J, cols: "brand_name, selected_smp, stage_13_output, stage_13b_output, stage_14_output", factBound: false,
    build: async (s) => { const m = await import("../src/lib/stage14b-prompt"); const { trimBrandFitForDownstream } = await import("../src/lib/context-trim");
      return { system: m.STAGE_14B_SYSTEM_PROMPT, user: m.buildStage14bUserMessage({ brandName: s.brand_name, selectedSMP: s.selected_smp ?? "", stage12Output: "", stage13Output: trimBrandFitForDownstream(s.stage_13_output ?? ""), stage13bOutput: s.stage_13b_output ?? "", stage14Output: s.stage_14_output ?? "" }), maxTokens: 64000 }; },
    check: nonEmpty },
  { id: "14c", name: "Brand World Definition", sessionId: J, cols: "brand_name, selected_smp, stage_4_output, stage_6_output, stage_7_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output", factBound: false,
    build: async (s) => { const m = await import("../src/lib/stage14c-prompt"); const { trimBrandFitForDownstream } = await import("../src/lib/context-trim");
      return { system: m.STAGE_14C_SYSTEM_PROMPT, user: m.buildStage14cUserMessage({ brandName: s.brand_name, selectedSMP: s.selected_smp ?? "", stage14bOutput: s.stage_14b_output ?? "", stage14Output: s.stage_14_output ?? "", stage7Output: s.stage_7_output ?? "", stage6Output: s.stage_6_output ?? "", stage13Output: trimBrandFitForDownstream(s.stage_13_output ?? ""), stage13bOutput: s.stage_13b_output ?? "", stage4Output: s.stage_4_output ?? "", stage12Output: "" }), maxTokens: 64000 }; },
    check: nonEmpty },
  { id: "15", name: "Coherence Audit", sessionId: J, cols: "*", factBound: false,
    build: async (s) => { const m = await import("../src/lib/stage15-prompt"); const { trimBrandFitForDownstream } = await import("../src/lib/context-trim");
      return { system: m.STAGE_15_SYSTEM_PROMPT, user: m.buildStage15UserMessage({ brandName: s.brand_name, selectedSMP: s.selected_smp ?? "", payload: { "SELECTED SMP": s.selected_smp ?? "", "STAGE 12 — SELECTION RATIONALE (PRIMARY)": s.selection_rationale_1 ?? "", "STAGE 13 — BRAND FIT VERDICT": trimBrandFitForDownstream(s.stage_13_output ?? ""), "STAGE 14 — CREATIVE TERRITORY (FULL)": s.stage_14_output ?? "", "STAGE 14B — TERRITORY DEVELOPMENT (FULL)": s.stage_14b_output ?? "", "STAGE 14C — BRAND WORLD DEFINITION (FULL)": s.stage_14c_output ?? "" } }), maxTokens: 64000 }; },
    check: nonEmpty },
  { id: "16", name: "Valuation / Document Assembly (agency section 1)", sessionId: J, cols: "*", factBound: true,
    build: async (s) => { const m = await import("../src/lib/stage16-sections"); const sec = m.getSectionsForFormat("agency", s as never)[0] as any;
      return { system: sec.systemPrompt, user: m.buildSectionUserMessage(sec, s.brand_name ?? "—", s.category ?? "—"), maxTokens: sec.maxTokens }; },
    check: nonEmpty },
  { id: "17", name: "Detonation Territory", sessionId: J, cols: "*", factBound: false,
    build: async (s) => { const { STAGE_17_DETONATION_TERRITORY_PROMPT: P } = await import("../src/lib/stage17-detonation-territory-prompt"); const { buildStage17UserMessage } = await import("../src/lib/stage17.functions");
      return { system: await p2(P), user: buildStage17UserMessage(s as never), maxTokens: 64000 }; },
    check: (out) => { const n = ph().splitCards(out).length; return { pass: n === 3, detail: `splitCards=${n}/3` }; } },
  { id: "17b", name: "Detonation Intelligence", sessionId: J, cols: "*", factBound: true,
    build: async (s) => { const { STAGE_17B_DETONATION_INTELLIGENCE_PROMPT: P } = await import("../src/lib/stage17b-detonation-intelligence-prompt"); const { buildStage17bUserMessage } = await import("../src/lib/stage17b.functions");
      return { system: await p2(P), user: buildStage17bUserMessage(s as never), maxTokens: 64000 }; },
    check: (out) => { const h = /^\W*CAMPAIGN IDENTIFICATION\b/i.test(out.trim()); return { pass: out.trim().length > 400, detail: `leads-with-CAMPAIGN-IDENTIFICATION=${h}` }; } },
  { id: "18", name: "The Detonation", sessionId: J, cols: "*", factBound: false,
    build: async (s) => { const { STAGE_18_THE_DETONATION_PROMPT: P } = await import("../src/lib/stage18-the-detonation-prompt"); const { buildStage18UserMessage } = await import("../src/lib/stage18.functions");
      return { system: await p2(P), user: buildStage18UserMessage(s as never), maxTokens: 64000 }; },
    check: (out) => { const n = ph().splitCards(out).length; return { pass: n === 3, detail: `splitCards=${n}/3` }; } },
  { id: "19", name: "Activation Architecture", sessionId: J, cols: "*", factBound: false,
    build: async (s) => { const { STAGE_19_ACTIVATION_ARCHITECTURE_PROMPT: P } = await import("../src/lib/stage19-activation-architecture-prompt"); const { buildStage19UserMessage } = await import("../src/lib/stage19.server");
      return { system: await p2(P), user: buildStage19UserMessage(s as never), maxTokens: 64000 }; },
    check: (out) => { const n = ph().extractStage19ChannelEntries(out).length; return { pass: n > 0, detail: `channels=${n}` }; } },
  { id: "20", name: "Master Detonation Brief", sessionId: J, cols: "*", factBound: false,
    build: async (s) => { const { STAGE_20_MASTER_DETONATION_BRIEF_PROMPT: P } = await import("../src/lib/stage20-master-detonation-brief-prompt"); const { buildStage20UserMessage } = await import("../src/lib/stage20.functions");
      return { system: await p2(P), user: buildStage20UserMessage(s as never), maxTokens: 64000 }; },
    check: (out) => { const { parseStage20Output, STAGE_20_SECTION_DEFS } = ph(); const f = new Set(parseStage20Output(out).sections.map((x: any) => x.id)); const miss = STAGE_20_SECTION_DEFS.map((d: any) => d.id).filter((i: string) => !f.has(i)); return { pass: miss.length === 0, detail: `sections=${f.size}/${STAGE_20_SECTION_DEFS.length} missing=${miss.join(",") || "none"}` }; } },
  { id: "20b", name: "Channel Strategy & Audience", sessionId: J, cols: "*", factBound: true,
    build: async (s) => { const { STAGE_20B_CHANNEL_STRATEGY_PROMPT: P } = await import("../src/lib/stage20b-prompt"); const { buildStage20bUserMessage } = await import("../src/lib/stage20b.server");
      const a = s.stage_20b_audience_input ?? { audienceAsHumans: "—", dayInTheirLife: "—", influenceMap: "—", decisionJourney: "—", psychologicalProfile: "—", channelUniverseAndBudget: "—" };
      return { system: await p2(P, false), user: buildStage20bUserMessage(s as never, a), maxTokens: 64000 }; },
    check: (out) => { const n = ph().extractStage20BChannelEntries(out).length; return { pass: n > 0, detail: `channels=${n}` }; } },
  { id: "21", name: "Channel Detonation Brief (first channel)", sessionId: J, cols: "*", factBound: true,
    build: async (s) => { const { STAGE_21_CHANNEL_DETONATION_BRIEFS_PROMPT: P } = await import("../src/lib/stage21-channel-detonation-briefs-prompt"); const { buildStage21UserMessage } = await import("../src/lib/stage21.functions");
      const e = ph().extractStage20BChannelEntries(s.stage_20b_output); const f = (e.length ? e : ph().extractStage19ChannelEntries(s.stage_19_output))[0];
      return { system: await p2(P), user: buildStage21UserMessage(f.name, f.role, f.content, s as never), maxTokens: 64000 }; },
    check: (out, s) => { const { carriesCampaignLine } = require("../src/lib/stage21.functions"); const ok = s.locked_campaign_line ? carriesCampaignLine(out, s.locked_campaign_line) : out.length > 400; return { pass: ok, detail: `carriesLockedLine=${ok}` }; } },
  { id: "22", name: "Brand Architecture (architecture call)", sessionId: J, cols: "*", factBound: true,
    build: async (s) => { const { STAGE_22_BRAND_ARCHITECTURE_PROMPT: P } = await import("../src/lib/stage22-brand-architecture-prompt"); const { buildStage22UserMessage } = await import("../src/lib/stage22.functions");
      return { system: await p2(P, false), user: buildStage22UserMessage(s as never), maxTokens: 64000 }; },
    check: nonEmpty },
];
