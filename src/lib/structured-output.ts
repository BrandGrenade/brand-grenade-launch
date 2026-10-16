// F1d — structured records for Stages 9, 10, 11 and 13.
// The model appends one fenced data block to its normal answer in the SAME call.
// The block is split off before the text is saved (text saved exactly as before),
// validated here, and stored in stage_N_structured. Failures never block the text:
// they are recorded in stage_N_structured_error.
import { z } from "zod";
import { computeWeightedComposite, evaluateStage10Verdict } from "./stage12-filter";

export const STRUCTURED_OPEN = "<<<STRUCTURED_JSON";
export const STRUCTURED_CLOSE = ">>>";

export type StructuredStage = "9" | "10" | "11" | "13";

// ── Splitting ────────────────────────────────────────────────────────────
export function splitStructured(raw: string): { text: string; block: string | null } {
  const idx = raw.indexOf(STRUCTURED_OPEN);
  if (idx < 0) return { text: raw, block: null };
  const rest = raw.slice(idx + STRUCTURED_OPEN.length);
  const end = rest.lastIndexOf(STRUCTURED_CLOSE);
  const block = (end >= 0 ? rest.slice(0, end) : rest).trim();
  return { text: raw.slice(0, idx).replace(/\s+$/, ""), block };
}

/** Wraps a text-delta stream: forwards only the text before the data block and
 *  captures the block into `sink.raw` so it never reaches the screen or the saved text. */
export async function* filterStructuredStream(
  src: AsyncIterable<string>,
  sink: { raw: string },
): AsyncGenerator<string> {
  let buf = "";
  let inBlock = false;
  for await (const delta of src) {
    sink.raw += delta;
    if (inBlock) continue;
    buf += delta;
    const idx = buf.indexOf(STRUCTURED_OPEN);
    if (idx >= 0) {
      inBlock = true;
      const before = buf.slice(0, idx).replace(/\s+$/, "");
      if (before) yield before;
      buf = "";
      continue;
    }
    // Hold back any tail that could be the start of the marker (and trailing whitespace before it).
    let hold = 0;
    for (let n = Math.min(STRUCTURED_OPEN.length - 1, buf.length); n > 0; n--) {
      if (STRUCTURED_OPEN.startsWith(buf.slice(buf.length - n))) { hold = n; break; }
    }
    let cut = buf.length - hold;
    while (cut > 0 && /\s/.test(buf[cut - 1])) cut--;
    if (cut > 0) {
      yield buf.slice(0, cut);
      buf = buf.slice(cut);
    }
  }
  if (!inBlock && buf) yield buf;
}

function parseJson(block: string | null): unknown {
  if (!block) throw new Error("No structured data block returned");
  const cleaned = block.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Structured block is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const str = z.string().min(1);
const score = z.number().int().min(1).max(10);
const dim = z.object({ score, justification: str });

// ── Stage 9 ──────────────────────────────────────────────────────────────
export const Stage9Schema = z.object({
  propositions: z.array(z.object({
    id: str, smp: str, field_name: z.string(),
    foundation: z.object({ territory: str, truth: str, reinterpretation: str }),
    impossibility: z.array(z.object({ competitor: str, why_they_cannot: str })),
    creative_territory: str,
    creative_function: z.object({ class: z.enum(["SELF-EXECUTING", "PLATFORM"]), rationale: str }),
  })),
  ranking: z.array(z.object({ id: str, rank: z.number().int().min(1), rationale: str })),
  recommended: z.array(str).min(1).max(2),
});

// ── Stage 10 ─────────────────────────────────────────────────────────────
const Stage10Row = z.object({
  smp: str, field_name: z.string(),
  fame: dim, truth_strength: dim,
  competitive_impossibility: dim.extend({ competitor: z.string().nullable(), competitor_claim: z.string().nullable() }),
  brand_permission: dim.extend({ evidence: z.string().nullable() }),
  clean_air: dim.extend({ occupier: z.string().nullable(), occupying_claim: z.string().nullable() }),
  commercial_precedent: dim.extend({
    precedents: z.array(z.object({ brand: str, campaign: str, year: z.number().int().min(1800).max(2100) })),
  }),
});
export type Stage10Row = z.infer<typeof Stage10Row>;
export const Stage10Schema = z.object({
  smps_scored: z.number().int().min(0),
  selection_rule: z.string(),
  scores: z.array(Stage10Row),
  current_position: Stage10Row.nullable().optional(),
});

// ── Stage 11 ─────────────────────────────────────────────────────────────
const result = z.enum(["HOLDS", "WOBBLES", "CRACKS"]);
const test = z.object({ result, rationale: str });
const STAGE11_VERDICTS = ["VALIDATED", "VALIDATED — EXPOSED", "VALIDATED WITH STRATEGIC NOTE", "REWRITTEN", "ELIMINATED"] as const;
const Stage11Block = z.object({
    smp: str, field_name: z.string(), iconic_tier: z.boolean(),
    tests: z.object({
      T1: test, T2: test, T3: test, T4: test,
      T5: test.extend({ counter_line: z.string(), classification: z.enum(["EXPOSES-UNTRUTH", "COMPETES-FOR-TERRITORY", "UNCERTAIN"]) }),
      T6: test,
      T7: test.extend({ misreading: z.string(), guard_rail: z.string() }),
      T8: z.object({ result: z.enum(["HOLDS", "WOBBLES", "CRACKS", "N/A"]), rationale: z.string().nullable() }),
    }),
    verdict: z.enum(STAGE11_VERDICTS),
    fatal: z.array(z.string()), flags: z.array(z.string()),
    exposure_note: z.string().nullable(), strategic_note: z.string().nullable(),
    rewrite: z.object({ line: str, reason: str }).nullable(),
    iconic_final: z.enum(["CONFIRMED", "DOWNGRADED", "N/A"]),
});
export const Stage11Schema = z.object({
  blocks: z.array(Stage11Block),
  current_position: Stage11Block.nullable().optional(),
  surviving_set: z.array(z.string()),
  exposed_count: z.number().int().min(0),
  divergence_preserved: z.boolean(),
});

// ── Stage 13 ─────────────────────────────────────────────────────────────
const CRED = ["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"] as const;
const FORCING_TRIGGERS = ["behavioural_capacity", "tonal_compatibility", "product_truth_alignment", "historical_consistency"] as const;
export const Stage13Schema = z.object({
  verdict: z.enum(["CONFIRMED — PROCEED", "CONFIRMED WITH ADJUSTMENTS — PROCEED", "HUMAN REVIEW REQUIRED", "RETURN TO STAGE 12 — RESELECT SMP"]),
  verdict_reason: str,
  credibility: z.object(Object.fromEntries(CRED.map((k) => [k, dim])) as Record<(typeof CRED)[number], typeof dim>),
  most_vulnerable: z.enum(CRED),
  forcing_test: z.object({ triggered: z.boolean(), verdict: z.enum(["FORCING PROPOSITION", "GENUINE MISMATCH"]), path_or_reason: str }).nullable(),
  ownership: z.object({ own: str, behave: str, sustain: str }),
  adjustments: z.array(z.object({ what: str, why: str, downstream: z.string() })),
  section5: z.object({
    mode: z.enum(["GUARDRAILS", "OPERATIONAL_REQUIREMENTS"]),
    items: z.array(z.object({ text: str, dimension: z.string().nullable(), horizon: z.string().nullable() })),
  }),
  commitments: z.array(str),
  current_position: z.object({
    credibility: z.object(Object.fromEntries(CRED.map((k) => [k, dim])) as Record<(typeof CRED)[number], typeof dim>),
    most_vulnerable: z.enum(CRED),
  }).nullable().optional(),
});

// ── Code checks ──────────────────────────────────────────────────────────
function zodMsg(e: z.ZodError): string {
  return e.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

export type CurrentPropositionSource =
  | { kind: "client"; line: string; source: string | null; date: string | null }
  | { kind: "stored"; line: string; source: string }
  | { kind: "none" };

/** Order: brief entry (Client-supplied) → stored brand positioning (Unverified) → none. */
export function resolveCurrentProposition(s: {
  current_proposition?: string | null;
  current_proposition_source?: string | null;
  current_proposition_date?: string | null;
  brand_positioning?: string | null;
}): CurrentPropositionSource {
  const own = s.current_proposition?.trim();
  if (own) return { kind: "client", line: own, source: s.current_proposition_source?.trim() || null, date: s.current_proposition_date ?? null };
  const stored = s.brand_positioning?.trim();
  // Only a single line the brand uses publicly qualifies.
  if (stored && !stored.includes("\n") && stored.length <= 200) {
    return { kind: "stored", line: stored, source: "Stored brand positioning on this run (Briefing Room / Intelligence Lab)" };
  }
  return { kind: "none" };
}

export type ValidationOutcome = { structured: Record<string, unknown> | null; error: string | null };

function enrichRow(r: Stage10Row, preflight: boolean) {
  const dims = {
    fame: r.fame.score, truthStrength: r.truth_strength.score,
    competitiveImpossibility: r.competitive_impossibility.score, brandPermission: r.brand_permission.score,
    cleanAir: r.clean_air.score, commercialPrecedent: r.commercial_precedent.score,
  };
  const v = evaluateStage10Verdict(dims);
  return { ...r, composite: computeWeightedComposite(dims), code_verdict: preflight ? "PASS" : v.verdict, code_verdict_reason: preflight ? "" : v.reason };
}

/** Shared T1 current-position envelope for Stages 11 and 13 (same label rules as Stage 10). */
function currentEnvelope(stage: "11" | "13", cur: CurrentPropositionSource, payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (cur.kind === "none") {
    return { status: "not_scored", is_current: true, excluded_from_selection: true, reason: "No current proposition supplied on the brief and no stored brand positioning — not scored." };
  }
  if (!payload) {
    return { status: "not_scored", is_current: true, excluded_from_selection: true, line: cur.line, reason: `Current proposition was supplied but the Stage ${stage} call returned no ${stage === "11" ? "test block" : "credibility scores"} for it.` };
  }
  return {
    status: "scored",
    line: cur.line,
    evidence_label: cur.kind === "client" ? "Client-supplied" : "Unverified",
    source: cur.source,
    source_date: cur.kind === "client" ? cur.date : null,
    is_current: true,
    excluded_from_selection: true,
    ...payload,
  };
}

const DIM_KEYS = ["fame", "truth_strength", "competitive_impossibility", "brand_permission", "clean_air", "commercial_precedent"] as const;

export function validateStructured(
  stage: StructuredStage,
  block: string | null,
  ctx: {
    expectedCount?: number;
    cmmCompetitors?: string[];
    current?: CurrentPropositionSource;
    isPreflight?: boolean;
    stage10Eliminated?: string[];
  } = {},
): ValidationOutcome {
  let json: unknown;
  try {
    json = parseJson(block);
  } catch (e) {
    return { structured: null, error: e instanceof Error ? e.message : String(e) };
  }
  const problems: string[] = [];
  if (stage === "9") {
    const p = Stage9Schema.safeParse(json);
    if (!p.success) return { structured: null, error: zodMsg(p.error) };
    const d = p.data;
    if (d.propositions.length < 5 || d.propositions.length > 7) problems.push(`expected 5–7 propositions, got ${d.propositions.length}`);
    const ranks = d.ranking.map((r) => r.rank).sort((a, b) => a - b);
    if (ranks.some((r, i) => r !== i + 1)) problems.push("ranks are not unique 1..n");
    for (const c of ctx.cmmCompetitors ?? []) {
      for (const pr of d.propositions) {
        if (!pr.impossibility.some((i) => i.competitor.toLowerCase().includes(c.toLowerCase()))) {
          problems.push(`${pr.id} impossibility list missing competitor ${c}`);
        }
      }
    }
    return problems.length ? { structured: null, error: problems.join("; ") } : { structured: d, error: null };
  }
  if (stage === "10") {
    const p = Stage10Schema.safeParse(json);
    if (!p.success) return { structured: null, error: zodMsg(p.error) };
    const d = p.data;
    if (d.smps_scored !== d.scores.length) problems.push(`smps_scored ${d.smps_scored} ≠ ${d.scores.length} score rows`);
    if (ctx.expectedCount != null && d.scores.length !== ctx.expectedCount) problems.push(`expected ${ctx.expectedCount} propositions, got ${d.scores.length}`);
    for (const r of d.scores) {
      if (r.competitive_impossibility.score < 10 && !r.competitive_impossibility.competitor) problems.push(`${r.smp}: Competitive Impossibility below 10 needs a named competitor`);
      if (r.clean_air.score < 8 && !r.clean_air.occupier) problems.push(`${r.smp}: Clean Air below 8 needs a named occupier`);
    }
    if (problems.length) return { structured: null, error: problems.join("; ") };
    const cur = ctx.current ?? { kind: "none" as const };
    let current_position: Record<string, unknown>;
    if (cur.kind === "none") {
      current_position = { status: "not_scored", reason: "No current proposition supplied on the brief and no stored brand positioning — not scored." };
    } else if (!d.current_position) {
      current_position = { status: "missing", reason: "Current proposition was supplied but the scoring call returned no score for it." };
    } else {
      const row = enrichRow(d.current_position, false);
      const best = d.scores.map((r) => enrichRow(r, !!ctx.isPreflight)).sort((a, b) => b.composite - a.composite).slice(0, 3);
      current_position = {
        status: "scored",
        line: cur.line,
        evidence_label: cur.kind === "client" ? "Client-supplied" : "Unverified",
        source: cur.source,
        source_date: cur.kind === "client" ? cur.date : null,
        is_current: true,
        excluded_from_selection: true,
        ...row,
        deltas: best.map((b) => ({
          smp: b.smp,
          composite: Math.round((b.composite - row.composite) * 10) / 10,
          ...Object.fromEntries(DIM_KEYS.map((k) => [k, b[k].score - row[k].score])),
        })),
      };
    }
    return {
      structured: { ...d, scores: d.scores.map((r) => enrichRow(r, !!ctx.isPreflight)), current_position },
      error: null,
    };
  }
  if (stage === "11") {
    const p = Stage11Schema.safeParse(json);
    if (!p.success) return { structured: null, error: zodMsg(p.error) };
    const d = p.data;
    if (ctx.expectedCount != null && d.blocks.length !== ctx.expectedCount) problems.push(`expected ${ctx.expectedCount} blocks, got ${d.blocks.length}`);
    const elim = new Set((ctx.stage10Eliminated ?? []).map((s) => s.toLowerCase().trim()));
    for (const b of d.blocks) {
      if (elim.has(b.smp.toLowerCase().trim()) && (b.verdict !== "ELIMINATED" || !b.fatal.includes("STAGE10-FLOOR"))) {
        problems.push(`${b.smp}: Stage 10 eliminated it, so verdict must be ELIMINATED with STAGE10-FLOOR`);
      }
      if (b.fatal.length > 0 && b.verdict !== "ELIMINATED" && b.verdict !== "REWRITTEN") problems.push(`${b.smp}: fatal tests listed but verdict ${b.verdict}`);
    }
    if (problems.length) return { structured: null, error: problems.join("; ") };
    const { current_position: cp11, ...rest11 } = d;
    if (!ctx.current) return { structured: rest11, error: null };
    if (ctx.current.kind !== "none" && cp11) {
      const line = ctx.current.line.toLowerCase().trim();
      if (d.surviving_set.some((x) => x.toLowerCase().trim() === line)) {
        return { structured: null, error: "current proposition appears in surviving_set; it must be excluded from selection" };
      }
    }
    return { structured: { ...rest11, current_position: currentEnvelope("11", ctx.current, cp11 ?? null) }, error: null };
  }
  const p = Stage13Schema.safeParse(json);
  if (!p.success) return { structured: null, error: zodMsg(p.error) };
  const d = p.data;
  const triggered = FORCING_TRIGGERS.some((k) => d.credibility[k].score <= 5);
  if (triggered !== (d.forcing_test != null)) problems.push(triggered ? "a trigger dimension is ≤5 but forcing_test is missing" : "forcing_test present but no trigger dimension is ≤5");
  if (d.forcing_test) {
    const want = d.forcing_test.verdict === "FORCING PROPOSITION" ? "OPERATIONAL_REQUIREMENTS" : "GUARDRAILS";
    if (d.section5.mode !== want) problems.push(`section5 mode ${d.section5.mode} does not match forcing verdict`);
  } else if (d.section5.mode !== "GUARDRAILS") problems.push("section5 must be GUARDRAILS when the forcing test is not triggered");
  if (problems.length) return { structured: null, error: problems.join("; ") };
  const { current_position: cp13, ...rest13 } = d;
  if (!ctx.current) return { structured: rest13, error: null };
  return { structured: { ...rest13, current_position: currentEnvelope("13", ctx.current, cp13 ?? null) }, error: null };
}

// ── Prompt addenda (appended to the user message; text answer unchanged) ──
const SHAPES: Record<StructuredStage, string> = {
  "9": `{"propositions":[{"id":"P1","smp":"","field_name":"","foundation":{"territory":"","truth":"","reinterpretation":""},"impossibility":[{"competitor":"<Stage 2 CMM name>","why_they_cannot":""}],"creative_territory":"","creative_function":{"class":"SELF-EXECUTING|PLATFORM","rationale":""}}],"ranking":[{"id":"P1","rank":1,"rationale":""}],"recommended":["P1"]}`,
  "10": `{"smps_scored":0,"selection_rule":"","scores":[{"smp":"","field_name":"","fame":{"score":1,"justification":""},"truth_strength":{"score":1,"justification":""},"competitive_impossibility":{"score":1,"justification":"","competitor":null,"competitor_claim":null},"brand_permission":{"score":1,"justification":"","evidence":null},"clean_air":{"score":1,"justification":"","occupier":null,"occupying_claim":null},"commercial_precedent":{"score":1,"justification":"","precedents":[{"brand":"","campaign":"","year":2004}]}}],"current_position":null}`,
  "11": `{"blocks":[{"smp":"","field_name":"","iconic_tier":false,"tests":{"T1":{"result":"HOLDS|WOBBLES|CRACKS","rationale":""},"T2":{},"T3":{},"T4":{},"T5":{"result":"","counter_line":"","classification":"EXPOSES-UNTRUTH|COMPETES-FOR-TERRITORY|UNCERTAIN","rationale":""},"T6":{},"T7":{"result":"","misreading":"","guard_rail":"","rationale":""},"T8":{"result":"HOLDS|WOBBLES|CRACKS|N/A","rationale":null}},"verdict":"VALIDATED|VALIDATED — EXPOSED|VALIDATED WITH STRATEGIC NOTE|REWRITTEN|ELIMINATED","fatal":[],"flags":[],"exposure_note":null,"strategic_note":null,"rewrite":null,"iconic_final":"CONFIRMED|DOWNGRADED|N/A"}],"surviving_set":[],"exposed_count":0,"divergence_preserved":true}`,
  "13": `{"verdict":"CONFIRMED — PROCEED|CONFIRMED WITH ADJUSTMENTS — PROCEED|HUMAN REVIEW REQUIRED|RETURN TO STAGE 12 — RESELECT SMP","verdict_reason":"","credibility":{"product_truth_alignment":{"score":1,"justification":""},"audience_permission":{},"tonal_compatibility":{},"behavioural_capacity":{},"cultural_authority":{},"historical_consistency":{}},"most_vulnerable":"behavioural_capacity","forcing_test":null,"ownership":{"own":"","behave":"","sustain":""},"adjustments":[{"what":"","why":"","downstream":""}],"section5":{"mode":"GUARDRAILS|OPERATIONAL_REQUIREMENTS","items":[{"text":"","dimension":null,"horizon":null}]},"commitments":[""]}`,
};

export function structuredInstruction(stage: StructuredStage, current?: CurrentPropositionSource): string {
  let extra = "";
  if (stage === "10") {
    extra = current && current.kind !== "none"
      ? `\nCURRENT POSITION (baseline only): also score the brand's CURRENT proposition "${current.line}" with the identical rubric, anchors and evidence rules, and put it ONLY in "current_position" of the data block. Do NOT mention, score or rank it anywhere in the written answer; it is not a candidate and is excluded from selection.`
      : `\nSet "current_position" to null.`;
  }
  if (stage === "11" && current) {
    extra = current.kind !== "none"
      ? `\nCURRENT POSITION (baseline only): also run the brand's CURRENT proposition "${current.line}" through all eight tests (T1–T8) with the identical rules, and put that one block ONLY in "current_position" of the data block (same shape as a "blocks" entry). Do NOT mention or test it anywhere in the written answer, do NOT add it to "blocks" or "surviving_set"; it is not a candidate and is excluded from selection.`
      : `\nAdd "current_position": null to the data block.`;
  }
  if (stage === "13" && current) {
    extra = current.kind !== "none"
      ? `\nCURRENT POSITION (baseline only): also score the brand's CURRENT proposition "${current.line}" on the same six credibility dimensions with the identical anchors, and add to the data block "current_position":{"credibility":{"product_truth_alignment":{"score":1,"justification":""},"audience_permission":{},"tonal_compatibility":{},"behavioural_capacity":{},"cultural_authority":{},"historical_consistency":{}},"most_vulnerable":"<dimension>"}. Do NOT mention or score it anywhere in the written answer; it is not a candidate, is excluded from selection, and does not change the verdict.`
      : `\nAdd "current_position": null to the data block.`;
  }
  return `

==== STRUCTURED DATA BLOCK (machine record — do not change the written answer above) ====
Write your full answer exactly as instructed. Then, after the final line of the answer, append ONE data block that restates the same content, in this exact form:
${STRUCTURED_OPEN}
<valid JSON matching: ${SHAPES[stage]}>
${STRUCTURED_CLOSE}
Every value must match the written answer. Scores are integers 1–10. Use null where a field does not apply. Output nothing after ${STRUCTURED_CLOSE}.${extra}`;
}

// ── Stage 10 current position (F1d stored shape) ─────────────────────────
export const Stage10CurrentPositionSchema = Stage10Row.extend({
  status: z.literal("scored"),
  line: str,
  evidence_label: z.enum(["Client-supplied", "Unverified"]),
  source: z.string().nullable(),
  source_date: z.string().nullable(),
  is_current: z.literal(true),
  excluded_from_selection: z.literal(true),
  composite: z.number(),
  code_verdict: z.string(),
  code_verdict_reason: z.string(),
  deltas: z.array(z.object({ smp: str, composite: z.number() }).passthrough()),
});
export function checkCurrentPosition(v: unknown): { ok: true } | { ok: false; reason: string } {
  const r = Stage10CurrentPositionSchema.safeParse(v);
  return r.success ? { ok: true } : { ok: false, reason: zodMsg(r.error) };
}

// ── Stage 11 / 13 current position (T1 stored shape) ─────────────────────
const CurrentBase = {
  status: z.literal("scored"),
  line: str,
  evidence_label: z.enum(["Client-supplied", "Unverified"]),
  source: z.string().nullable(),
  source_date: z.string().nullable(),
  is_current: z.literal(true),
  excluded_from_selection: z.literal(true),
};
export const Stage11CurrentPositionSchema = Stage11Block.extend(CurrentBase);
export const Stage13CurrentPositionSchema = Stage13Schema.shape.current_position.unwrap().unwrap().extend(CurrentBase);
export function checkStageCurrentPosition(stage: "11" | "13", v: unknown): { ok: true } | { ok: false; reason: string } {
  const r = (stage === "11" ? Stage11CurrentPositionSchema : Stage13CurrentPositionSchema).safeParse(v);
  return r.success ? { ok: true } : { ok: false, reason: zodMsg(r.error) };
}
