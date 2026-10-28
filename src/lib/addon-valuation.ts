import { z } from 'zod';
import { Stage10CurrentPositionSchema, Stage11CurrentPositionSchema, Stage13CurrentPositionSchema } from './structured-output';

const dimensions = ['fame', 'truth_strength', 'competitive_impossibility', 'brand_permission', 'clean_air', 'commercial_precedent'] as const;
const titles = ['Fame', 'Truth Strength', 'Competitive Impossibility', 'Brand Permission', 'Clean Air', 'Commercial Precedent'];
const candidateSchema = z.object({ scores: z.array(z.object({ smp: z.string().min(1), composite: z.number(), ...Object.fromEntries(dimensions.map(k => [k, z.object({ score: z.number().int().min(1).max(10) })])) })).min(1) });
const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const title = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());

/** Assembly only: no model, no rescoring, and the source document remains verbatim. */
export function buildAddonValuation(original: string, job: Record<string, unknown>, candidates: unknown) {
  if (!original.trim() || job.status !== 'complete' || typeof job.published_version !== 'number') throw new Error('VALUATION_BASELINE_EVIDENCE_MISSING');
  const results = job.results as Record<string, unknown> | null;
  const ten = Stage10CurrentPositionSchema.parse(results?.['10']);
  const eleven = Stage11CurrentPositionSchema.parse(results?.['11']);
  const thirteen = Stage13CurrentPositionSchema.parse(results?.['13']);
  if (ten.line !== eleven.line || ten.line !== thirteen.line) throw new Error('VALUATION_BASELINE_PROPOSITION_MISMATCH');
  const scored = candidateSchema.parse(candidates).scores;
  const manifest = job.source_manifest as Record<string, unknown> | null;
  const sources = Array.isArray(manifest?.source_runs) ? manifest.source_runs as Record<string, unknown>[] : [];
  const baseline = [
    `# INFINITI CURRENT-POSITION BASELINE — v${job.published_version}`,
    `**Valuation Input Brief revision 2.** Source Brief: v${job.source_version}. Baseline assessments: v${job.published_version}.`,
    `**BG-derived / ${ten.evidence_label}; not an official verified Infiniti tagline.**`,
    `> ${ten.line}`,
    `This is Infiniti's assessed current position for the Jaguar × Infiniti buy-side comparison. The Jaguar propositions below are propositions under test — not Infiniti's current brand strength. This comparison is cross-brand, not a measured before/after uplift, and cannot support a monetary valuation or an automatic score delta.`,
    '## Sources and date limitations',
    ...sources.map(s => `- Saved research: ${s.run_id}, v${s.version}${s.snapshot_id ? `; snapshot ${s.snapshot_id}` : ''}.`),
    `Source quotation: ${String(manifest?.positioning_quote ?? 'See saved source manifest.')}`,
    String(manifest?.derivation_note ?? ''),
    `Publication dates: ${String(manifest?.date_limitations ?? 'Unavailable; saved dates are not source publication dates.')}`,
    '## Stage 10 — current brand strength',
    `Saved weighted composite: **${ten.composite}/90**. Saved verdict: **${ten.code_verdict}**. ${ten.code_verdict_reason}`,
    ...dimensions.map((k, i) => `### ${titles[i]} — ${ten[k].score}/10\n${ten[k].justification}`),
    '### Against the saved Jaguar propositions under test',
    '| Brand / proposition | Fame | Truth | Competitive impossibility | Brand permission | Clean air | Commercial precedent | Composite /90 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    `| Infiniti baseline: ${cell(ten.line)} | ${dimensions.map(k => ten[k].score).join(' | ')} | ${ten.composite} |`,
    ...scored.map(c => `| Jaguar candidate: ${cell(c.smp)} | ${dimensions.map(k => (c as Record<string, any>)[k].score).join(' | ')} | ${c.composite} |`),
    '## Stage 11 — durability of the Infiniti baseline',
    ...Object.entries(eleven.tests).map(([k, t]) => `### ${k} — ${t.result}\n${t.rationale ?? 'Not applicable in the saved assessment.'}${'counter_line' in t ? `\nCounter-line: ${t.counter_line}; classification: ${t.classification}.` : ''}${'misreading' in t ? `\nMisreading: ${t.misreading}\nGuard rail: ${t.guard_rail}` : ''}`),
    `**Separate proposition verdict: ${eleven.verdict}.**`,
    `Exposure: ${eleven.exposure_note ?? 'None separately recorded.'}`,
    `Flags: ${eleven.flags.join('; ') || 'None'}. Fatal results: ${eleven.fatal.join('; ') || 'None'}.`,
    '## Stage 13 — credibility of the Infiniti baseline',
    ...Object.entries(thirteen.credibility).map(([k, d]) => `### ${title(k)} — ${d.score}/10\n${d.justification}`),
    `Most vulnerable dimension: **${title(thirteen.most_vulnerable)}**.`,
    '# JAGUAR PROPOSITIONS UNDER TEST — PREVIOUS BRIEF ANALYSIS',
    'The following six sections retain the previous Brief exactly. They assess the Jaguar proposition, not Infiniti current brand strength. No Campaign scores, conclusions or wording have been changed.',
  ].join('\n\n');
  // Keep the original boundary disclaimer and reader guide before the add-on.
  const start = original.indexOf('\n# ', original.indexOf('\n# ') + 1);
  const firstSection = original.indexOf('\n# ');
  const at = firstSection >= 0 ? firstSection : start >= 0 ? start : original.length;
  return original.slice(0, at) + '\n\n' + baseline + '\n\n' + original.slice(at);
}