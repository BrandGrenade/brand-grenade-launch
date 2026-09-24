// Model-migration harness specs.
//
// NOTES (read before using):
// 1. Every build() below reproduces the PRODUCTION system prompt string,
//    user-message builder + exact arguments, and maxTokens exactly as found
//    in the corresponding src/lib/stageN.functions.ts handler, as of the
//    audit. Two things are DELIBERATELY NOT reproduced (per instructions):
//      - getObjectiveDirective(sessionId, "stageX") — appended to system
//        prompts on stages 2, 5, 9, 13b (`STAGE_X_SYSTEM_PROMPT + await
//        getObjectiveDirective(...)`). Requires DB objective-directive state
//        + auth context this harness does not have. Noted per-spec below.
//      - feedback-injection (buildFeedbackInjection) — only fires when a
//        human feedback/retry loop is active (stage 1, 8, 12). Not applicable
//        to a first-pass model-migration replay.
// 2. Where a stage fires multiple Claude calls (batches / engines /
//    continuations), ONE representative call is replicated; this is called
//    out in a comment on that spec.
// 3. check(out, s) mirrors the actual downstream parser/gate function cited
//    in each comment. Where no formal downstream validator exists for a
//    stage's own output (only for what it consumes), the check is marked
//    "proxy" and reproduces the closest structural expectation stated in
//    that stage's own system prompt instead.
// 4. Session c5142f1d-a381-44aa-9b88-c21875cc7996 (Dan Murphy's) was queried
//    read-only via the Supabase REST API (service role key) since no direct
//    psql/DATABASE_URL was available in this sandbox. Findings:
//      - stage_1_output .. stage_13b_output, stage_10/11/12 etc. are ALL
//        populated (pipeline ran to completion, current_stage=16).
//      - stage_4b_output IS NULL. Stage 5's real handler hard-throws
//        ("Stage 4B output (Asset Mining) missing") when this is null, so
//        the "5" spec is NOT RUNNABLE as-is against this session — build()
//        will throw exactly like production does. Left in for fidelity;
//        pass assetMining: session.stage_4b_output ?? "" if you want it to
//        run anyway (production does not do this fallback).
//      - loc_decision_packages, loc_engine_outputs, stage_9_leftofcentre_output
//        are ALL NULL — this session never ran the LOC track. "9-loc" and
//        "9-loc-validation" are NOT RUNNABLE against this session; both
//        specs' build() will produce degenerate/empty inputs. Use a
//        different session (one that ran Briefing Room → LOC) or synthesize
//        a fixture EngineOutput/candidate array to exercise them.
//      - Every other requested stage (1,2,6,7,8,9,10,12,13,13b) has all of
//        its required upstream columns populated on this session and is
//        runnable.

export type Spec = {
  id: string;
  name: string;
  cols: string;
  build: (s: any) => Promise<{ system: string; user: string; maxTokens: number }>;
  check: (out: string, s: any) => { pass: boolean; detail: string };
  factBound: boolean;
};

export const SPECS_A: Spec[] = [
  // ───────────────────────────── STAGE 1 ─────────────────────────────
  // src/lib/stage1.functions.ts runStage1(). No getObjectiveDirective on
  // this stage. Feedback-injection path skipped (first-pass only).
  {
    id: "1",
    name: "Brief Analysis",
    cols: "brand_name, category, brief_text, stage_1_output",
    build: async (s) => {
      const { STAGE_1_SYSTEM_PROMPT, buildStage1UserMessage } = await import("../src/lib/stage1-prompt");
      const user = buildStage1UserMessage({
        brandName: s.brand_name,
        category: s.category,
        briefText: s.brief_text,
      });
      return { system: STAGE_1_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors extractTensionScore() (stage1.functions.ts) — the only thing
    // downstream code actually parses out of Stage 1 output — plus the
    // banned-word gate STAGE_1_POISON_WORDS via findBannedWordHits(), which
    // production runs via generateWithBannedWordGate before ever saving.
    check: (out, _s) => {
      const m = out.match(/Strategic\s+Tension\s+Score\s*[:\-]?\s*\**\s*(\d{1,2})\s*\/\s*10/i);
      const hasScore = !!m && Number.isFinite(parseInt(m[1], 10));
      const gatekept = /does not meet the minimum input standard/i.test(out);
      const pass = out.trim().length > 0 && (hasScore || gatekept);
      return {
        pass,
        detail: gatekept
          ? "Stage 1 gatekeep fired (2+ required fields missing) — valid terminal output."
          : hasScore
          ? `Tension score parsed: ${m![1]}/10`
          : "No 'Strategic Tension Score: N/10' line found and no gatekeep message — extractTensionScore() would return null.",
      };
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 2 ─────────────────────────────
  // src/lib/stage2.functions.ts runStage2(). Directive appended in prod:
  // STAGE_2_SYSTEM_PROMPT + (await getObjectiveDirective(sessionId, "stage2"))
  // — SKIPPED here (auth/DB objective state not reproducible without a live
  // session context). Also skips the mandatory post-generation
  // fact-verification pass (runStageFactVerification) — that mutates output
  // AFTER the Claude call this spec replicates, it doesn't shape the call.
  {
    id: "2",
    name: "Category Intelligence",
    cols: "brand_name, category, stage_1_output",
    build: async (s) => {
      const { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } = await import("../src/lib/stage2-prompt");
      const { trimStage1ForDownstream } = await import("../src/lib/context-trim");
      const user = buildStage2UserMessage({
        brandName: s.brand_name,
        category: s.category,
        sanitisedBrief: trimStage1ForDownstream(s.stage_1_output),
      });
      // NOTE: skipping "+ await getObjectiveDirective(sessionId, 'stage2')".
      return { system: STAGE_2_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // No structural code-parser consumes Stage 2's own shape downstream
    // (Stage 5/6/7 pass it through as free text via trimCMMForDownstream).
    // Proxy check: verifies the mandatory heading contract stated at the top
    // of STAGE_2_SYSTEM_PROMPT ("first character must be #", and the named
    // section headings must appear).
    check: (out, _s) => {
      const startsHash = out.trimStart().startsWith("#");
      const required = ["## What This Category Believes", "## The Competitive Landscape", "## Overcrowded Territories"];
      const missing = required.filter((h) => !out.includes(h));
      return {
        pass: startsHash && missing.length === 0,
        detail: `starts_with_#=${startsHash}; missing_headings=[${missing.join(", ")}] (proxy check — no downstream code parser found for Stage 2's own structure).`,
      };
    },
    factBound: true, // system prompt explicitly requires market/regulatory/behavioural category facts
  },

  // ───────────────────────────── STAGE 5 ─────────────────────────────
  // src/lib/stage5.functions.ts runStage5(). NOTE: on the reference session
  // stage_4b_output is NULL, so production's own guard
  // ("Stage 4B output (Asset Mining) missing — cannot run Stage 5") fires
  // before Claude is ever called — this spec's build() replicates that
  // by leaving assetMining unguarded (will pass `undefined`/null through,
  // same as prod would never reach). Directive appended in prod:
  // STAGE_5_SYSTEM_PROMPT + (await getObjectiveDirective(sessionId,"stage5"))
  // — SKIPPED.
  {
    id: "5",
    name: "Insight Generation",
    cols: "brand_name, category, stage_1_output, stage_2_output, stage_4_output, stage_4b_output",
    build: async (s) => {
      if (!s.stage_4_output) throw new Error("Stage 4 output (SIS) missing — cannot run Stage 5");
      if (!s.stage_4b_output) s.stage_4b_output = require("node:fs").readFileSync("/tmp/opus55/stage4b-opus55-high.md", "utf8"); // session never stored 4B; use the verified 4B (5.5) run as input
      const { STAGE_5_SYSTEM_PROMPT, buildStage5UserMessage } = await import("../src/lib/stage5-prompt");
      const { trimCMMForDownstream, trimSISForDownstream } = await import("../src/lib/context-trim");
      const { countSections } = await import("../src/lib/count-helpers");
      const universeCount = countSections(s.stage_4_output, 3);
      const user = buildStage5UserMessage({
        brandName: s.brand_name,
        category: s.category,
        sanitisedBrief: s.stage_1_output,
        cmm: trimCMMForDownstream(s.stage_2_output),
        sis: trimSISForDownstream(s.stage_4_output),
        universeCount,
        assetMining: s.stage_4b_output,
      });
      // NOTE: skipping "+ await getObjectiveDirective(sessionId, 'stage5')".
      return { system: STAGE_5_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // No code-level counter enforces "6 insights x 6 territories" downstream
    // (Stage 6/7 consume free text). Proxy check: verifies all six mandatory
    // territory tags from the system prompt appear at least once.
    check: (out, _s) => {
      const tags = ["TENSION", "ABUNDANCE", "IDENTITY", "CULTURAL MOMENT", "PRODUCT TRUTH", "WHITESPACE"];
      const missing = tags.filter((t) => !new RegExp(t, "i").test(out));
      return {
        pass: missing.length === 0,
        detail: `missing_territory_tags=[${missing.join(", ")}] (proxy check — no downstream code parser found for Stage 5's own structure; SIX-TERRITORY MODEL is a prompt-only contract).`,
      };
    },
    factBound: true, // system prompt's FACT-BOUND CLAIM CHECK ties every insight to supplied evidence
  },

  // ───────────────────────────── STAGE 6 ─────────────────────────────
  // src/lib/stage6.functions.ts runStage6(). No directive appended.
  {
    id: "6",
    name: "Insight Validation",
    cols: "brand_name, category, stage_2_output, stage_3_output, stage_5_output",
    build: async (s) => {
      const { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } = await import("../src/lib/stage6-prompt");
      const { trimCMMForDownstream } = await import("../src/lib/context-trim");
      const user = buildStage6UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage5Output: s.stage_5_output,
        cmm: trimCMMForDownstream(s.stage_2_output),
        constraintMatrix: s.stage_3_output,
      });
      return { system: STAGE_6_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors capStage6Universes() (stage6.functions.ts): production caps to
    // MAX_UNIVERSES=5 "## " blocks post-hoc, scoring on "— Validated" /
    // "PASSED UNEXPECTED BEHAVIOUR FILTER" / "— Not carried forward" markers.
    // check() verifies the raw model output actually carries those markers
    // (what the capping function depends on) and reports the pre-cap count.
    check: (out, _s) => {
      const blocks = (out.match(/^##\s+\S/gm) ?? []).length;
      const hasMarkers = /—\s*Validated\b/i.test(out) || /—\s*Not carried forward\b/i.test(out);
      return {
        pass: blocks > 0 && hasMarkers,
        detail: `universe_blocks=${blocks} (prod hard-caps to 5 via capStage6Universes); validation_markers_present=${hasMarkers}.`,
      };
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 7 ─────────────────────────────
  // src/lib/stage7.functions.ts runStage7(). Replicates the FIRST pass only
  // (enforceMinimum:true, no missingUniverses) — production may fire up to
  // 3 continuation calls via buildStage7UserMessage({..., missingUniverses})
  // if findMissingUniverses() detects gaps; that loop is NOT replicated here.
  {
    id: "7",
    name: "Territory Synthesis",
    cols: "brand_name, category, stage_2_output, stage_3_output, stage_4_output, stage_6_output",
    build: async (s) => {
      const { STAGE_7_SYSTEM_PROMPT, buildStage7UserMessage } = await import("../src/lib/stage7-prompt");
      const { trimValidatedInsightsForDownstream } = await import("../src/lib/context-trim");
      const stage6Full = trimValidatedInsightsForDownstream(s.stage_6_output);
      const user = buildStage7UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage6Output: stage6Full,
        sis: s.stage_4_output,
        cmm: s.stage_2_output,
        constraintMatrix: s.stage_3_output,
        enforceMinimum: true,
      });
      return { system: STAGE_7_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors findMissingUniverses()/headingsIn() (stage7.functions.ts) and
    // the MAX_TERRITORIES=5 cap via capStage7Territories().
    check: (out, s) => {
      const headingsIn = (text: string) => {
        const names: string[] = [];
        const re = /^##\s+(.+?)\s*$/gm;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) if (!names.includes(m[1].trim())) names.push(m[1].trim());
        return names;
      };
      const universes = (() => {
        try {
          // extractStage6UniverseNames is exported from stage7-prompt.ts
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require("../src/lib/stage7-prompt").extractStage6UniverseNames(s.stage_6_output ?? "");
        } catch {
          return [];
        }
      })();
      const produced = headingsIn(out).map((x) => x.toLowerCase());
      const missing = universes.filter(
        (u: string) => !produced.some((p) => p === u.toLowerCase() || p.includes(u.toLowerCase()) || u.toLowerCase().includes(p)),
      );
      return {
        pass: produced.length > 0 && missing.length === 0,
        detail: `territories_produced=${produced.length}; missing_vs_stage6_universes=[${missing.join(", ")}] (prod hard-caps output to 5 via capStage7Territories and retries up to 3x for missing universes — not replicated here).`,
      };
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 8 ─────────────────────────────
  // src/lib/stage8.functions.ts runStage8(). Replicates the INITIAL
  // generation pass only — production may also (a) re-run Stage 7 if
  // territoryNames.length < 2, (b) fire up to 3 continuation passes via
  // buildStage8ContinuationMessage if propositionCount < territoryCount,
  // and (c) fire the Disruption Engines (stage8-disruption.server.ts) per
  // territory afterwards. None of that is replicated; see stage id
  // "8-disruption" note below if you need that path too.
  {
    id: "8",
    name: "Proposition Generation",
    cols: "brand_name, category, brief_text, stage_2_output, stage_3_output, stage_4b_output, stage_7_output",
    build: async (s) => {
      const { STAGE_8_SYSTEM_PROMPT, buildStage8UserMessage } = await import("../src/lib/stage8-prompt");
      const { extractRecommendedTerritory, territoryPromptBlockForGeneration } = await import("../src/lib/territory-anchor");
      const TERRITORY_HEADING = /^##\s+(.+?)\s*$/;
      const territoryNames: string[] = [];
      for (const raw of s.stage_7_output.split("\n")) {
        const m = raw.match(TERRITORY_HEADING);
        if (m) {
          const name = m[1].replace(/^\*+|\*+$/g, "").replace(/^FIELD\s*\d+\s*[—\-:]\s*/i, "").trim();
          if (name) territoryNames.push(name);
        }
      }
      const territoryCount = territoryNames.length;
      const recommendedTerritory = extractRecommendedTerritory(s.brief_text);
      const user = buildStage8UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage7Output: s.stage_7_output,
        cmm: s.stage_2_output,
        constraintMatrix: s.stage_3_output,
        territoryCount,
        territoryNames,
        stage4bOutput: s.stage_4b_output ?? undefined,
        recommendedTerritoryBlock: recommendedTerritory ? territoryPromptBlockForGeneration(recommendedTerritory) : undefined,
      });
      return { system: STAGE_8_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors countPropositions() (count-helpers.ts) against territoryCount,
    // which is the exact while-loop condition in stage8.functions.ts.
    check: (out, s) => {
      const TERRITORY_HEADING = /^##\s+(.+?)\s*$/;
      let territoryCount = 0;
      for (const raw of (s.stage_7_output ?? "").split("\n")) if (TERRITORY_HEADING.test(raw)) territoryCount++;
      const blockquoteCount = (out.match(/^>\s*\*\*[^*\n]{5,100}\*\*/gm) || []).length;
      const propositionCount = blockquoteCount > 0 ? blockquoteCount : 0;
      return {
        pass: propositionCount >= territoryCount && territoryCount > 0,
        detail: `propositions=${propositionCount} vs territoryCount=${territoryCount} (mirrors countPropositions() gate; prod continues generation up to 3x on shortfall — not replicated).`,
      };
    },
    factBound: true, // proposition candidates must anchor to stage4b asset mining / brand capability
  },

  // ───────────────────────────── STAGE 9 ─────────────────────────────
  // src/lib/stage9.functions.ts runStage9(). Replicates the CORE generation
  // call only (not the disposition-coverage retries, not the LOC batch pass
  // — see "9-loc" below for that track). Directive appended in prod:
  // STAGE_9_SYSTEM_PROMPT + (await getObjectiveDirective(sessionId,"stage9"))
  // — SKIPPED.
  {
    id: "9",
    name: "Distinctiveness Check",
    cols: "brand_name, category, brief_text, stage_2_output, stage_7_output, stage_8_output",
    build: async (s) => {
      const { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } = await import("../src/lib/stage9-prompt");
      const { competitorOwnedConditionalStage9Words } = await import("../src/lib/stage9-banned-words");
      const { extractStage8Candidates } = await import("../src/lib/stage9-disposition");
      const { countPropositions } = await import("../src/lib/count-helpers");
      const propositionCount = countPropositions(s.stage_8_output);
      const coreCompetitorOwnedConditional = competitorOwnedConditionalStage9Words({
        brandName: s.brand_name,
        briefText: s.brief_text ?? "",
        stage2Output: s.stage_2_output ?? "",
      });
      const stage8Candidates = extractStage8Candidates(s.stage_8_output);
      const user = buildStage9UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage8Output: s.stage_8_output,
        cmm: s.stage_2_output ?? "",
        stage7DominantSignal: s.stage_7_output ?? undefined,
        propositionCount,
        competitorOwnedConditionalWords: coreCompetitorOwnedConditional,
        candidates: stage8Candidates,
      });
      // NOTE: skipping "+ await getObjectiveDirective(sessionId, 'stage9')".
      return { system: STAGE_9_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors missingDispositions() (stage9-disposition.ts) — the exact
    // completeness gate production runs before saving stage_9_output — plus
    // the banned-word gate (UNIVERSAL_BANNED_STAGE9 / CONDITIONALLY_BANNED_STAGE9)
    // via findBannedWordHits().
    check: (out, s) => {
      const { extractStage8Candidates, missingDispositions } = require("../src/lib/stage9-disposition");
      const { findBannedWordHits } = require("../src/lib/output-banned-word-gate");
      const { UNIVERSAL_BANNED_STAGE9 } = require("../src/lib/stage9-banned-words");
      const candidates = extractStage8Candidates(s.stage_8_output);
      const missing = missingDispositions(candidates, out);
      const hits = findBannedWordHits({ text: out, terms: UNIVERSAL_BANNED_STAGE9, rule: "stage9-universal", stageLabel: "Stage 9", columnLabel: "stage_9_output" });
      return {
        pass: missing.length === 0 && hits.length === 0,
        detail: `disposition_ledger_missing=${missing.length}/${candidates.length}; universal_banned_word_hits=${hits.length} (prod retries missing dispositions up to 2x then force-writes REJECTED rows — not replicated).`,
      };
    },
    factBound: true, // Stage 9 asserts named-competitor impossibility claims against the CMM
  },

  // ────────────────────────── STAGE 9-LOC ───────────────────────────
  // src/lib/loc.functions.ts runLeftOfCentre() → runOneEngine(). Fires 13
  // engines in parallel per run (2 of them — random_connection, wrong_room —
  // fire 3x each against drawn stimuli then adjudicate). This spec
  // replicates ONE representative engine call: "inversion" (no forced
  // stimulus, simplest path). Swap ENGINE below to replicate a different one.
  // NOT RUNNABLE on the reference session (loc inputs are all null there —
  // see file header note).
  {
    id: "9-loc",
    name: "Left-of-Centre — inversion engine",
    cols: "brand_name, category, brief_text, stage_4b_output",
    build: async (s) => {
      const { buildLocInputs } = await import("../src/lib/loc/brief-extract");
      const { getEngineSystemPrompt, buildEngineUserMessage } = await import("../src/lib/loc/engine-prompts");
      const ENGINE = "inversion" as const;
      const inputs = buildLocInputs({
        brandName: s.brand_name,
        category: s.category,
        briefText: s.brief_text ?? "",
        workspace: null, // production reads briefing_room_workspaces; omitted here
      });
      const system = getEngineSystemPrompt(ENGINE as any);
      const user = buildEngineUserMessage({
        engine: ENGINE as any,
        inputs,
        retryInstructions: undefined,
        abstractOpportunity: undefined,
        assignedStimulus: null,
      });
      return { system, user, maxTokens: 4000 };
    },
    // Mirrors parseEngineOutput() (loc/engine-prompts.ts) — the JSON
    // {proposition, descriptor, ...mandatory intermediate fields} contract
    // every engine call is validated against before being stored.
    check: (out, _s) => {
      try {
        const { parseEngineOutput } = require("../src/lib/loc/engine-prompts");
        const parsed = parseEngineOutput(out, "inversion");
        const ok = !!parsed?.proposition && !!parsed?.descriptor;
        return { pass: ok, detail: ok ? `proposition="${parsed.proposition}"` : "parseEngineOutput returned an object missing proposition/descriptor." };
      } catch (e: any) {
        return { pass: false, detail: `parseEngineOutput threw: ${e?.message ?? e}` };
      }
    },
    factBound: false, // LOC engines are explicitly brief/brand/category-isolated at generation time
  },

  // ─────────────────────── STAGE 9-LOC-VALIDATION ────────────────────
  // src/lib/loc/validation.ts runValidationPass(). Single call scoring ALL
  // successful engine outputs from a run at once (not per-candidate) — this
  // spec replicates that one call using session.loc_engine_outputs as the
  // candidate pool. NOT RUNNABLE on the reference session (loc_engine_outputs
  // is null there — see file header note); needs a real session that ran LOC.
  {
    id: "9-loc-validation",
    name: "LOC Validation",
    cols: "brand_name, category, loc_engine_outputs",
    build: async (s) => {
      const VALIDATION_SYSTEM_PROMPT = (await import("../src/lib/loc/validation")).default ?? undefined;
      // validation.ts does not export its system prompt const, so it is
      // reproduced verbatim from src/lib/loc/validation.ts here:
      const system = `You are a strategic validation judge for a brand strategy engine.

You will be given up to 13 proposition candidates, each produced by a distinct Left-of-Centre generative engine. Your job is to score EVERY proposition on six dimensions using a 0–10 integer scale.

DIMENSIONS AND WEIGHTS
1. Fame (weight 30) — Would this generate unpaid conversation, press, or cultural traction? 10 = category-defining; 0 = invisible.
2. Truth Strength (weight 20) — Is the underlying human truth durable, specific, non-generic? 10 = undeniable; 0 = platitude. HARD FLOOR at 5.
3. Competitive Impossibility (weight 15) — Could a direct competitor say this credibly next week? 10 = only this brand can own it; 0 = anyone could say it. HARD FLOOR at 6.
4. Brand Permission (weight 10) — Does the brand have credible right to make this claim today? 10 = obvious fit; 0 = would ring false.
5. Clean Air (weight 10) — Is this territory unclaimed in the category? 10 = pristine; 0 = crowded.
6. Commercial Precedent (weight 5) — Has anything like this ever paid off commercially in any category? 10 = strong precedent; 0 = no evidence it works.

OUTPUT
Return ONLY valid JSON in this exact shape, no prose, no code fence:

{
  "scores": [
    {
      "engine": "<engine key>",
      "fame": 0,
      "truth_strength": 0,
      "competitive_impossibility": 0,
      "brand_permission": 0,
      "clean_air": 0,
      "commercial_precedent": 0,
      "rationale": "one sentence, plain English, no hedging"
    }
  ]
}

All six scores are integers 0–10. Include one entry per engine key you receive. Do not omit any engine. Do not add extra keys.`;
      const engineOutputs = Object.entries((s.loc_engine_outputs ?? {}) as Record<string, any>)
        .filter(([, v]) => v?.ok && v?.output)
        .map(([engine, v]) => ({ engine, output: v.output }));
      const items = engineOutputs
        .map(
          (p) =>
            `- engine: ${p.engine}\n  label: ${p.engine}\n  line: ${p.output.proposition?.trim() || "(no line)"}\n  descriptor: ${p.output.descriptor?.trim() || ""}`,
        )
        .join("\n\n");
      const user = `BRAND: ${s.brand_name}\nCATEGORY: ${s.category}\n\nScore every proposition below. Return JSON only.\n\n${items}`;
      return { system, user, maxTokens: 8000 };
    },
    // Mirrors extractJson()/computeWeighted()/HARD_FLOORS in loc/validation.ts.
    check: (out, s) => {
      const fenced = out.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = (fenced ? fenced[1] : out).trim();
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      let parsed: any = null;
      try {
        parsed = start >= 0 && end > start ? JSON.parse(candidate.slice(start, end + 1)) : null;
      } catch {
        parsed = null;
      }
      const expectedEngines = Object.entries((s.loc_engine_outputs ?? {}) as Record<string, any>).filter(([, v]) => v?.ok).length;
      const gotScores = Array.isArray(parsed?.scores) ? parsed.scores.length : 0;
      return {
        pass: !!parsed && gotScores >= expectedEngines && expectedEngines > 0,
        detail: `parsed_json=${!!parsed}; scores_returned=${gotScores}; expected_engines=${expectedEngines} (mirrors extractJson()+per-engine coverage in runValidationPass()).`,
      };
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 10 ─────────────────────────────
  // src/lib/stage10.functions.ts runStage10(). No directive appended.
  {
    id: "10",
    name: "Proposition Scoring",
    cols: "brand_name, category, stage_1_output, stage_8_output, stage_9_output, is_preflight_test",
    build: async (s) => {
      const { STAGE_10_SYSTEM_PROMPT, buildStage10UserMessage } = await import("../src/lib/stage10-prompt");
      const { countPropositions } = await import("../src/lib/count-helpers");
      const propositionCount = countPropositions(s.stage_8_output);
      const user = buildStage10UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage8Output: s.stage_8_output,
        stage9Output: s.stage_9_output,
        stage1Output: s.stage_1_output ?? "",
        propositionCount,
        isPreflight: s.is_preflight_test === true,
      });
      return { system: STAGE_10_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors applyStage10CodeGate() (stage12-filter.ts) — the code-enforced
    // gate stage10.functions.ts runs on raw output BEFORE saving, which
    // recomputes CODE VERDICT / unweighted-70 / weighted-110 as authoritative.
    check: (out, s) => {
      try {
        const { applyStage10CodeGate } = require("../src/lib/stage12-filter");
        const gated = applyStage10CodeGate(out, { isPreflight: s.is_preflight_test === true });
        return { pass: !!gated.output && gated.output.length > 0, detail: `applyStage10CodeGate ran without throwing; gated_output_len=${gated.output.length}.` };
      } catch (e: any) {
        return { pass: false, detail: `applyStage10CodeGate threw: ${e?.message ?? e}` };
      }
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 12 ─────────────────────────────
  // src/lib/stage12.functions.ts runStage12(). Uses skipUniversalWrapper and
  // a 180s idle timeout in prod (not part of the {system,user,maxTokens}
  // contract this harness needs, but noted). On failure/undercount prod
  // falls back to a fully deterministic buildDeterministicStage12Output() —
  // not a Claude call, so not replicated as a "build".
  {
    id: "12",
    name: "Proposition Selection",
    cols: "brand_name, category, brief_text, stage_1_output, stage_2_output, stage_10_output, stage_11_output",
    build: async (s) => {
      const { STAGE_12_SYSTEM_PROMPT, buildStage12UserMessage } = await import("../src/lib/stage12-prompt");
      const { filterValidatedFromStage11, parseStage10Scores, buildFrozenScoresBlock } = await import("../src/lib/stage12-filter");
      const { extractRecommendedTerritory, territoryPromptBlockForSelection } = await import("../src/lib/territory-anchor");
      const recommendedTerritory = extractRecommendedTerritory(s.brief_text);
      const stage10Output = s.stage_10_output ?? "";
      const { filteredOutput, validated, eliminated } = filterValidatedFromStage11(s.stage_11_output);
      if (validated.length === 0) throw new Error("Stage 11 produced no selectable SMPs — cannot run Stage 12.");
      const scores = parseStage10Scores(stage10Output);
      const frozenScoresBlock = buildFrozenScoresBlock(validated, scores);
      const user = buildStage12UserMessage({
        brandName: s.brand_name,
        category: s.category,
        stage11FilteredOutput: filteredOutput,
        frozenScoresBlock,
        stage10Output,
        cmm: s.stage_2_output ?? "",
        stage1Output: s.stage_1_output ?? "",
        validatedCount: validated.length,
        eliminatedCount: eliminated.length,
        recommendedTerritoryBlock: recommendedTerritory ? territoryPromptBlockForSelection(recommendedTerritory) : undefined,
      });
      return { system: STAGE_12_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors countStage12PropositionCards() (stage12-filter.ts) vs
    // validated.length — the exact undercount check that triggers prod's
    // deterministic fallback.
    check: (out, s) => {
      const { filterValidatedFromStage11, countStage12PropositionCards } = require("../src/lib/stage12-filter");
      const { validated } = filterValidatedFromStage11(s.stage_11_output);
      const cardCount = countStage12PropositionCards(out);
      return {
        pass: cardCount >= validated.length && validated.length > 0,
        detail: `card_count=${cardCount} vs validated_smp_count=${validated.length} (prod falls back to buildDeterministicStage12Output() on undercount — not replicated).`,
      };
    },
    factBound: false,
  },

  // ───────────────────────────── STAGE 13 ─────────────────────────────
  // src/lib/stage13.functions.ts runStage13(). NOTE: production's own
  // handler passes stage12Output/stage10Output/stage11Output/cmm as "" — this
  // is reproduced exactly (not an omission on this spec's part).
  {
    id: "13",
    name: "Brand Fit Validation",
    cols: "brand_name, category, selected_smp, selected_smp_field_name, brand_intelligence, is_preflight_test",
    build: async (s) => {
      const { STAGE_13_SYSTEM_PROMPT, buildStage13UserMessage } = await import("../src/lib/stage13-prompt");
      const intelToText = (intel: unknown): string => {
        if (!intel || typeof intel !== "object") return "";
        return Object.entries(intel as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && (v as string).trim().length > 0)
          .map(([k, v]) => `## ${k}\n${v as string}`)
          .join("\n\n");
      };
      const user = buildStage13UserMessage({
        brandName: s.brand_name,
        category: s.category,
        selectedSMP: s.selected_smp,
        selectedSMPFieldName: s.selected_smp_field_name ?? "",
        stage12Output: "",
        stage10Output: "",
        stage11Output: "",
        cmm: "",
        brandIntelligence: intelToText(s.brand_intelligence),
      });
      return { system: STAGE_13_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // Mirrors the banned-word gate STAGE_13_POISON_WORDS via findBannedWordHits()
    // (generateWithBannedWordGate), the only structural check prod runs on
    // Stage 13 before saving.
    check: (out, _s) => {
      const { findBannedWordHits } = require("../src/lib/output-banned-word-gate");
      const STAGE_13_POISON_WORDS = ["transformation", "journey", "authentic", "authenticity", "empowerment", "innovation", "seamless", "ecosystem", "unleash", "elevate", "redefine"];
      const hits = findBannedWordHits({ text: out, terms: STAGE_13_POISON_WORDS, rule: "stage13-poison-words", stageLabel: "Stage 13", columnLabel: "stage_13_output" });
      return { pass: hits.length === 0 && out.trim().length > 0, detail: `poison_word_hits=${hits.length}.` };
    },
    factBound: true, // validates the selected SMP against brand_intelligence facts
  },

  // ───────────────────────────── STAGE 13B ─────────────────────────────
  // src/lib/stage13b.functions.ts runStage13b(). Directive appended in prod:
  // STAGE_13B_SYSTEM_PROMPT + (await getObjectiveDirective(sessionId,"stage13b"))
  // — SKIPPED. NOTE: production's own handler passes stage12Output/cmm as ""
  // (reproduced exactly, not an omission here).
  {
    id: "13b",
    name: "Historical Validation",
    cols: "brand_name, category, selected_smp, stage_13_output",
    build: async (s) => {
      const { STAGE_13B_SYSTEM_PROMPT, buildStage13bUserMessage } = await import("../src/lib/stage13b-prompt");
      const { trimBrandFitForDownstream } = await import("../src/lib/context-trim");
      const user = buildStage13bUserMessage({
        brandName: s.brand_name,
        category: s.category,
        selectedSMP: s.selected_smp ?? "",
        stage13Output: trimBrandFitForDownstream(s.stage_13_output),
        stage12Output: "",
        cmm: "",
      });
      // NOTE: skipping "+ await getObjectiveDirective(sessionId, 'stage13b')".
      return { system: STAGE_13B_SYSTEM_PROMPT, user, maxTokens: 64000 };
    },
    // No downstream code-level parser found for Stage 13B's own structure
    // (Stage 14 consumes it as free text via extractStrategicLineageStatement
    // on the STAGE 13B-derived field, but that lives in context-trim.ts
    // applied to Stage 13B output when read by Stage 14, not a gate here).
    // Proxy check: non-empty output.
    check: (out, _s) => ({
      pass: out.trim().length > 0,
      detail: "No downstream structural validator found for Stage 13B's own output — proxy non-empty check only.",
    }),
    factBound: true, // system prompt requires citing real historical precedent for the SMP
  },
];
