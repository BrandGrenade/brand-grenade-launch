// Scannable Executive Summary (register #41): a Stage 16 document ASSEMBLED
// deterministically from stored run outputs. No model call, no writes: every
// sentence is condensed (whole sentences or clauses) from a saved output and
// carries its source stage. Missing data renders as MISSING, never invented.
import { z } from 'zod';
import { UNIVERSAL_BANNED_STAGE9 } from './stage9-banned-words';
import { findBannedWordHits } from './output-banned-word-gate';

export const EXEC_SUMMARY_OUTPUT = 'stage16.executive_summary' as const;
export const EXEC_SUMMARY_SCHEMA = 'stage16.executive_summary.v1' as const;
export const MISSING = 'Not available in this run';
export const NOT_IN_TYPE = 'Not in this run type';
export const SECTION_MAX_WORDS = 70;
export const DOC_MAX_WORDS = 900;
export const TITLES = ['The Challenge', 'What We Found', 'The Process, In Brief', 'The Shortlist', 'The Recommendation', 'Why This Wins', 'The Proof, At A Glance', 'The Brand World', 'The Next Step'] as const;

type Row = Record<string, unknown>;
export type ExecInputs = {
  runId: string; version: number; brand: string;
  runMode: 'full' | 'diagnostic';
  stage1: string | null;
  stage9Ranking: number | null;
  locEngines: number | null;
  stage10: Row | null; stage11: Row | null; stage12: Row | null; stage13: Row | null;
  selectedSmp: string | null;
  selectionRationale: Row | null;
  stage22Architecture: Row | null; stage22Assets: Row | null;
  /** Saved validate.* outputs at this version, used when the summary is the Validate variant. */
  validate: Row | null;
};

const SectionSchema = z.object({
  number: z.number().int().min(1).max(9), title: z.string(), status: z.enum(['ok', 'not_available', 'not_in_run_type']),
  body: z.string().min(1), items: z.array(z.object({ label: z.string(), text: z.string(), role: z.string() })).optional(),
  table: z.array(z.object({ measure: z.string(), value: z.string(), source: z.string() })).optional(), sources: z.array(z.string()),
});
export const ExecutiveSummarySchema = z.object({
  schema_version: z.literal(EXEC_SUMMARY_SCHEMA), run_id: z.string().uuid(), version: z.number().int().min(1), brand: z.string(),
  variant: z.enum(['full', 'diagnostic', 'validate']), notes: z.array(z.string()),
  sections: z.array(SectionSchema).length(9), word_count: z.number().int().max(DOC_MAX_WORDS),
  gates: z.object({ banned_words: z.array(z.string()), numbers_checked: z.number().int(), language: z.literal('en-AU') }),
});
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
type Section = z.infer<typeof SectionSchema>;

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const plain = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/^>\s*/gm, '').replace(/\s+/g, ' ').trim();
function sentences(s: string): string[] { return (plain(s).match(/[^.!?]+[.!?]+(?:["'’”)]+)?|[^.!?]+$/g) ?? []).map(x => x.trim()).filter(Boolean); }
/** Whole sentences up to the word budget; a first sentence over budget is cut at a clause boundary. */
export function condense(s: string | null, max = SECTION_MAX_WORDS, maxSentences = 3): string | null {
  if (!s) return null;
  const out: string[] = [];
  for (const x of sentences(s).slice(0, maxSentences)) { if (words([...out, x].join(' ')) > max) break; out.push(x); }
  if (out.length) return out.join(' ');
  const first = sentences(s)[0] ?? plain(s);
  const clause = first.split(/\s[—–;]\s|;\s/)[0];
  if (words(clause) <= max) return clause.replace(/[,:]$/, '') + '.';
  return first.split(/\s+/).slice(0, max).join(' ') + '…';
}
function mdSection(md: string | null, heading: RegExp): string | null {
  if (!md) return null;
  const lines = md.split('\n'); const i = lines.findIndex(l => /^#{1,4}\s/.test(l) && heading.test(l));
  if (i < 0) return null;
  const body: string[] = [];
  for (const l of lines.slice(i + 1)) { if (/^#{1,4}\s/.test(l)) break; if (l.trim() && l.trim() !== '---') body.push(l); }
  return body.join('\n').trim() || null;
}
const sec = (number: number, body: string | null, sources: string[], extra: Partial<Section> = {}, missing: 'not_available' | 'not_in_run_type' = 'not_available'): Section =>
  body ? { number, title: TITLES[number - 1], status: 'ok', body, sources, ...extra }
       : { number, title: TITLES[number - 1], status: missing, body: missing === 'not_in_run_type' ? NOT_IN_TYPE : MISSING, sources: [] };
const scoreOf = (r: Row | undefined, k: string) => { const v = (r?.[k] as Row | undefined)?.score; return typeof v === 'number' ? v : null; };

export function isValidateVariant(row: Row, validateOutputs: Row | null): boolean {
  if (row.validate_brief) return !!validateOutputs;
  // Same-brand add-on assessment at this version: the summary concerns the current strategy.
  const brand = str(validateOutputs?.__subject_brand);
  return !!brand && brand.toLowerCase() === String(row.brand_name ?? '').trim().toLowerCase();
}

export function buildExecutiveSummary(inp: ExecInputs): { record: ExecutiveSummary; text: string } {
  const validate = inp.validate;
  const variant: ExecutiveSummary['variant'] = validate ? 'validate' : inp.runMode === 'diagnostic' ? 'diagnostic' : 'full';
  const notes = new Set<string>();
  if (validate) for (const o of Object.values(validate)) for (const n of ((o as Row)?.notes as string[] | undefined) ?? []) notes.add(n);
  const scores = ((inp.stage10?.scores as Row[] | undefined) ?? []).filter(s => s.is_current !== true);
  const blocks = (inp.stage11?.blocks as Row[] | undefined) ?? [];
  const cards = (inp.stage12?.propositions as Row[] | undefined) ?? [];
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
  const winner = inp.selectedSmp;
  const s10w = scores.find(s => norm(s.smp) === norm(winner));
  const cardW = cards.find(c => norm(c.smp) === norm(winner));
  const derived = new Set<string>();

  // (1) Challenge — Stage 1 surface request + governing tension (anchored from the Briefing Room).
  const req = condense(mdSection(inp.stage1, /Surface Request/i), 40, 1);
  const tension = condense(mdSection(inp.stage1, /Underlying Strategic Problem/i), 45, 1);
  const s1 = req || tension ? [req, tension && `Governing tension: ${tension}`].filter(Boolean).join(' ') : null;
  // (2) Finding — Stage 1 human/cultural shift, the evidence the tension rests on.
  const s2 = condense(mdSection(inp.stage1, /Human \/ Cultural Shift|Cultural Shift/i), 60, 2);
  // (3) Process line.
  const generated = inp.stage9Ranking ?? (typeof inp.stage10?.smps_scored === 'number' ? inp.stage10.smps_scored as number : null);
  const tested = blocks.length || null;
  for (const n of [inp.locEngines, generated, tested, cards.length || null]) if (n !== null) derived.add(String(n));
  const s3 = generated || inp.locEngines ? [
    'Research', `methodologies and ${inp.locEngines ?? MISSING.toLowerCase()} lateral engines`,
    `${generated ?? MISSING.toLowerCase()} propositions generated`, `validation (Stage 10 scored, Stage 11 tested ${tested ?? '—'})`,
    validate ? 'one verdict on the current strategy' : 'one recommendation',
  ].join(' → ') : null;

  // (4) Shortlist / comparators.
  let s4: Section;
  if (validate) {
    const gaps = (validate['validate.evidence_gaps'] as Row | undefined)?.data as Row | undefined;
    const items = ((gaps?.comparators as Row | undefined)?.items as Row[] | undefined) ?? [];
    const top = [...items].sort((a, b) => Number(b.composite) - Number(a.composite)).slice(0, 5);
    s4 = sec(4, top.length ? 'Comparators only: generated for the best-alternative test, shown as evidence, never as a recommendation.' : null, ['validate.evidence_gaps', 'Stage 10'], {
      items: top.map(c => ({ label: String(c.smp), text: `Comparator. Stage 10 composite ${c.composite}/90${c.code_verdict ? `, ${c.code_verdict}` : ''}.`, role: 'comparator' })),
    });
  } else {
    const pool = (cards.length ? cards : scores).slice(0, 5);
    s4 = sec(4, pool.length >= 1 ? `${pool.length} propositions seriously considered.` : null, ['Stage 12', 'Stage 10', 'Stage 11'], {
      items: pool.map(c => {
        const sc = scores.find(s => norm(s.smp) === norm(c.smp)); const bl = blocks.find(b => norm(b.smp) === norm(c.smp));
        const isW = norm(c.smp) === norm(winner);
        const what = condense(str(c.owns) ?? str(sc?.code_verdict_reason), 30, 1) ?? MISSING;
        const why = isW ? 'Selected.' : `Set aside: Stage 10 composite ${sc?.composite ?? MISSING.toLowerCase()}/90${s10w ? ` against ${s10w.composite}/90 for the recommendation` : ''}; Stage 11 ${bl?.verdict ?? MISSING.toLowerCase()}.`;
        return { label: String(c.smp), text: `${what} ${why}`, role: isW ? 'recommendation' : 'considered' };
      }),
    });
  }

  // (5) Recommendation or verdict.
  let s5: Section;
  if (validate) {
    const v = (validate['validate.verdict'] as Row | undefined)?.data as { verdict?: string; reasons?: { code: string }[] } | undefined;
    const prop = str(((validate['validate.current_position'] as Row | undefined)?.data as Row | undefined)?.proposition);
    s5 = sec(5, v?.verdict ? `Validate verdict: ${v.verdict}. Current strategy: "${prop ?? MISSING}". Reason codes: ${(v.reasons ?? []).map(r => r.code).join('; ') || 'none recorded'}.` : null, ['validate.verdict', 'validate.current_position']);
  } else {
    s5 = sec(5, winner ? `"${winner}"${str(cardW?.field_name) ? ` (${cardW!.field_name})` : ''}.` : null, ['Stage 12 selection']);
  }

  // (6) Why this wins.
  let s6: Section;
  if (validate) {
    const v = (validate['validate.verdict'] as Row | undefined)?.data as { reasons?: { code: string; evidence: unknown }[] } | undefined;
    const first = v?.reasons?.[0]; const ev = first?.evidence as Row | undefined;
    const t = str(ev?.justification) ?? str(ev?.exposure) ?? str(ev?.note) ?? (typeof first?.evidence === 'string' ? first.evidence : null);
    s6 = sec(6, first ? `Why this verdict: ${first.code}. ${condense(t, 50, 2) ?? ''}`.trim() : null, ['validate.verdict']);
  } else {
    const resolves = condense(str(inp.selectionRationale?.f2) ?? str(inp.selectionRationale?.f1), 25, 1);
    const truth = condense(str(cardW?.truth), 25, 1);
    const ci = condense(str((s10w?.competitive_impossibility as Row | undefined)?.justification), 25, 1);
    const parts = [resolves && `Tension it resolves: ${resolves}`, truth && `True of this brand: ${truth}`, ci && `Why a competitor could not say it: ${ci}`].filter(Boolean);
    s6 = sec(6, parts.length ? parts.join(' ') : null, ['Stage 12 rationale', 'Stage 12 card', 'Stage 10']);
  }

  // (7) Proof table.
  const base = validate ? (((validate['validate.current_position'] as Row | undefined)?.data as Row | undefined)?.stage10 as Row | undefined) : s10w;
  const asset = ((inp.stage22Assets?.recommended_assets as Row[] | undefined) ?? [])[0];
  const ciS = scoreOf(base, 'competitive_impossibility'), caS = scoreOf(base, 'clean_air');
  const table = [
    { measure: 'Stage 10 score', value: typeof base?.composite === 'number' ? `${base.composite}/90` : MISSING, source: 'Stage 10' },
    { measure: 'Distinctive asset in play', value: asset ? `${asset.asset}${asset.type ? ` (${asset.type})` : ''}` : inp.runMode === 'diagnostic' ? NOT_IN_TYPE : MISSING, source: 'Stage 22' },
    { measure: 'Competitive impossibility', value: ciS !== null ? `${ciS}/10${str((base?.competitive_impossibility as Row).competitor) ? ` — nearest: ${(base!.competitive_impossibility as Row).competitor}` : ''}` : MISSING, source: 'Stage 10' },
    { measure: 'Clean air', value: caS !== null ? `${caS}/10${str((base?.clean_air as Row).occupier) ? ` — nearest occupier: ${(base!.clean_air as Row).occupier}` : ''}` : MISSING, source: 'Stage 10' },
  ];
  const s7 = sec(7, base || asset ? 'At a glance:' : null, ['Stage 10', 'Stage 22'], { table });

  // (8) Brand world.
  const arch = inp.stage22Architecture;
  const s8 = inp.runMode === 'diagnostic' && !arch ? sec(8, null, [], {}, 'not_in_run_type') : sec(8, arch ? [
    `${str(arch.domain) ?? ''}${Array.isArray(arch.values) ? `, held by ${(arch.values as string[]).join(', ').toLowerCase()}` : ''}.`,
    (arch.personality as Row | undefined)?.words ? `Personality: ${(arch.personality as Row).words}.` : '',
    Array.isArray(arch.assets) ? `Assets: ${(arch.assets as string[]).slice(0, 4).join('; ')}.` : '',
  ].filter(Boolean).join(' ') : null, ['Stage 22']);

  // (9) Next step.
  let s9: Section;
  if (validate) {
    const q = ((validate['validate.verdict'] as Row | undefined)?.decision_questions as string[] | undefined)?.[0];
    const own = str(((validate['validate.current_position'] as Row | undefined)?.data as Row | undefined)?.supplied_by);
    s9 = sec(9, q ? `Decision: ${q} By: ${own ?? MISSING}.${notes.size ? ` ${[...notes].join(' ')}.` : ''}` : null, ['validate.verdict', 'validate.current_position']);
  } else {
    const c = ((inp.stage13?.commitments as unknown[] | undefined) ?? [])[0];
    const t = typeof c === 'string' ? c : str((c as Row | undefined)?.what);
    s9 = sec(9, t ? `${condense(t, 45, 2)} By: ${MISSING}.` : null, ['Stage 13 commitments']);
  }

  const sections = [sec(1, s1, ['Stage 1 (Briefing Room tension)']), sec(2, s2, ['Stage 1']), sec(3, s3, ['Stage 8B', 'Stage 9', 'Stage 10', 'Stage 11']), s4, s5, s6, s7, s8, s9];
  const text = render(inp.brand, variant, [...notes], sections);

  // Gates: banned words (outside verbatim quotes), invented numbers, length.
  const hits = findBannedWordHits({ text: text.replace(/"[^"]*"/g, ''), terms: UNIVERSAL_BANNED_STAGE9, rule: 'universal', stageLabel: 'Stage 16', columnLabel: EXEC_SUMMARY_OUTPUT }).map(h => h.match);
  const corpus = JSON.stringify(inp);
  const nums = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const STRUCTURAL = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '16', '22', '90', '8B']);
  for (const n of nums) if (!STRUCTURAL.has(n) && !derived.has(n) && !corpus.includes(n)) throw new Error(`EXEC_SUMMARY_INVENTED_NUMBER: ${n}`);
  const record = ExecutiveSummarySchema.parse({ schema_version: EXEC_SUMMARY_SCHEMA, run_id: inp.runId, version: inp.version, brand: inp.brand, variant, notes: [...notes], sections, word_count: words(text), gates: { banned_words: hits, numbers_checked: nums.length, language: 'en-AU' } });
  return { record, text };
}

function render(brand: string, variant: string, notes: string[], sections: Section[]) {
  const out = [`# ${brand} — Executive Summary`, variant === 'validate' ? '_Validate run: verdict on the current strategy; generated propositions are comparators only._' : ''];
  for (const n of notes) out.push(`> **${n}**`);
  for (const s of sections) {
    out.push(`\n## ${s.number}. ${s.title}`, s.body);
    for (const i of s.items ?? []) out.push(`- **${i.role === 'comparator' ? 'Comparator — ' : ''}"${i.label}"** ${i.text}`);
    if (s.table) { out.push('', '| Measure | Value | Source |', '|---|---|---|'); for (const r of s.table) out.push(`| ${r.measure} | ${r.value.replace(/\|/g, '/')} | ${r.source} |`); }
    if (s.sources.length) out.push(`_Source: ${s.sources.join(', ')}_`);
  }
  return out.filter(x => x !== '').join('\n');
}
