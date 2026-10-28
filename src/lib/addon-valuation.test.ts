import { describe, it, expect } from 'vitest';
import { buildAddonValuation } from './addon-valuation';
import { parseBaseline, INFINITI_PROPOSITION as line } from './current-position-addon';

const dim = { score: 7, justification: 'Exact saved evidence.' };
const ten = { smp: line, field_name: 'Infiniti', fame: dim, truth_strength: dim, competitive_impossibility: { ...dim, competitor: 'Lexus', competitor_claim: null }, brand_permission: { ...dim, evidence: null }, clean_air: { ...dim, occupier: 'Lexus', occupying_claim: null }, commercial_precedent: { ...dim, precedents: [] } };
const test = { result: 'HOLDS', rationale: 'Exact test evidence.' };
const eleven = { smp: line, field_name: 'Infiniti', iconic_tier: false, tests: { T1: test, T2: test, T3: test, T4: test, T5: { ...test, counter_line: 'Rival', classification: 'COMPETES-FOR-TERRITORY' }, T6: test, T7: { ...test, misreading: 'Misreading', guard_rail: 'Guard' }, T8: { result: 'N/A', rationale: null } }, verdict: 'VALIDATED', fatal: [], flags: [], exposure_note: null, strategic_note: null, rewrite: null, iconic_final: 'N/A' };
const thirteen = { credibility: Object.fromEntries(['product_truth_alignment', 'audience_permission', 'tonal_compatibility', 'behavioural_capacity', 'cultural_authority', 'historical_consistency'].map(k => [k, dim])), most_vulnerable: 'historical_consistency' };
const job = { status: 'complete', source_version: 96, published_version: 97, results: { '10': parseBaseline('10', JSON.stringify(ten), line, {}), '11': parseBaseline('11', JSON.stringify(eleven), line, {}), '13': parseBaseline('13', JSON.stringify(thirteen), line, {}) }, source_manifest: { source_runs: [{ run_id: '8ac87434-3bad-4921-b605-0b57acb26f54', version: 1 }], date_limitations: 'Dates unavailable' } };
const candidates = { scores: [{ ...ten, smp: 'Jaguar proposition', composite: 63 }] };

describe('v97 valuation assembly', () => {
  it('restates all three saved baselines and Jaguar scores without changing the previous Brief', () => {
    const original = '# VALUATION INPUT BRIEF\n\nDisclaimer\n\n# SECTION ONE\nExact v96 wording.';
    const document = buildAddonValuation(original, job, candidates);
    expect(document).toContain(line);
    expect(document).toContain('Source Brief: v96. Baseline assessments: v97.');
    expect(document).toContain('Stage 10 — current brand strength');
    expect(document).toContain('Stage 11 — durability');
    expect(document).toContain('Stage 13 — credibility');
    expect(document).toContain('Jaguar candidate: Jaguar proposition | 7 | 7 | 7 | 7 | 7 | 7 | 63');
    expect(document).toContain('# SECTION ONE\nExact v96 wording.');
    expect(original).toBe('# VALUATION INPUT BRIEF\n\nDisclaimer\n\n# SECTION ONE\nExact v96 wording.');
  });
  it('fails closed when any baseline is invalid or absent rather than using candidate scores', () => {
    expect(() => buildAddonValuation('Old Brief', { ...job, results: { ...job.results, '13': null } }, candidates)).toThrow();
    expect(() => buildAddonValuation('Old Brief', job, { scores: [] })).toThrow();
  });
});