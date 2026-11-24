// Hub foundations (contract 1.0): metadata envelope, brand × market reads,
// portfolio batches, selected-proposition score and change assessment.
// Everything here READS saved records; it never writes run data, scores,
// gates or checkpoints. Batch bookkeeping lives in its own tables.
import { STAGE_10_FLOORS, STAGE_10_WEIGHTS, STAGE_10_WEIGHTED_MAX } from "../stage12-filter";

export const CONTRACT_VERSION = "1.0";
export const GLOBAL = "global";
export const MISSING_MARKET = "market-specific analysis";

/** One status vocabulary for metadata.status everywhere. */
export type MetaStatus = "complete" | "partial" | "not_produced" | "unavailable" | "failed";
export const META_STATUS: Record<string, MetaStatus> = { structured: "complete", text_only: "complete", partial: "partial", not_produced: "not_produced", unavailable: "unavailable" };

export type Metadata = {
  brand_id: string | null; requested_market: string | null; market: string | null; analysis_type: string;
  strategy_version: number | null; method_version: string | null; run_id: string | null; run_version: number | null;
  produced_at: string | null; confidence: unknown; evidence_refs: string[]; missing_inputs: string[]; status: MetaStatus; contract_version: string;
};
export function metadata(m: Partial<Metadata> & { analysis_type: string; status: MetaStatus }): Metadata {
  return {
    brand_id: m.brand_id ?? null, requested_market: m.requested_market ?? null, market: m.market ?? null, analysis_type: m.analysis_type,
    strategy_version: m.strategy_version ?? null, method_version: m.method_version ?? null, run_id: m.run_id ?? null, run_version: m.run_version ?? null,
    produced_at: m.produced_at ?? null, confidence: m.confidence ?? null, evidence_refs: m.evidence_refs ?? [], missing_inputs: m.missing_inputs ?? [],
    status: m.status, contract_version: CONTRACT_VERSION,
  };
}
export function isoUtc(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/** brand_id convention: lower-case, non-alphanumerics collapsed to "-". */
export const brandId = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Market convention: BG holds no market-specific analysis today; every saved analysis is "global". */
export function resolveMarket(requested: string | null | undefined, available: string[] = []): { requested_market: string | null; market: string; missing: string[] } {
  const req = requested?.trim() || null;
  if (!req || req.toLowerCase() === GLOBAL) return { requested_market: req, market: GLOBAL, missing: [] };
  const hit = available.find((m) => m.toLowerCase() === req.toLowerCase());
  return hit ? { requested_market: req, market: hit, missing: [] } : { requested_market: req, market: GLOBAL, missing: [MISSING_MARKET] };
}

// ── Brand catalogue (stored records only) ───────────────────────────────────
type R = Record<string, unknown>;
export type BrandSources = {
  /** Linked production Strategy Pipeline sessions (summary + version count). */
  sessions: { id: string; brand_name: string | null; version: number; locked_at: string | null; created_at: string | null; validate_brief: unknown }[];
  /** Saved briefs: brand name and the brief's own brand field. */
  briefs: { brand_name: string | null; f1_brand: string | null }[];
  addonJobs: { id: string; session_id: string; subject_brand: string | null; published_version: number | null; proposition: string | null; results: R; completed_at: string | null }[];
  validates: { session_id: string; run_version: number; assessment_revision: number; subject_brand: string | null; outputs: R; created_at: string | null }[];
};
export type Brand = { brand_id: string; name: string; basis: string[]; session_ids: string[] };

/** "JLR's Jaguar, …" in the brief's own brand field names the subject brand of that owner's runs. */
export function briefSubjectBrand(owner: string | null, f1: string | null): string | null {
  if (!owner || !f1) return null;
  const esc = owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^\\s*${esc}['’]s\\s+([A-Z][\\w-]*(?:\\s+[A-Z][\\w-]*){0,3})\\s*[,.;:—–]`).exec(f1);
  return m ? m[1] : null;
}
export function brandCatalogue(src: BrandSources): Map<string, Brand> {
  const out = new Map<string, Brand>();
  const add = (name: string | null | undefined, basis: string, ids: string[]) => {
    if (!name?.trim()) return;
    const id = brandId(name);
    if (!id) return;
    const b = out.get(id) ?? { brand_id: id, name: name.trim(), basis: [], session_ids: [] };
    if (!b.basis.includes(basis)) b.basis.push(basis);
    for (const s of ids) if (!b.session_ids.includes(s)) b.session_ids.push(s);
    out.set(id, b);
  };
  const byOwner = (owner: string | null) => src.sessions.filter((s) => owner && s.brand_name && brandId(s.brand_name) === brandId(owner)).map((s) => s.id);
  for (const s of src.sessions) add(s.brand_name, "run brand_name", [s.id]);
  for (const b of src.briefs) add(briefSubjectBrand(b.brand_name, b.f1_brand), "saved brief brand field", byOwner(b.brand_name));
  for (const j of src.addonJobs) add(j.subject_brand, "current-position subject brand", []);
  for (const v of src.validates) add(v.subject_brand, "Validate subject brand", []);
  return out;
}

// ── Per-brand analyses ──────────────────────────────────────────────────────
export type Analysis = { content_status: string; content: unknown; metadata: Metadata };
const latest = <T,>(xs: T[], key: (x: T) => string) => [...xs].sort((a, b) => key(b).localeCompare(key(a)))[0];

export function validateVerdictFor(src: BrandSources, b: Brand, market?: string | null): Analysis {
  const mk = resolveMarket(market);
  const ids = new Set(src.sessions.map((s) => s.id));
  const own = src.validates.filter((v) => ids.has(v.session_id) && v.subject_brand && brandId(v.subject_brand) === b.brand_id);
  const v = latest(own, (x) => `${String(x.run_version).padStart(8, "0")}~${String(x.assessment_revision).padStart(8, "0")}`);
  const base = { brand_id: b.brand_id, analysis_type: "validate.verdict", requested_market: mk.requested_market, market: mk.market, method_version: "validate.verdict.v1" };
  if (!v) return { content_status: "not_produced", content: { reason: "No saved Validate assessment for this brand" }, metadata: metadata({ ...base, status: "not_produced", missing_inputs: [...mk.missing, "Validate assessment"] }) };
  const out = (v.outputs?.["validate.verdict"] ?? null) as R | null;
  return {
    content_status: out ? "structured" : "not_produced", content: out,
    metadata: metadata({ ...base, status: out ? "complete" : "not_produced", run_id: v.session_id, run_version: v.run_version, strategy_version: v.run_version,
      produced_at: isoUtc(v.created_at), confidence: (out?.confidence as unknown) ?? null, evidence_refs: [`validate_assessments:${v.session_id}:v${v.run_version}:r${v.assessment_revision}`],
      missing_inputs: mk.missing }),
  };
}

export function profileFor(src: BrandSources, b: Brand, market?: string | null): Analysis {
  const mk = resolveMarket(market);
  const runs = src.sessions.filter((s) => b.session_ids.includes(s.id));
  const base = { brand_id: b.brand_id, analysis_type: "profile", requested_market: mk.requested_market, market: mk.market, method_version: "profile.v1" };
  const ids = new Set(src.sessions.map((s) => s.id));
  const jobs = src.addonJobs.filter((j) => ids.has(j.session_id) && j.subject_brand && brandId(j.subject_brand) === b.brand_id);
  const verdicts = src.validates.filter((v) => ids.has(v.session_id) && v.subject_brand && brandId(v.subject_brand) === b.brand_id);
  if (!runs.length && !jobs.length && !verdicts.length) return { content_status: "not_produced", content: { reason: "No saved analysis for this brand" }, metadata: metadata({ ...base, status: "not_produced", missing_inputs: [...mk.missing, "brand runs"] }) };
  const run = latest(runs, (s) => s.created_at ?? "");
  return {
    content_status: "structured",
    content: {
      brand_id: b.brand_id, name: b.name, identified_by: b.basis,
      strategy_runs: runs.map((s) => ({ run_id: s.id, version: s.version, locked: !!s.locked_at, created_at: s.created_at })),
      current_position_assessments: jobs.map((j) => ({ session_id: j.session_id, published_version: j.published_version, proposition: j.proposition, completed_at: j.completed_at })),
      validate_assessments: verdicts.map((v) => ({ session_id: v.session_id, run_version: v.run_version, assessment_revision: v.assessment_revision })),
    },
    metadata: metadata({ ...base, status: "complete", run_id: run?.id ?? null, run_version: run?.version ?? null, strategy_version: run?.version ?? null,
      produced_at: isoUtc(run?.created_at ?? null), evidence_refs: [...runs.map((s) => `sessions:${s.id}`), ...jobs.map((j) => `current_position_addon_jobs:${j.id}`)],
      missing_inputs: [...mk.missing, ...(runs.length ? [] : ["brand strategy run"])] }),
  };
}

// ── Stage 10 selected proposition ───────────────────────────────────────────
export const DIMENSIONS = [
  ["fame", "fame"], ["truth_strength", "truthStrength"], ["competitive_impossibility", "competitiveImpossibility"],
  ["brand_permission", "brandPermission"], ["clean_air", "cleanAir"], ["commercial_precedent", "commercialPrecedent"],
] as const;
export const STAGE10_SOURCE = "src/lib/stage12-filter.ts: STAGE_10_WEIGHTS, STAGE_10_FLOORS, computeWeightedComposite, evaluateStage10Verdict";

export type ConfirmationInput = { selected_smp: unknown; selection_rationale: unknown; checkpoint_c_confirmed: unknown; checkpoint_c_confirmed_at: unknown; rationale_version_at: string | null };
/** Authority: the stored Stage 12 confirmation write — saved human rationale for the saved selection. */
export function confirmationEvent(c: ConfirmationInput): { confirmed: boolean; at: string | null; at_source: string | null; discrepancy: string | null } {
  const rat = c.selection_rationale && typeof c.selection_rationale === "object" && Object.values(c.selection_rationale as R).some((v) => typeof v === "string" && v.trim());
  const sel = typeof c.selected_smp === "string" && c.selected_smp.trim();
  const confirmed = !!(rat && sel);
  const at = typeof c.checkpoint_c_confirmed_at === "string" && c.checkpoint_c_confirmed_at ? c.checkpoint_c_confirmed_at : c.rationale_version_at;
  const at_source = typeof c.checkpoint_c_confirmed_at === "string" && c.checkpoint_c_confirmed_at ? "sessions.checkpoint_c_confirmed_at" : c.rationale_version_at ? "run_output_versions (Checkpoint C: saved human selection rationale)" : null;
  const discrepancy = confirmed !== !!c.checkpoint_c_confirmed ? `Stage 12 confirmation ${confirmed ? "present" : "absent"} but checkpoint_c_confirmed is ${!!c.checkpoint_c_confirmed}` : null;
  return { confirmed, at: confirmed ? at : null, at_source: confirmed ? at_source : null, discrepancy };
}

export function stage10Selected(runId: string, version: number, record: R | null, conf: ReturnType<typeof confirmationEvent>, selected: unknown) {
  if (!conf.confirmed) return { value: null, reason: "No confirmed selection" };
  const rows = Array.isArray(record?.scores) ? (record!.scores as R[]) : [];
  if (!rows.length) return { value: null, reason: "No saved Stage 10 scores at this version" };
  const idx = rows.map((r, i) => (r.smp === selected ? i : -1)).filter((i) => i >= 0);
  if (idx.length !== 1) return { value: null, reason: idx.length ? `Selected proposition appears ${idx.length} times in Stage 10; ambiguous` : "Selected proposition has no Stage 10 score at this version" };
  const i = idx[0], row = rows[i];
  const dimensions = Object.fromEntries(DIMENSIONS.map(([k, w]) => {
    const d = row[k] as R | undefined;
    return [k, { score: d?.score ?? null, scale: 10, weight: STAGE_10_WEIGHTS[w], justification: d?.justification ?? null }];
  }));
  const floor = (k: "truth_strength" | "competitive_impossibility", w: "truthStrength" | "competitiveImpossibility") => {
    const s = (row[k] as R | undefined)?.score;
    return { dimension: k, floor: STAGE_10_FLOORS[w], score: s ?? null, passed: typeof s === "number" ? s >= STAGE_10_FLOORS[w] : null };
  };
  return {
    value: {
      proposition_id: `${runId}:v${version}:stage10:${i + 1}`, proposition_text: row.smp, field_name: row.field_name ?? null, dimensions,
      composite: row.composite ?? null, composite_max: STAGE_10_WEIGHTED_MAX, verdict: row.code_verdict ?? null, verdict_reason: row.code_verdict_reason ?? null,
      hard_floors: [floor("truth_strength", "truthStrength"), floor("competitive_impossibility", "competitiveImpossibility")],
      selection_timestamp: conf.at, selection_timestamp_source: conf.at_source, scoring_source: STAGE10_SOURCE,
    },
    reason: null,
  };
}

/** Stage 18 maximum: the code sets no variable; its prompt template conflicts with eight 1–10 dimensions. */
export const STAGE18_MAX = {
  max: null as number | null,
  reason: "No Stage 18 maximum variable exists in code. The only values are prompt text in src/lib/stage18-the-detonation-prompt.ts (\"COMPOSITE: [n]/90\" and \"72 or above out of 90\"), which conflict with its eight dimensions each scored 1 to 10 (maximum 80). Not settled by code, so null.",
  source: "src/lib/stage18-the-detonation-prompt.ts (prompt template text, not a variable)",
};

// ── Change assessment ──────────────────────────────────────────────────────
export const CHANGE_TYPES = ["rename", "reposition", "merge", "extend"] as const;
export const PROJECTION_NULL = "Stage 10 dimension scores come only from the Stage 10 scoring call reading evidence against its anchors (src/lib/stage10-prompt.ts). The code holds weights, hard floors and composite arithmetic (src/lib/stage12-filter.ts) but no rule that projects a dimension score for a proposed change; producing one would need a new scoring rule or model call, which is excluded.";

export function changeAssessment(src: BrandSources, b: Brand, market: string | null | undefined, change: { type: string; description: string }) {
  const mk = resolveMarket(market);
  const ids = new Map(src.sessions.map((s) => [s.id, s]));
  const jobs = src.addonJobs.filter((j) => ids.has(j.session_id) && j.subject_brand && brandId(j.subject_brand) === b.brand_id && j.published_version !== null && (ids.get(j.session_id)!.version >= (j.published_version ?? 0)));
  const job = latest(jobs, (j) => `${j.completed_at ?? ""}~${String(j.published_version).padStart(8, "0")}`);
  const s10 = (job?.results?.["10"] ?? null) as R | null;
  const meta = (status: MetaStatus, extra: Partial<Metadata> = {}) => metadata({ brand_id: b.brand_id, analysis_type: `change.${change.type}`, requested_market: mk.requested_market, market: mk.market, method_version: "change.v1 (Stage 10 V6 dimensions)", status, ...extra, missing_inputs: [...mk.missing, ...(extra.missing_inputs ?? [])] });
  const valid = s10 && s10.status === "scored" && DIMENSIONS.every(([k]) => typeof (s10[k] as R | undefined)?.score === "number");
  if (!job || !valid) return { content_status: "not_produced", content: { baseline: null, dimensions: null, reason: "No current position for brand × market", proposed_change: change }, metadata: meta("not_produced", { missing_inputs: ["current position"] }) };
  const label = typeof s10.evidence_label === "string" ? s10.evidence_label : null;
  const dimensions = Object.fromEntries(DIMENSIONS.map(([k]) => {
    const d = s10[k] as R;
    return [k, { baseline: d.score, projected: null, movement: null, direction: null, null_reason: PROJECTION_NULL,
      evidence: d.justification ?? null, confidence: label, finding_basis: { baseline: "evidence-supported", projected: null }, risks_and_conditions: [] }];
  }));
  return {
    content_status: "partial",
    content: {
      proposed_change: change, is_approved_position: false, projection_note: "A projection is a modelled assessment, never an approved Stage 10 proposition.",
      baseline: { proposition: s10.line ?? job.proposition, composite: s10.composite ?? null, verdict: s10.code_verdict ?? null, session_id: job.session_id, published_version: job.published_version, job_id: job.id },
      dimensions, movement_rule: "projected minus baseline", scoring_source: STAGE10_SOURCE,
    },
    metadata: meta("partial", { run_id: job.session_id, run_version: job.published_version, strategy_version: job.published_version, produced_at: isoUtc(job.completed_at), confidence: label,
      evidence_refs: [`current_position_addon_jobs:${job.id}:results.10`], missing_inputs: ["projection rule for dimension scores"] }),
  };
}

// ── Portfolio batch ────────────────────────────────────────────────────────
export const BATCH_MAX = 25;
export type Attempt = { brand_id: string; attempt_no: number; kind: "initial" | "retry"; status: "done" | "failed"; result: unknown; error: string | null; created_at: string };
export type BatchStatus = "done" | "failed" | "not_started";
export function batchView(brands: string[], attempts: Attempt[]) {
  return brands.map((brand_id) => {
    const mine = attempts.filter((a) => a.brand_id === brand_id).sort((a, b) => a.attempt_no - b.attempt_no);
    const last = mine[mine.length - 1];
    const status: BatchStatus = last ? last.status : "not_started";
    return {
      brand_id, status, result: last?.status === "done" ? last.result : null,
      attempts: mine.map((a) => ({ attempt_no: a.attempt_no, kind: a.kind, status: a.status, error: a.error, recorded_at: a.created_at })),
    };
  });
}
