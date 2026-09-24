import type { Spec } from "./opus55-wave";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const WS = "bd9cee43-e186-4ac0-8abf-008db47b9d99"; // Nissan Briefing Room
const J = "6ab4ea96-7c3a-4e0a-91a9-24b601752b35";
const DM = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const RUN = "b012e498-9e81-41bf-977e-52eec3114260";
const ws = async (cols = "*") => (await supabaseAdmin.from("briefing_room_workspaces").select(cols).eq("id", WS).single()).data as any;
const jsonObj = (key?: string) => (out: string) => { const a = out.indexOf("{"), b = out.lastIndexOf("}"); try { const p = JSON.parse(out.slice(a, b + 1)); const ok = key ? Array.isArray(p[key]) : true; return { pass: ok, detail: key ? `${key}=${ok ? p[key].length : "missing"}` : "json ok" }; } catch (e: any) { return { pass: false, detail: `JSON fail ${e.message}` }; } };
export const SPECS_C: Spec[] = [
  { id: "br1", name: "Briefing Room — Diagnosis", skipWrapper: true, factBound: true,
    build: async () => { const m = await import("../src/lib/briefing-room-prompts"); const w = await ws(); return { system: m.STEP_1_SYSTEM, user: `${m.buildIntakeBlock({ brandName: w.brand_name, category: w.category, rawBrief: w.raw_brief, evidence: w.supporting_evidence ?? [] })}\n\nProduce the Step 1 diagnostic JSON now.`, maxTokens: 16000 }; },
    check: jsonObj() },
  { id: "br2", name: "Briefing Room — Truth Capture", skipWrapper: true, factBound: true,
    build: async () => { const m = await import("../src/lib/briefing-room-prompts"); const w = await ws(); return { system: m.STEP_2_SYSTEM, user: `${m.buildIntakeBlock({ brandName: w.brand_name, category: w.category, rawBrief: w.raw_brief, evidence: w.supporting_evidence ?? [] })}\n\nProduce the Step 2 truths JSON now.`, maxTokens: 20000 }; },
    check: jsonObj("truths") },
  { id: "br3", name: "Briefing Room — Relevance", skipWrapper: true, factBound: true,
    build: async () => { const m = await import("../src/lib/briefing-room-prompts"); const w = await ws("diagnosis, truths"); return { system: m.STEP_3_SYSTEM, user: `DIAGNOSIS (Step 1):\n${JSON.stringify(w.diagnosis, null, 2)}\n\nTRUTHS (Step 2):\n${JSON.stringify(w.truths.truths, null, 2)}\n\nProduce the Step 3 relevance JSON now.`, maxTokens: 16000 }; },
    check: jsonObj("relevance") },
  { id: "br4", name: "Briefing Room — Tension Collision", skipWrapper: true, factBound: true,
    build: async () => { const m = await import("../src/lib/briefing-room-prompts"); const w = await ws("diagnosis, truths, relevance");
      const idx = new Set(w.relevance.relevance.filter((r: any) => r.verdict === "relevant").map((r: any) => r.truth_index));
      const rel = w.truths.truths.map((t: any, i: number) => ({ ...t, original_index: i })).filter((t: any) => idx.has(t.original_index));
      return { system: m.STEP_4_SYSTEM, user: `DIAGNOSIS (Step 1):\n${JSON.stringify(w.diagnosis, null, 2)}\n\nRELEVANT TRUTHS ONLY (from Step 3 filter — indices below refer to these, not the full Step 2 list):\n${JSON.stringify(rel, null, 2)}\n\nProduce the Step 4 candidate tensions JSON now. Cite indices from the array above via "collided_truth_indices".`, maxTokens: 16000 }; },
    check: jsonObj("candidate_tensions") },
  { id: "br5", name: "Briefing Room — Unified Synthesis", factBound: true, build: async () => ({ system: "", user: "", maxTokens: 0 }),
    direct: async (model) => { const { synthesiseAllFields } = await import("../src/lib/briefing-room.functions"); const w = await ws(); let prebrief = null; const docs: any[] = [];
      for (const ev of w.supporting_evidence ?? []) { if (ev.type === "intelligence_prebrief_json") { try { prebrief = JSON.parse(ev.content); } catch {} } if (ev.type === "intelligence_research_input" && ev.content?.trim()) docs.push({ label: ev.label || "(unlabelled)", content: ev.content }); }
      return JSON.stringify(await synthesiseAllFields({ modelOverride: model, brandName: w.brand_name, category: w.category, rawBrief: w.raw_brief, researchDocs: docs, diagnosis: w.diagnosis, truths: w.truths, relevance: w.relevance, tensions: w.tensions, selectedFrame: w.selected_frame, selectedTensionIndex: w.selected_tension_index, prebrief } as any)); },
    check: (out) => { const p = JSON.parse(out); const k = ["f1_brand","f2_objective","f3_outcome","f4_barrier","f6_audience","f7_current_belief","f8_desired_belief","f9_rtb"]; const miss = k.filter((x) => !String(p[x] ?? "").trim()); return { pass: miss.length === 0, detail: `missing=${miss.join(",") || "none"}` }; } },
  { id: "anchor-gate", name: "Anchor gate", skipWrapper: true, factBound: true,
    build: async () => { const { GATE_SYSTEM_PROMPT } = await import("../src/lib/proposition-anchor.server"); const { REAL_CAPABILITY_REGISTER } = await import("../src/lib/proposition-anchor");
      return { system: GATE_SYSTEM_PROMPT, user: `BRAND: Nissan\nCATEGORY: Automotive\n\nPROPOSITION:\nNissan turns every school run into the safest hour of your child's day.\n\nThe engine supplied no anchor. It was generated in deliberate isolation from brand and capability information, so anchoring must happen now, after the fact.\n\nREAL CAPABILITY EVIDENCE FOR THIS BRAND:\n(none supplied — judge against the platform capability register only)\n\nPLATFORM CAPABILITY REGISTER (real):\n${REAL_CAPABILITY_REGISTER.map((c: string) => `- ${c}`).join("\n")}\n\nDecide whether a real capability defends this exact line. Return JSON only.`, maxTokens: 600 }; },
    check: (out) => { const r = jsonObj()(out); if (!r.pass) return r; const p = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)); return { pass: typeof p.anchored === "boolean", detail: `anchored=${p.anchored} capability="${p.capability}"` }; } },
  { id: "21f", name: "Channel Fidelity Check", sessionId: J, cols: "locked_big_idea, locked_campaign_line, locked_big_idea_lens, stage_21_outputs", factBound: true,
    build: async (s) => { const { FIDELITY_SYSTEM } = await import("../src/lib/stage21-fidelity.server"); const [ch, br] = Object.entries(s.stage_21_outputs ?? {})[0] as [string, string];
      const lead = [`LOCKED CAMPAIGN BIG IDEA (Creative Stimulus sweep, lens: ${s.locked_big_idea_lens ?? "—"})`, (s.locked_big_idea ?? "").trim(), "", "LOCKED CAMPAIGN LINE — every channel brief must carry this line verbatim:", (s.locked_campaign_line ?? "").trim() || "—"].join("\n");
      return { system: FIDELITY_SYSTEM, user: ["THE DECIDED LEAD CREATIVE EXPRESSION — the thing every channel must adapt", lead, "", "————", "", `CHANNEL BRIEF UNDER REVIEW — ${ch}`, br.trim()].join("\n"), maxTokens: 2000 }; },
    check: (out) => { const r = jsonObj()(out); if (!r.pass) return r; const p = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)); return { pass: ["pass","drift","break"].includes(p.verdict), detail: `verdict=${p.verdict} score=${p.score}` }; } },
  { id: "cs-bigidea", name: "Big idea sweep batch", skipWrapper: true, factBound: true,
    build: async () => { const { getLens } = await import("../src/lib/stimulus/lenses"); const m = await import("../src/lib/stimulus/big-idea-prompt");
      const run = (await supabaseAdmin.from("stimulus_runs").select("session_id, smp").eq("id", RUN).single()).data as any;
      const s = (await supabaseAdmin.from("sessions").select("brand_name, category, selected_smp, stage_18_detonation_line, truth_product, truth_consumer, truth_cultural, stage_1_output, stage_2_output").eq("id", run.session_id).single()).data as any;
      const truths = [s.truth_product && `PRODUCT TRUTH: ${s.truth_product}`, s.truth_consumer && `CONSUMER TRUTH: ${s.truth_consumer}`, s.truth_cultural && `CULTURAL TRUTH: ${s.truth_cultural}`].filter(Boolean).join("\n");
      const ev = [s.stage_1_output && `ANCHORED STRATEGIC TENSION (Stage 1)\n${s.stage_1_output}`, s.stage_2_output && `DISCRIMINATORS, THORPE CANDIDATES AND MOTIVATORS (Stage 2)\n${s.stage_2_output}`].filter(Boolean).join("\n\n").slice(0, 14000);
      const lenses = ["human_motivation", "brand_anthem", "living_character"].map((i) => getLens(i)).filter(Boolean) as any[];
      (globalThis as any).__lensIds = lenses.map((l) => l.id);
      return { system: m.BIG_IDEA_SYSTEM_PROMPT, user: m.buildBigIdeaUserMessage({ brandName: s.brand_name ?? "—", category: s.category ?? "—", smp: run.smp || (s.selected_smp ?? "").trim(), detonationLine: (s.stage_18_detonation_line ?? "").trim(), truths, strategicEvidence: ev, lenses, priorTensions: [], creativeGuidance: null } as any), maxTokens: 8000 }; },
    check: (out) => { const { parseBigIdeaResponse } = require("../src/lib/stimulus/big-idea-prompt"); const ids = (globalThis as any).__lensIds as string[]; let got: string[] = []; try { const p = parseBigIdeaResponse(out); got = ids.filter((i) => p?.[i]); } catch {} return { pass: got.length === ids.length, detail: `parsedLenses=${got.length}/${ids.length}` }; } },
  { id: "cs-ledger", name: "Convergence ledger", skipWrapper: true, factBound: true,
    build: async () => { const m = await import("../src/lib/stimulus/convergence-ledger.server");
      const rows = (await supabaseAdmin.from("stimulus_directions").select("lens_id, lens_name, root_tension").eq("run_id", RUN).eq("status", "generated").not("root_tension", "is", null).order("sort_order")).data ?? [];
      const ideas = rows.map((r: any) => ({ lensId: r.lens_id, lensName: r.lens_name, rootTension: (r.root_tension ?? "").trim() })); (globalThis as any).__ideas = ideas;
      return { system: m.LEDGER_SYSTEM_PROMPT, user: m.buildLedgerUserMessage(ideas), maxTokens: 4000 }; },
    check: (out) => { const m = require("../src/lib/stimulus/convergence-ledger.server"); const ideas = (globalThis as any).__ideas; const e = m.parseLedger(out, ideas); const miss = m.missingLedgerIds(ideas, e).length; return { pass: miss === 0 && e.length > 0, detail: `rows=${e.length}/${ideas.length} missing=${miss}` }; } },
  { id: "cs-linecheck", name: "Campaign line check", skipWrapper: true, factBound: true,
    build: async () => { const { LINE_CHECK_SYSTEM } = await import("../src/lib/stimulus/line-check.server");
      const run = (await supabaseAdmin.from("stimulus_runs").select("session_id, smp").eq("id", RUN).single()).data as any;
      const s = (await supabaseAdmin.from("sessions").select("brand_name, category").eq("id", run.session_id).single()).data as any;
      const dirs = (await supabaseAdmin.from("stimulus_directions").select("id, campaign_line").eq("run_id", RUN).eq("status", "generated").not("campaign_line", "is", null).limit(5)).data ?? [];
      return { system: LINE_CHECK_SYSTEM, user: [`BRAND: ${s.brand_name}`, `CATEGORY: ${s.category}`, "", "THE PROPOSITION — VERBATIM. THIS IS THE ONLY STANDARD:", run.smp || "—", "", "LINES TO JUDGE:", ...dirs.map((l: any) => `- id: ${l.id} | line: ${l.campaign_line}`), "", "Return the JSON array only."].join("\n"), maxTokens: 8000 }; },
    check: (out) => { try { const p = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)); const ok = p.every((x: any) => ["on_strategy","drift","generic"].includes(x.verdict)); return { pass: p.length > 0 && ok, detail: `verdicts=${p.map((x: any) => x.verdict).join(",")}` }; } catch (e: any) { return { pass: false, detail: e.message }; } } },
  { id: "cs-channel", name: "Channel adaptation", skipWrapper: true, factBound: true, sessionId: DM, cols: "brand_name, category, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens",
    build: async (s) => { const m = await import("../src/lib/stimulus/channel-adaptation"); const [ch, br] = Object.entries(s.stage_21_outputs ?? {})[0] as [string, string];
      return { system: m.CHANNEL_ADAPTATION_SYSTEM_PROMPT, user: m.buildChannelAdaptationMessage({ brandName: s.brand_name, category: s.category, channelName: ch, channelBrief: br, smp: s.selected_smp ?? "", lockedIdea: s.locked_big_idea ?? "", lockedLine: s.locked_campaign_line ?? "", lockedLens: s.locked_big_idea_lens ?? null } as any), maxTokens: 8000 }; },
    check: (out, s) => { const line = (s.locked_campaign_line ?? "").trim().toLowerCase(); const ok = !line || out.toLowerCase().includes(line.replace(/[.”"]+$/, "")); return { pass: out.trim().length > 300 && ok, detail: `carriesLockedLine=${ok}` }; } },
  { id: "cs-offline", name: "Offline creative brief", skipWrapper: true, factBound: true, sessionId: DM, cols: "brand_name, category, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens, stage_20_output, brand_constraints, brand_tone_of_voice",
    build: async (s) => { const m = await import("../src/lib/stimulus/offline-brief"); const [ch, br] = Object.entries(s.stage_21_outputs ?? {})[0] as [string, string];
      const g = [s.brand_constraints && `Brand constraints:\n${s.brand_constraints}`, s.brand_tone_of_voice && `Tone of voice:\n${s.brand_tone_of_voice}`, s.stage_20_output && `Master detonation brief:\n${s.stage_20_output}`].filter(Boolean).join("\n\n").slice(0, 12000);
      return { system: m.OFFLINE_CREATIVE_BRIEF_SYSTEM_PROMPT, user: m.buildOfflineCreativeBriefMessage({ brandName: s.brand_name, category: s.category, channelName: ch, channelBrief: br, smp: s.selected_smp ?? "", lockedIdea: s.locked_big_idea ?? "", lockedLine: s.locked_campaign_line ?? "", lockedLens: s.locked_big_idea_lens ?? null, whyItWins: "", guardrails: g } as any), maxTokens: 4000 }; },
    check: (out) => ({ pass: out.trim().length > 300, detail: `chars=${out.trim().length}` }) },
];
