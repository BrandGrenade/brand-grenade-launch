import { z } from 'zod';
import { computeWeightedComposite, evaluateStage10Verdict, STAGE_10_FLOORS } from '../stage12-filter';
import { DIMENSIONS, brandId, metadata, type BrandSources } from '../access/foundations';

export const PROJECTION_METHOD = 'stage10-future-state.v1';
export const SCORER_PROMPT_VERSION = 'stage10.V6+future-state.v1';
export const NO_BASELINE = 'No current position for brand × market';
const texts = z.array(z.string().trim().min(1).max(6000)).max(80);
const dimension = z.object({ score: z.number().min(1).max(10).nullable(), reason: z.string().trim().min(1), evidence_refs: texts, confidence: z.enum(['high', 'medium', 'low', 'insufficient']), risks: texts, conditions: texts });
export const ProjectedInput = z.object({ resulting_position: z.string().trim().min(1), assumptions: texts, conditions: texts, dimensions: z.object({ fame: dimension, truth_strength: dimension, competitive_impossibility: dimension, brand_permission: dimension, clean_air: dimension, commercial_precedent: dimension }) });
export type ModelledInput = z.infer<typeof ProjectedInput>;
export type Baseline = { job_id: string; session_id: string; version: number; brand_id: string; market: string; requested_market: string | null; missing_inputs: string[]; record: Record<string, unknown>; manifest: Record<string, unknown>; evidence_refs: string[] };
type R = Record<string, unknown>;
export function resolveBaseline(src: BrandSources, brand: string, requested?: string | null, runId?: string, version?: number): Baseline | null {
  const ids = new Map(src.sessions.map(s => [s.id, s]));
  const candidates = src.addonJobs.filter(j => {
    const run = ids.get(j.session_id);
    const r = j.results['10'] as R | undefined;
    return run && (!runId || j.session_id === runId) && j.published_version !== null && j.published_version <= (version ?? run.version) &&
      brandId(j.subject_brand ?? '') === brandId(brand) && r?.status === 'scored' && DIMENSIONS.every(([k]) => { const n = (r[k] as R | undefined)?.['score']; return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 10; });
  }).sort((a,b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  const req = requested?.trim() || null;
  const marketOf = (j: typeof candidates[number]) => j.market?.trim() || 'global';
  const job = candidates.find(j => marketOf(j).toLowerCase() === (req ?? 'global').toLowerCase()) ?? candidates.find(j => marketOf(j) === 'global');
  if (!job || job.published_version === null) return null;
  const market = marketOf(job);
  return { job_id: job.id, session_id: job.session_id, version: job.published_version, brand_id: brandId(brand), market, requested_market: req,
    missing_inputs: req && req.toLowerCase() !== market.toLowerCase() ? ['market-specific baseline'] : [], record: job.results['10'] as R,
    manifest: job.manifest ?? {}, evidence_refs: [`current_position_addon_jobs:${job.id}:results.10`] };
}

/** Nulls are not passed to Stage 10 arithmetic (which otherwise treats them as zero). */
export function buildProjection(b: Baseline, change: { type: string; description: string }, raw: unknown, createdAt: string) {
  const parsed = ProjectedInput.parse(raw);
  if(/\b(?:forecast|will)\b/i.test(JSON.stringify(parsed)))throw new Error('PROJECTION_WORDING_INVALID: use modelled or projected, not forecast or will');
  const allowed = new Set(b.evidence_refs);
  const claims = Array.isArray(b.manifest['evidence']) ? b.manifest['evidence'] as R[] : [];
  claims.forEach((_, i) => allowed.add(`baseline:${b.job_id}:evidence:${i}`));
  const nulls: string[] = [];
  const scores: Record<string, number> = {};
  const dimensions = Object.fromEntries(DIMENSIONS.map(([key, weightKey]) => {
    const d = parsed.dimensions[key];
    const refs = d.evidence_refs.filter(r => allowed.has(r));
    const defensible = refs.length > 0 && d.confidence !== 'insufficient';
    const projected = defensible ? d.score : null;
    const reason = projected === null ? `${key}: ${!defensible ? 'No supporting saved evidence reference or insufficient confidence. ' : ''}${d.reason}` : d.reason;
    if (projected === null) nulls.push(reason); else scores[weightKey] = projected;
    const saved = (b.record[key] as R)['score'] as number;
    return [key, { baseline: saved, projected, movement: projected === null ? null : projected - saved, direction: projected === null ? null : projected === saved ? 'unchanged' : projected > saved ? 'up' : 'down',
      null_reason: projected === null ? reason : null, reason, evidence: (b.record[key] as R)['justification'] ?? null, evidence_refs: refs, confidence: d.confidence,
      finding_basis: { baseline: 'evidence-supported', projected: 'modelled' }, risks: d.risks, conditions: d.conditions, risks_and_conditions: [...d.risks, ...d.conditions] }];
  }));
  const dims = { fame: scores['fame'] ?? 0, truthStrength: scores['truthStrength'] ?? 0, competitiveImpossibility: scores['competitiveImpossibility'] ?? 0, brandPermission: scores['brandPermission'] ?? 0, cleanAir: scores['cleanAir'] ?? 0, commercialPrecedent: scores['commercialPrecedent'] ?? 0 };
  const verdict = nulls.length ? null : evaluateStage10Verdict(dims);
  return {
    content_status: nulls.length ? 'partial' : 'structured',
    content: { proposed_change: change, is_approved_position: false, projection_note: 'A projection is a modelled assessment, never an approved Stage 10 proposition.',
      baseline: { proposition: b.record['line'] ?? null, composite: b.record['composite'] ?? null, verdict: b.record['code_verdict'] ?? null, session_id: b.session_id, published_version: b.version, job_id: b.job_id, basis: 'evidence-supported' },
      dimensions, resulting_position: parsed.resulting_position, assumptions: parsed.assumptions, conditions: parsed.conditions, movement_rule: 'projected minus baseline',
      projected_composite: nulls.length ? null : computeWeightedComposite(dims), projected_verdict: verdict?.verdict ?? null, projected_verdict_reason: nulls.length ? nulls.join('; ') : verdict?.reason ?? null,
      hard_floors: STAGE_10_FLOORS, basis: 'modelled', method_version: PROJECTION_METHOD, scorer_prompt_version: SCORER_PROMPT_VERSION, created_at: createdAt, status: nulls.length ? 'partial' : 'complete',
      scoring_source: 'src/lib/stage12-filter.ts: computeWeightedComposite, evaluateStage10Verdict' },
    metadata: metadata({ brand_id: b.brand_id, requested_market: b.requested_market, market: b.market, analysis_type: `change.${change.type}`, strategy_version: b.version, method_version: PROJECTION_METHOD,
      run_id: b.session_id, run_version: b.version, produced_at: createdAt, evidence_refs: b.evidence_refs, confidence: Object.fromEntries(DIMENSIONS.map(([k]) => [k, parsed.dimensions[k].confidence])), missing_inputs: [...b.missing_inputs, ...nulls], status: nulls.length ? 'partial' : 'complete' }),
  };
}

export function projectionInstructions(b: Baseline, change: { type: string; description: string }) {
  return `[MODELLED FUTURE STATE — NOT A POSITION]\nExisting evidence-supported baseline: ${JSON.stringify(b.record)}\nProposed change: ${JSON.stringify(change)}\nMarket: ${b.market}; requested market: ${b.requested_market ?? 'global'}\nSaved evidence manifest: ${JSON.stringify(b.manifest)}\nAllowed evidence refs: ${JSON.stringify([...b.evidence_refs, ...(Array.isArray(b.manifest['evidence']) ? b.manifest['evidence'].map((_, i) => `baseline:${b.job_id}:evidence:${i}`) : [])])}\nDistinguish existing position, proposed change, assumed conditions, and resulting modelled position. Reassess EACH dimension under the unchanged Stage 10 calibrated anchors. Never adjust a baseline arithmetically or assume improvement. Do not transfer another brand's heritage or permission merely because a name changes. Where saved evidence does not defend a projected score, use null and explain why. Conditions are assumptions, not evidence. Use projected/modelled, never forecast or will in your answer. Return only JSON: {"resulting_position":"…","assumptions":[],"conditions":[],"dimensions":{${DIMENSIONS.map(([k]) => `"${k}":{"score":null,"reason":"…","evidence_refs":[],"confidence":"insufficient","risks":[],"conditions":[]}`).join(',')}}}. Do not compute composite or verdict; code applies unchanged Stage 10 weights and floors.`;
}