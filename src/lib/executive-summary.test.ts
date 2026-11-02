import { describe, it, expect } from 'vitest';
import { buildExecutiveSummary, condense, explainReason, ExecutiveSummarySchema, MISSING, NOT_IN_TYPE, DOC_MAX_WORDS, SECTION_MAX_WORDS, isValidateVariant, assertNoInventedNumbers, type ExecInputs } from './executive-summary';
import { CONTRACTS } from './access/contracts';

const dim = (score: number, extra: Record<string, unknown> = {}) => ({ score, justification: 'Possible only through fundamental contradiction. Rivals are bound to their own heritage claims.', ...extra });
const score = (smp: string, composite: number) => ({ smp, field_name: 'F', composite, code_verdict: 'PASS', code_verdict_reason: 'PASS', competitive_impossibility: dim(8, { competitor: 'Rival Motors' }), clean_air: dim(7, { occupier: 'Other Co' }) });
const long = 'Marlowe asks for one standard across a split range. '.repeat(40);
const stage1 = `## Section 1 — Surface Request\n\n${long}\n\n## Section 2 — Underlying Strategic Problem\n\n> "The house promises one standard (3). The standard is set by a car nobody can own."\n\nMore.\n\n## Section 3 — Human / Cultural Shift\n\nBuyers affiliate before they purchase: 12,000 registered interest. Second sentence here.\n`;
const base = (): ExecInputs => ({
  runId: '11111111-1111-1111-1111-111111111111', version: 4, brand: 'Marlowe Motor Company', runMode: 'full', stage1, stage9Ranking: 6, locEngines: 13,
  stage10: { smps_scored: 6, scores: [score('Built to be kept.', 71.5), score('Every road, one house.', 60), score('Quiet power.', 55)] },
  stage11: { blocks: [{ smp: 'Built to be kept.', verdict: 'VALIDATED' }, { smp: 'Every road, one house.', verdict: 'VALIDATED — EXPOSED' }, { smp: 'Quiet power.', verdict: 'ELIMINATED' }] },
  stage12: { propositions: [{ smp: 'Built to be kept.', field_name: 'Keeping', owns: 'Ownership as the product.', truth: 'Marlowe services every car for life.' }, { smp: 'Every road, one house.', owns: 'Range coherence.' }, { smp: 'Quiet power.', owns: 'Restraint.' }] },
  stage13: { commitments: ['Publish the service standard. Then hold to it.'] }, selectedSmp: 'Built to be kept.', selectionRationale: { f2: 'Credibility. It answers the merger question.' },
  stage22Architecture: { domain: 'Premium automotive', values: ['Reserve', 'Candour'], assets: ['Hands first'], personality: { words: 'Unhurried' } },
  stage22Assets: { recommended_assets: [{ asset: 'Hands before names', type: 'Visual' }] }, validate: null,
});
const validateOutputs = () => ({
  'validate.verdict': { notes: ['Confirm with client before relying on this verdict'], decision_questions: ['Keep, refresh or replace?'], data: { verdict: 'REFRESH', reasons: [{ code: 'CREDIBILITY_AT_OR_BELOW_5', evidence: { justification: 'No car on sale.' } }] } },
  'validate.current_position': { notes: ['Confirm with client before relying on this verdict'], data: { proposition: 'Made to last.', stage10: { composite: 64, competitive_impossibility: dim(6, { competitor: 'Rival Motors' }), clean_air: dim(8) } } },
  'validate.evidence_gaps': { data: { comparators: { items: [{ smp: 'Built to be kept.', composite: 71.5, code_verdict: 'PASS', role: 'comparator' }, { smp: 'Quiet power.', composite: 55, code_verdict: 'PASS', role: 'comparator' }] } } },
});

describe('Executive Summary (stage16.executive_summary)', () => {
  it('assembles nine sections from stored outputs only, each with its source stage, deterministically', () => {
    const a = buildExecutiveSummary(base()), b = buildExecutiveSummary(base());
    expect(a).toEqual(b);
    expect(a.record.sections.map(s => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const s of a.record.sections.filter(s => s.status === 'ok')) expect(s.sources.length).toBeGreaterThan(0);
    expect(a.text).toContain('"Built to be kept."');
    expect(a.text).toContain('71.5/90');
    expect(a.text).toContain('The standard is set by a car nobody can own.');
    expect(a.record.sections[3].items!.find(i => i.label === 'Quiet power.')!.text).toContain('Set aside: Stage 10 composite 55/90 against 71.5/90');
  });
  it('shows "Not available in this run" for every missing section, never invented content', () => {
    const r = buildExecutiveSummary({ ...base(), stage1: null, stage9Ranking: null, locEngines: null, stage10: null, stage11: null, stage12: null, stage13: null, selectedSmp: null, selectionRationale: null, stage22Architecture: null, stage22Assets: null });
    for (const s of r.record.sections) expect(s.body).toBe(MISSING);
    expect(r.text).not.toMatch(/\d{2,}/);
  });
  it('holds section and document length limits on long stored text', () => {
    const r = buildExecutiveSummary(base());
    for (const s of r.record.sections) expect(s.body.split(/\s+/).length).toBeLessThanOrEqual(SECTION_MAX_WORDS);
    expect(r.record.word_count).toBeLessThanOrEqual(DOC_MAX_WORDS);
    expect(r.record.sections[3].items!.length).toBeLessThanOrEqual(5);
  });
  it('rejects an invented number with a named error', () => {
    expect(() => assertNoInventedNumbers('Composite 71.5/90 and 4242 buyers', JSON.stringify(base()))).toThrow('EXEC_SUMMARY_INVENTED_NUMBER: 4242');
    expect(assertNoInventedNumbers('Composite 71.5/90', JSON.stringify(base()))).toEqual(['71.5', '90']);
  });
  it('Diagnostic run: sections needing later stages show "Not in this run type"', () => {
    const r = buildExecutiveSummary({ ...base(), runMode: 'diagnostic', stage22Architecture: null, stage22Assets: null });
    expect(r.record.variant).toBe('diagnostic');
    expect(r.record.sections[7].body).toBe(NOT_IN_TYPE);
    expect(r.record.sections[6].table?.find(t => t.measure === 'Proposed creative idea in play')?.value).toBe(NOT_IN_TYPE);
  });
  it('Validate run: verdict with reason codes replaces the recommendation, comparators labelled, client note carried', () => {
    const r = buildExecutiveSummary({ ...base(), validate: validateOutputs(), validateStrategyOwner: 'Marlowe board' });
    expect(r.record.variant).toBe('validate');
    expect(r.record.sections[4].body).toContain('Validate verdict: REFRESH');
    expect(r.record.sections[4].body).toContain('CREDIBILITY_AT_OR_BELOW_5');
    expect(r.record.sections[4].body).not.toContain('Built to be kept.');
    expect(r.record.sections[3].items!.every(i => i.role === 'comparator')).toBe(true);
    expect(r.text).toContain('Comparator — "Built to be kept."');
    expect(r.record.notes).toEqual(['Confirm with client before relying on this verdict']);
    expect(r.text).toContain('Confirm with client before relying on this verdict');
    expect(r.record.sections[8].body).toContain('By: Marlowe board');
  });
  it('Validate variant applies to a same-brand add-on or a Validate run, not a cross-brand add-on', () => {
    expect(isValidateVariant({ brand_name: 'Jaguar' }, { __subject_brand: 'Infiniti' })).toBe(false);
    expect(isValidateVariant({ brand_name: 'Copy', brief_versions: [{ fields: { brandName: 'JLR' } }] }, { __subject_brand: 'JLR' })).toBe(true);
    expect(isValidateVariant({ brand_name: 'X', validate_brief: {} }, { __subject_brand: 'X' })).toBe(true);
    expect(isValidateVariant({ brand_name: 'X' }, null)).toBe(false);
  });
  it('satisfies the versioned access contract', () => {
    const built = buildExecutiveSummary(base());
    expect(ExecutiveSummarySchema.safeParse(built.record).success).toBe(true);
    const c = CONTRACTS.find(x => x.output_id === 'stage16.executive_summary')!;
    expect(c.schema_version).toBe('stage16.executive_summary.v1');
    expect(c.content!.safeParse(built).success).toBe(true);
    for (const f of ['agency', 'consulting', 'workshop', 'vision', 'valuation']) expect(CONTRACTS.find(x => x.output_id === `stage16.${f}`)!.schema_version).toBe('stage16.document.v1');
  });
  it('never cuts long sentences or emits unfinished trailing fragments', () => {
    expect(condense('A complete sentence. An unfinished fragment', 100, 3)).toBe('A complete sentence.');
    expect(condense('A sentence with far too many words to fit.', 3)).toBeNull();
    expect(condense('A complete sentence; with a clause that is still part of it.', 5)).toBeNull();
  });
  it('asks the Validate question with its source instead of the Campaign tension', () => {
    const v = validateOutputs();
    v['validate.current_position'].data = { ...v['validate.current_position'].data, source_kind: 'owner-stated', source: 'Official statement', source_date: '2024-11-19' } as typeof v['validate.current_position']['data'];
    const r = buildExecutiveSummary({ ...base(), validate: v, validateSubjectBrand: 'Marlowe Motor Company' });
    expect(r.record.sections[0].body).toContain('Is Made to last. still the right strategy for Marlowe Motor Company?');
    expect(r.record.sections[0].body).toContain('OWNER-STATED (PUBLIC)');
    expect(r.record.sections[0].body).not.toContain('Governing tension');
  });
  it('shows a repeated code once while explaining all dimensions with their exact scores', () => {
    const v = validateOutputs();
    v['validate.verdict'].data.reasons = [
      { code: 'CREDIBILITY_AT_OR_BELOW_5', evidence: { dimension: 'product_truth_alignment', score: 5, justification: 'No car on sale.' } },
      { code: 'CREDIBILITY_AT_OR_BELOW_5', evidence: { dimension: 'behavioural_capacity', score: 4, justification: 'The cost base is strained.' } },
    ];
    const r = buildExecutiveSummary({ ...base(), validate: v });
    expect(r.text.match(/CREDIBILITY_AT_OR_BELOW_5/g)).toHaveLength(1);
    expect(r.record.sections[5].items).toHaveLength(2);
    expect(r.text).toContain('product truth alignment scored 5/10');
    expect(r.text).toContain('behavioural capacity scored 4/10');
    expect(() => explainReason('UNRECOGNISED', {})).toThrow('EXEC_SUMMARY_REASON_UNSUPPORTED');
  });
  it('shows all six comparators, including an eliminated scored comparator and a missing-score explanation', () => {
    const v = validateOutputs();
    v['validate.evidence_gaps'].data.comparators.items = Array.from({ length: 6 }, (_, i) => ({ smp: `Comparator ${i + 1}.`, composite: 50 + i, code_verdict: i === 0 ? 'ELIMINATED' : 'PASS', role: 'comparator' }));
    const r = buildExecutiveSummary({ ...base(), validate: v, stage9: { propositions: [{ smp: 'Earlier candidate.' }] } });
    expect(r.record.sections[3].items).toHaveLength(7);
    expect(r.record.sections[3].items?.every(i => i.role === 'comparator')).toBe(true);
    expect(r.text).toContain('50/90, ELIMINATED');
    expect(r.text).toContain('No version-matched Stage 10 score is saved');
  });
  it('omits the Brand World and creative asset proof for a different strategy', () => {
    const r = buildExecutiveSummary({ ...base(), validate: validateOutputs() });
    expect(r.record.sections[7].body).toBe('Brand world not assessed for the current strategy');
    expect(r.text).not.toContain('Hands before names');
  });
  it('orders the selected proposition first, then the others by Stage 10 score', () => {
    const b = base();
    const r = buildExecutiveSummary({ ...b, stage12: { propositions: [...(b.stage12?.propositions as object[])].reverse() } });
    expect(r.record.sections[3].items?.map(i => i.label)).toEqual(['Built to be kept.', 'Every road, one house.', 'Quiet power.']);
  });
  it('labels proposed celebrity voices as creative ideas rather than owned assets', () => {
    const r = buildExecutiveSummary({ ...base(), stage22Architecture: { domain: 'Automotive', assets: ['Morgan Freeman narration'] } });
    expect(r.record.sections[7].body).toContain('Proposed creative ideas (not owned assets): Morgan Freeman narration');
  });
});
