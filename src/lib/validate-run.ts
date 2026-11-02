// Shared, pure Validate assembly used by BOTH entry paths:
//  (a) add-on on an existing locked run, and (b) a new Validate run on the
//  Diagnostic path. Identical saved inputs must give identical verdicts.
// Generated propositions (Stages 8, 8B, 9, 12) are COMPARATORS ONLY: they feed
// the best-alternative test and are shown as evidence, never as a recommendation.
import { buildValidateOutputs, effectiveDerivation, type ValidateBrief, type ValidateInputs } from './validate-mode';
import { recoverSavedStage } from './saved-stage-records';

/** Pipeline stages whose propositions are comparators on a Validate run. */
export const VALIDATE_COMPARATOR_STAGES = ['08', '08B', '09', '10', '11', '12', '13'];
export const COMPARATOR_ROLE = 'comparator' as const;
export const COMPARATOR_NOTE = 'Comparator only — generated for the best-alternative test. Shown as evidence; not a recommendation. The verdict concerns the current strategy only.';

type Row = Record<string, unknown>;
const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLocaleLowerCase() : '');

/** Brand names a run's own saved candidates belong to (never browser-written link fields). */
export function runBrandNames(session: Row, original?: Row | null): string[] {
  const fields = (session.brief_versions as { fields?: { brandName?: string } }[] | null)?.[0]?.fields;
  return [session.brand_name, fields?.brandName, original?.brand_name].map(norm).filter(Boolean);
}
export function isSameBrand(subject: string, session: Row, original?: Row | null) {
  return runBrandNames(session, original).includes(norm(subject));
}

export type Comparator = { role: typeof COMPARATOR_ROLE; is_recommendation: false; smp: string; field_name: string | null; composite: number; code_verdict: string | null; note: string };

/** Saved Stage 10 candidate scores, excluding any current-position record. */
export function comparatorsFromRun(session: Row): Comparator[] {
  let s10 = session.stage_10_structured as Row | null;
  if ((!s10 || !Array.isArray(s10.scores)) && typeof session.stage_10_output === 'string') s10 = recoverSavedStage('10', session.stage_10_output) as Row | null;
  const scores = Array.isArray(s10?.scores) ? (s10!.scores as Row[]) : [];
  return scores
    .filter(r => r && r.is_current !== true && typeof r.smp === 'string' && typeof r.composite === 'number' && Number.isFinite(r.composite))
    .map(r => ({ role: COMPARATOR_ROLE, is_recommendation: false, smp: String(r.smp), field_name: (r.field_name as string) ?? null, composite: Number(r.composite), code_verdict: (r.code_verdict as string) ?? null, note: COMPARATOR_NOTE }));
}

export function sourceKindOf(manifest: Row): ValidateInputs['sourceKind'] {
  const d = effectiveDerivation(manifest.derivation_label, { source: manifest.proposition_source, date: manifest.proposition_source_date, quote: manifest.proposition_source_quote });
  return d === 'Client-supplied' ? 'client' : d === 'Owner-stated (public)' ? 'owner-stated' : d;
}

export type SavedValidateSource = { session: Row; original?: Row | null; job: { proposition: string; results: Row; source_manifest: Row } };

/** The one input builder both routes call. */
export function validateInputsFromSaved(src: SavedValidateSource) {
  const subject = String(src.job.source_manifest.subject_brand ?? '');
  const same = isSameBrand(subject, src.session, src.original);
  const comparators = same ? comparatorsFromRun(src.session) : [];
  const best = comparators.length ? Math.max(...comparators.map(c => c.composite)) : null;
  const input: ValidateInputs = { sourceKind: sourceKindOf(src.job.source_manifest), baseline: src.job.results, bestAlternativeComposite: best };
  return { input, comparators, sameBrand: same };
}

export function checkpointsOf(session: Row) {
  return Object.fromEntries(['a', 'b', 'c'].map(k => [k, { confirmed: session[`checkpoint_${k}_confirmed`] ?? false, by: session[`checkpoint_${k}_confirmed_by`] ?? null, at: session[`checkpoint_${k}_confirmed_at`] ?? null }]));
}

export function assembleValidateOutputs(args: SavedValidateSource & { runId: string; version: number; brief: ValidateBrief; entryPath: 'addon' | 'new' }) {
  const { input, comparators, sameBrand } = validateInputsFromSaved(args);
  const m = args.job.source_manifest;
  const provenance = Array.isArray(m.evidence) ? (m.evidence as unknown[]).filter((r): r is Row => !!r && typeof r === 'object') : [];
  const outputs = buildValidateOutputs({ runId: args.runId, version: args.version, brief: args.brief, input, provenance, checkpoints: { ...checkpointsOf(args.session), entry_path: args.entryPath } });
  // Comparators are attached as evidence only, inside the evidence-gaps output.
  const gaps = outputs['validate.evidence_gaps'] as { data: Row };
  gaps.data = { ...gaps.data, comparators: { same_brand: sameBrand, best_alternative_composite: input.bestAlternativeComposite, items: comparators, note: COMPARATOR_NOTE } };
  return outputs;
}
