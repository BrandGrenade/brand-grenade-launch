import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory database shared by the RLS client and the mocked admin client so
// both REAL entry functions read identical saved inputs.
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const rpcCalls: { fn: string; args: Row }[] = [];
function client() {
  return {
    from(table: string) {
      let rows = [...(db[table] ?? [])];
      const b: Record<string, unknown> = {};
      const chain = () => b;
      Object.assign(b, {
        select: chain, order: chain, limit: chain,
        eq: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return b; },
        is: (k: string, v: unknown) => { rows = rows.filter(r => (r[k] ?? null) === v); return b; },
        single: async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: 'none' } }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (res: (v: unknown) => unknown) => res({ data: rows, error: null }),
      });
      return b;
    },
    rpc: async (fn: string, args: Row) => { rpcCalls.push({ fn, args }); return { data: `assessment-${rpcCalls.length}`, error: null }; },
  };
}
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: client() }));

import { assembleValidateAssessment, assembleNewRunAssessment } from './validate.server';
import { comparatorsFromRun, COMPARATOR_NOTE } from './validate-run';
import { buildDiagnosticValuation, comparatorWording } from './diagnostic-valuation';

const dim = { score: 7, justification: 'Saved evidence' };
const line = 'Existing promise';
const env = { status: 'scored', line, evidence_label: 'Client-supplied', source: 'Client', source_date: '2026-10-30', is_current: true, excluded_from_selection: true, derivation_label: 'Client-supplied', subject_brand: 'Marlowe Motor Company' };
const results = {
  '10': { ...env, smp: line, field_name: 'Current', fame: dim, truth_strength: dim, competitive_impossibility: { ...dim, competitor: 'Rival', competitor_claim: 'Saved' }, brand_permission: { ...dim, evidence: 'E' }, clean_air: { ...dim, occupier: 'Rival', occupying_claim: 'C' }, commercial_precedent: { ...dim, precedents: [] }, composite: 63, code_verdict: 'PASS', code_verdict_reason: '', deltas: [] },
  '11': { ...env, smp: line, field_name: 'Current', iconic_tier: false, tests: { T1: { result: 'HOLDS', rationale: 'E' }, T2: { result: 'HOLDS', rationale: 'E' }, T3: { result: 'HOLDS', rationale: 'E' }, T4: { result: 'HOLDS', rationale: 'E' }, T5: { result: 'HOLDS', rationale: 'E', counter_line: 'R', classification: 'UNCERTAIN' }, T6: { result: 'HOLDS', rationale: 'E' }, T7: { result: 'HOLDS', rationale: 'E', misreading: 'N', guard_rail: 'P' }, T8: { result: 'N/A', rationale: null } }, verdict: 'VALIDATED', fatal: [], flags: [], exposure_note: null, strategic_note: null, rewrite: null, iconic_final: 'N/A' },
  '13': { ...env, credibility: { product_truth_alignment: dim, audience_permission: dim, tonal_compatibility: dim, behavioural_capacity: dim, cultural_authority: dim, historical_consistency: dim }, most_vulnerable: 'historical_consistency' },
};
const brief = { currentProposition: line, source: 'Signed client brief', sourceDate: '2026-10-30', suppliedBy: 'Client CMO', derivationLabel: 'Client-supplied' as const, currentTerritory: 'Craft', strategyOwner: 'CMO', strategyDate: null, priorDecisions: '', knownThreats: '', decisionQuestions: ['Keep, refresh or replace?'], evidenceStandard: 'Source-level' };
const SID = '11111111-1111-4111-8111-111111111111';
const COMPARATOR_A = 'Generated comparator line A', COMPARATOR_B = 'Generated comparator line B';

function seed(best: number) {
  db.sessions = [{ id: SID, brand_name: 'Marlowe Motor Company', category: 'automotive', locked_at: '2026-11-01', validate_brief: brief, test_copy_of: null, brief_versions: null,
    checkpoint_a_confirmed: true, checkpoint_b_confirmed: true, checkpoint_c_confirmed: true,
    stage_10_structured: { scores: [{ smp: COMPARATOR_A, composite: best, code_verdict: 'PASS' }, { smp: COMPARATOR_B, composite: 50, code_verdict: 'PASS' }, { smp: line, composite: 99, is_current: true }] } }];
  db.run_output_versions = [{ run_table: 'sessions', run_id: SID, created_at: '2026-11-01T00:00:00Z' }];
  db.current_position_addon_jobs = [{ id: 'job-1', session_id: SID, status: 'complete', published_version: 2, proposition: line, results, actor_id: 'actor', entry_path: 'new',
    source_manifest: { subject_brand: 'Marlowe Motor Company', derivation_label: 'Client-supplied', evidence: [] } }];
  rpcCalls.length = 0;
}
async function bothRoutes() {
  await assembleValidateAssessment(client() as never, { sessionId: SID, version: 2, subjectBrand: 'Marlowe Motor Company', brief }, 'actor');
  await assembleNewRunAssessment('job-1');
  const [a, b] = rpcCalls.map(c => c.args as { _outputs: Record<string, { data: Row }>; _entry: string });
  return { a, b };
}

describe('Validate route parity (real entry functions)', () => {
  beforeEach(() => seed(70));
  it('add-on and new-run routes give the same verdict and reasons on the same inputs', async () => {
    const { a, b } = await bothRoutes();
    expect(a._entry).toBe('addon'); expect(b._entry).toBe('new');
    expect(a._outputs['validate.verdict'].data).toEqual(b._outputs['validate.verdict'].data);
    expect(a._outputs['validate.verdict'].data.verdict).toBe('KEEP');
  });
  it('parity holds for REFRESH at a 10-of-90 comparator gap', async () => {
    seed(73);
    const { a, b } = await bothRoutes();
    expect(a._outputs['validate.verdict'].data.verdict).toBe('REFRESH');
    expect(b._outputs['validate.verdict'].data).toEqual(a._outputs['validate.verdict'].data);
  });
  it('a different subject brand gets no comparators and is INSUFFICIENT EVIDENCE on both routes', async () => {
    seed(70); (db.sessions[0] as Row).brand_name = 'Another brand';
    const { a, b } = await bothRoutes();
    expect(a._outputs['validate.verdict'].data.verdict).toBe('INSUFFICIENT EVIDENCE');
    expect(b._outputs['validate.verdict'].data).toEqual(a._outputs['validate.verdict'].data);
  });
});

describe('Comparators are never recommendations', () => {
  beforeEach(() => seed(70));
  it('the current-position record is excluded and every comparator is flagged non-recommendation', () => {
    const c = comparatorsFromRun(db.sessions[0]);
    expect(c.map(x => x.smp)).toEqual([COMPARATOR_A, COMPARATOR_B]);
    expect(c.every(x => x.role === 'comparator' && x.is_recommendation === false && x.note === COMPARATOR_NOTE)).toBe(true);
  });
  it('comparators appear only as evidence, never in the verdict, current position or pressure tests', async () => {
    const { a } = await bothRoutes();
    for (const id of ['validate.verdict', 'validate.current_position', 'validate.pressure_tests']) {
      expect(JSON.stringify(a._outputs[id])).not.toContain(COMPARATOR_A);
    }
    expect(a._outputs['validate.current_position'].data.proposition).toBe(line);
    const comp = a._outputs['validate.evidence_gaps'].data.comparators as { items: { is_recommendation: boolean }[] };
    expect(comp.items).toHaveLength(2);
    expect(comp.items.every(i => i.is_recommendation === false)).toBe(true);
  });
  it('the Validate diagnostic document labels candidates as comparators, not propositions under test', () => {
    const doc = buildDiagnosticValuation({ brand_name: 'B', category: 'C', selected_smp: COMPARATOR_A, validate_brief: brief });
    expect(doc).not.toMatch(/proposition under test/i);
    expect(doc).toContain('Comparator (evidence only, not a recommendation)');
    // Campaign/Deal diagnostic wording unchanged.
    const plain = buildDiagnosticValuation({ brand_name: 'B', category: 'C', selected_smp: COMPARATOR_A });
    expect(plain).toMatch(/proposition under test/i);
    expect(comparatorWording('Proposition under test')).toBe('Comparator (evidence only, not a recommendation)');
  });
});
