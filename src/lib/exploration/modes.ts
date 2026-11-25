import { z } from 'zod';
import { metadata } from '../access/foundations';
export const EXPLORATION_MODES = ['headroom', 'turnaround'] as const;
const text = z.string().trim().min(1).max(12000);
export const ExplorationBriefSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('headroom'), baselineJobId: z.string().uuid(), market: text, growthAmbition: text, timeHorizon: text, constraints: text, categoriesAndMarkets: text }),
  z.object({ mode: z.literal('turnaround'), baselineJobId: z.string().uuid(), market: text, performanceSymptoms: text, marketsAndChannels: text, knownCommercialFactors: text, partnerHypotheses: text }),
]);
export type ExplorationBrief = z.infer<typeof ExplorationBriefSchema>;
export const EXPLORATION_OUTPUTS = ['headroom.current', 'headroom.potential', 'headroom.conditions', 'headroom.risks', 'turnaround.classification', 'turnaround.root_causes', 'turnaround.fix_first', 'turnaround.non_brand_factors'] as const;
// Helpers are governed by the stage they feed, not their telemetry label.
export function explorationTargetStage(step: string): string {
  if (step === '9-loc' || step === '9-loc-validation') return '9';
  return step;
}
export function explorationModeRule(error: string, mode: string = 'exploration'): string | null {
  if (!error.includes('EXPLORATION_ENDS_AT_STAGE13')) return null;
  const label = mode === 'headroom' ? 'Headroom' : mode === 'turnaround' ? 'Turnaround' : 'exploration';
  return `Not part of a ${label} run. This run ends at Stage 13.`;
}
export function requireExplorationDecisions(stage:string,decisions:{A:boolean;B:boolean;C:boolean}) {
  const locPreparation = stage === '9-loc' || stage === '9-loc-validation';
  stage = explorationTargetStage(stage);
  if(!/^(?:0?[1-9]|1[0-3])(?:B)?$/i.test(stage)||/^13B$/i.test(stage))throw new Error('EXPLORATION_ENDS_AT_STAGE13');
  // LOC prepares the candidates reviewed at B; B gates Stage 9, not its inputs.
  const n=locPreparation ? 8 : Number.parseInt(stage,10);
  if(n>=2&&!decisions.A)throw new Error('Checkpoint A requires an explicit human decision');
  if(n>=9&&!decisions.B)throw new Error('Checkpoint B requires an explicit human decision');
  if(n>=13&&!decisions.C)throw new Error('Checkpoint C requires an explicit human decision');
}
export function modeFraming(brief: unknown, stage: string | undefined): string {
  if (stage) stage = explorationTargetStage(stage);
  if (!brief || !stage || !/^(?:0?[1-9]|1[0-3])(?:B)?$/i.test(stage)) return '';
  const b = ExplorationBriefSchema.parse(brief);
  return `\n[${b.mode.toUpperCase()} CONTEXT]\n${JSON.stringify(b)}\n${b.mode === 'headroom' ? 'Assess credible potential against the evidence-supported current position. Alternatives are exploratory, never approved/current positions. Consider white space, permission, associations, distinction, operational/commercial constraints, evidence and confidence. No new numerical selection score, revenue or dollar upside.' : 'Diagnose underperformance without assuming brand causation. Separate observed evidence, Partner-supplied hypotheses, modelled interpretations, supported conclusions and unresolved questions. Liked and bought require separate evidence; sales cannot prove liking and preference cannot prove purchases. Flag commercial issues for the right team; brand fixes cannot substitute.'}\nStages 14+ and Creative are excluded. Checkpoints A/B/C remain explicit human decisions. Stage 12 selection is exploratory evidence only, never an approved position.\n`;
}
export const DemandAxis = z.object({ established: z.boolean(), positive: z.boolean().nullable(), measure:z.enum(['preference','consideration','satisfaction','advocacy','purchase','transactions','penetration','volume']).nullable(), evidence_refs: z.array(text), period: text.nullable(), confidence: z.enum(['high','medium','low','insufficient']) });
export function demandClassification(liked: z.infer<typeof DemandAxis>, bought: z.infer<typeof DemandAxis>) {
  const supported = (a: z.infer<typeof DemandAxis>) => a.established && a.positive !== null && a.evidence_refs.length > 0 && !!a.period && a.confidence !== 'insufficient';
  if (!supported(liked) || !supported(bought)||!['preference','consideration','satisfaction','advocacy'].includes(liked.measure??'')||!['purchase','transactions','penetration','volume'].includes(bought.measure??'')||liked.evidence_refs.some(r=>bought.evidence_refs.includes(r))) return 'Insufficient evidence';
  return liked.positive ? bought.positive ? 'liked and bought' : 'liked, not bought' : bought.positive ? 'bought, not liked' : 'neither';
}
const refs = z.array(text);
const finding = z.object({ type: z.enum(['brand problem','commercial problem','evidence problem','mixed']), observed_evidence: refs, partner_hypothesis: text.nullable(), modelled_interpretation: text.nullable(), supported_conclusion: text.nullable(), unresolved_question: text.nullable(), supported_causes: refs, contributing_factors: refs, evidence_refs: refs, team: text.nullable(), brand_fix: text.nullable(), priority: text });
export const HeadroomResult = z.object({ alternatives: z.array(z.object({ position: text, disposition: z.enum(['selected','rejected','consideration']), reasons: refs, evidence_refs: refs })).min(1), band: z.enum(['constrained','moderate','substantial','transformational']), band_reasons: refs.min(1), white_space_and_permission: refs, conditions: refs.min(1), risks: refs, evidence_refs: refs, confidence: text, limitations: refs });
export const TurnaroundResult = z.object({ classifications: z.array(z.object({ market: text, liked: DemandAxis, bought: DemandAxis })), findings: z.array(finding).min(1), evidence_refs: refs, confidence: text, limitations: refs });
export function buildModeOutputs(a: { brief: ExplorationBrief; runId: string; version: number; brandId: string; market: string; baseline: unknown; result: unknown; projections: unknown[]; createdAt: string; checkpoints: { A: boolean; B: boolean; C: boolean };allowedEvidence?:string[] }) {
  if (!a.checkpoints.A || !a.checkpoints.B || !a.checkpoints.C) throw new Error('EXPLORATION_CHECKPOINT_NOT_CONFIRMED');
  let values: Record<string, unknown>;
  const result = a.brief.mode === 'headroom' ? HeadroomResult.parse(a.result) : TurnaroundResult.parse(a.result);
  if(a.allowedEvidence){
    const allowed=new Set(a.allowedEvidence);
    const visit=(v:unknown):void=>{if(!v||typeof v!=='object')return;for(const [k,item] of Object.entries(v)){if(k==='evidence_refs'&&Array.isArray(item)&&item.some(ref=>typeof ref!=='string'||!allowed.has(ref)))throw new Error('EXPLORATION_EVIDENCE_REF_NOT_SAVED');if(typeof item==='object')visit(item);}};
    visit(result);
  }
  if (a.brief.mode === 'headroom') {
    const h = HeadroomResult.parse(result);
    if (h.alternatives.filter(x => x.disposition === 'selected').length !== 1) throw new Error('HEADROOM_SELECTION_AMBIGUOUS');
    values = { 'headroom.current': { baseline: a.baseline, basis: 'evidence-supported' }, 'headroom.potential': { ...h, projections: a.projections, basis: 'modelled', approved_position: false, disclaimer: 'This can inform value-creation planning; it is not a forecast.' }, 'headroom.conditions': { conditions: h.conditions }, 'headroom.risks': { risks: h.risks } };
  } else {
    const t = TurnaroundResult.parse(result);
    for (const f of t.findings) {
      if ((f.supported_causes.length||f.supported_conclusion) && (!f.evidence_refs.length||!f.observed_evidence.length)) throw new Error('TURNAROUND_CAUSAL_EVIDENCE_MISSING');
      if (f.type === 'commercial problem' && (f.brand_fix || !f.team)) throw new Error('TURNAROUND_COMMERCIAL_TEAM_REQUIRED');
      if (f.type === 'evidence problem' && !f.unresolved_question) throw new Error('TURNAROUND_EVIDENCE_GAP_REQUIRED');
    }
    values = { 'turnaround.classification': { markets: t.classifications.map(c => ({ ...c, state: demandClassification(c.liked,c.bought) })) }, 'turnaround.root_causes': { findings: t.findings }, 'turnaround.fix_first': { findings: t.findings.map(f => ({ type: f.type, priority: f.priority, brand_fix: f.brand_fix, team: f.team })), projections: a.projections }, 'turnaround.non_brand_factors': { findings: t.findings.filter(f => f.type !== 'brand problem') } };
  }
  return Object.fromEntries(Object.entries(values).map(([id, data]) => [id, { data, provenance: result.evidence_refs, confidence: result.confidence, limitations: result.limitations, checkpoint_status: a.checkpoints,
    metadata: metadata({ analysis_type: id, brand_id: a.brandId, requested_market: a.brief.market, market: a.market, run_id: a.runId, run_version: a.version, strategy_version: a.version, method_version: 'exploration.v1', produced_at: a.createdAt, confidence: result.confidence, evidence_refs: result.evidence_refs, missing_inputs: [...result.limitations,...(a.market==='global'&&a.brief.market.toLowerCase()!=='global'?['market-specific baseline']:[])], status: 'complete' }) }]));
}