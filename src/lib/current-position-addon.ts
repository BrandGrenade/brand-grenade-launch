import { Stage10Schema, Stage10CurrentPositionSchema, Stage11CurrentPositionSchema, Stage13CurrentPositionSchema } from './structured-output';
import { computeWeightedComposite, evaluateStage10Verdict } from './stage12-filter';

export const BASELINE_STAGES = ['10', '11', '13'] as const;
export type BaselineStage = typeof BASELINE_STAGES[number];
export const INFINITI_PROPOSITION = 'Japanese precision and thoughtful hospitality, expressed through the car and the ownership experience.';
export const BASELINE_ERRORS = {
  evidence: 'BASELINE_PROPOSITION_EVIDENCE_INSUFFICIENT', validation: 'BASELINE_RESULT_CONTRACT_FAILED',
  save: 'BASELINE_STRUCTURED_SAVE_FAILED', source: 'BASELINE_SOURCE_VERSION_CHANGED', generation: 'BASELINE_GENERATION_FAILED',
} as const;

export function parseBaseline(stage: BaselineStage, raw: string, line: string, manifest: Record<string, unknown>) {
  const block = raw.includes('<<<STRUCTURED_JSON') ? raw.split('<<<STRUCTURED_JSON')[1]?.split('>>>')[0] : raw;
  const parsed = JSON.parse((block ?? '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
  const envelope = { status: 'scored', line, evidence_label: 'Unverified', source: 'Specified saved JLR research; see source_manifest', source_date: null,
    is_current: true, excluded_from_selection: true, derivation_label: 'BG-derived', subject_brand: 'Infiniti', source_manifest: manifest };
  if (stage === '10') {
    const row = Stage10Schema.shape.scores.element.parse(parsed);
    if (row.smp !== line) throw new Error('Baseline proposition was changed');
    if (row.competitive_impossibility.score < 10 && !row.competitive_impossibility.competitor) throw new Error('Named competitor required');
    if (row.clean_air.score < 8 && !row.clean_air.occupier) throw new Error('Named occupier required');
    const dims = { fame: row.fame.score, truthStrength: row.truth_strength.score, competitiveImpossibility: row.competitive_impossibility.score,
      brandPermission: row.brand_permission.score, cleanAir: row.clean_air.score, commercialPrecedent: row.commercial_precedent.score };
    const verdict = evaluateStage10Verdict(dims);
    const result = { ...row, ...envelope, composite: computeWeightedComposite(dims), code_verdict: verdict.verdict, code_verdict_reason: verdict.reason,
      deltas: [], comparison_note: 'No cross-brand delta: saved candidates assess Jaguar, this baseline assesses Infiniti.' };
    Stage10CurrentPositionSchema.parse(result); return result;
  }
  const result = { ...parsed, ...envelope };
  if (stage === '11') {
    if (result.smp !== line) throw new Error('Baseline proposition was changed');
    Stage11CurrentPositionSchema.parse(result);
  } else Stage13CurrentPositionSchema.parse(result);
  return result;
}

export function terminalBaselineError(message: string) {
  return /\b40[123]\b|credit|payment|required consent|denied|refusal|refused/i.test(message);
}

export function baselineAtVersion(jobs: Record<string, unknown>[], version: number) {
  return jobs.filter(j => j.status === 'complete' && typeof j.published_version === 'number' && j.published_version <= version)
    .sort((a,b) => Number(b.published_version)-Number(a.published_version))[0] ?? null;
}