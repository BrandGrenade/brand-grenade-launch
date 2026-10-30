import { z } from 'zod';
import { Stage10CurrentPositionSchema, Stage11CurrentPositionSchema, Stage13CurrentPositionSchema } from './structured-output';

export const VALIDATE_OUTPUTS = ['validate.verdict', 'validate.current_position', 'validate.pressure_tests', 'validate.evidence_gaps'] as const;
export const ValidateBriefSchema = z.object({
  currentProposition: z.string().trim().min(1), source: z.string().trim().min(1), sourceDate: z.string().nullable(), suppliedBy: z.string().trim().min(1),
  currentTerritory: z.string().trim().min(1), strategyOwner: z.string().trim().min(1), strategyDate: z.string().nullable(),
  priorDecisions: z.string(), knownThreats: z.string(), decisionQuestions: z.array(z.string().min(1)).min(1), evidenceStandard: z.string().trim().min(1),
});
export type ValidateBrief = z.infer<typeof ValidateBriefSchema>;
export type ValidateInputs = { sourceKind: 'client' | 'BG-derived' | 'unverified'; baseline: Record<string, unknown>; bestAlternativeComposite: number | null };
export type VerdictCode = 'INSUFFICIENT EVIDENCE' | 'REPLACE' | 'REFRESH' | 'KEEP';
export type Reason = { code: string; evidence: unknown };
const CRED = ['product_truth_alignment','audience_permission','tonal_compatibility','behavioural_capacity','cultural_authority','historical_consistency'] as const;

/** Shared by both entry paths. Do not change the underlying Stage 10/11 labels. */
export function validateVerdict(input: ValidateInputs): { verdict: VerdictCode; reasons: Reason[] } {
  const s10 = Stage10CurrentPositionSchema.safeParse(input.baseline['10']);
  const s11 = Stage11CurrentPositionSchema.safeParse(input.baseline['11']);
  const s13 = Stage13CurrentPositionSchema.safeParse(input.baseline['13']);
  const reasons: Reason[] = [];
  if (input.sourceKind !== 'client') reasons.push({code:'PROPOSITION_NOT_CLIENT_SUPPLIED', evidence:input.sourceKind});
  for (const [stage, parsed] of [['10',s10],['11',s11],['13',s13]] as const) {
    if (!parsed.success) reasons.push({code:`BASELINE_${stage}_MISSING_OR_INVALID`, evidence:parsed.error.issues.map(i=>({path:i.path,message:i.message}))});
  }
  const raw13 = input.baseline['13'] as {credibility?: Record<string,{score?: unknown}>} | null;
  const unscored = CRED.filter(key => typeof raw13?.credibility?.[key]?.score !== 'number');
  if (unscored.length >= 2) reasons.push({code:'TWO_OR_MORE_CREDIBILITY_DIMENSIONS_UNSCORED', evidence:unscored});
  if (reasons.length || !s10.success || !s11.success || !s13.success) return {verdict:'INSUFFICIENT EVIDENCE', reasons};
  const floorsPass = s10.data.truth_strength.score >= 5 && s10.data.competitive_impossibility.score >= 6;
  const fatal = (['T1','T2','T3','T4'] as const).filter(k => s11.data.tests[k].result === 'CRACKS');
  if (!floorsPass && fatal.length) return {verdict:'REPLACE', reasons:[
    {code:'STAGE10_FLOOR_BREACHED', evidence:{truth:s10.data.truth_strength,competitive_impossibility:s10.data.competitive_impossibility}},
    {code:'FATAL_T1_T4_CRACK',evidence:fatal.map(k=>({test:k,...s11.data.tests[k]}))},
  ]};
  const gap = input.bestAlternativeComposite === null ? null : input.bestAlternativeComposite - s10.data.composite;
  if (floorsPass && gap !== null && gap >= 10) reasons.push({code:'COMPOSITE_GAP_AT_LEAST_10_OF_90', evidence:{baseline:s10.data.composite,best:input.bestAlternativeComposite,gap}});
  if (floorsPass && ['VALIDATED WITH STRATEGIC NOTE','VALIDATED — EXPOSED'].includes(s11.data.verdict)) reasons.push({code:'STAGE11_STRATEGIC_NOTE_OR_EXPOSED', evidence:{verdict:s11.data.verdict,note:s11.data.strategic_note,exposure:s11.data.exposure_note}});
  if (floorsPass) for (const k of CRED) if(s13.data.credibility[k].score <= 5) reasons.push({code:'CREDIBILITY_AT_OR_BELOW_5',evidence:{dimension:k,...s13.data.credibility[k]}});
  if(reasons.length) return {verdict:'REFRESH',reasons};
  if(floorsPass && s11.data.verdict === 'VALIDATED' && gap !== null && gap < 10) return {verdict:'KEEP',reasons:[{code:'FLOORS_AND_PRESSURE_TESTS_PASS',evidence:{stage10:s10.data.code_verdict,stage11:s11.data.verdict,gap,credibility:s13.data.credibility}}]};
  // The brief deliberately defines no verdict for a floor breach without fatal
  // cracks or a missing same-brand comparison. Never invent a KEEP/REFRESH.
  throw new Error(`VALIDATE_VERDICT_RULE_UNRESOLVED: ${JSON.stringify({floorsPass,stage11:s11.data.verdict,gap})}`);
}

export const ValidateOutputSchema = z.object({
  mode:z.literal('validate'), run_id:z.string().uuid(), run_version:z.number().int().min(1), decision_questions:z.array(z.string()),
  provenance:z.array(z.record(z.unknown())), confidence:z.object({strength_of_analysis:z.string(),agreement:z.string(),key_facts:z.string(),reversible_gaps:z.string()}),
  checkpoint_status:z.record(z.unknown()), limitations:z.array(z.string()), data:z.record(z.unknown()),
});
export function buildValidateOutputs(args: {runId:string; version:number; brief:ValidateBrief; input:ValidateInputs; provenance:Record<string,unknown>[]; checkpoints:Record<string,unknown>}) {
  const verdict=validateVerdict(args.input);
  const common={mode:'validate' as const,run_id:args.runId,run_version:args.version,decision_questions:args.brief.decisionQuestions,provenance:args.provenance,
    confidence:{strength_of_analysis:'Structured Stage 10/11/13 assessment under the saved rubrics; not independent verification.',agreement:'Stage-level agreement is recorded in reason evidence; no independent analyst consensus measured.',key_facts:args.input.sourceKind==='client'?'Client-supplied proposition; source claims retain their original labels.':'Current proposition is BG-derived or unverified, not client supplied.',reversible_gaps:verdict.reasons.filter(r=>/MISSING|UNSCORED|UNRESOLVED|NOT_CLIENT/.test(r.code)).map(r=>r.code).join('; ')||'Independent verification of saved claims may reverse the verdict.'},
    checkpoint_status:args.checkpoints,limitations:['No new propositions or creative work generated.','Saved evidence is not independently verified.','Cross-brand scores are not a valid best-alternative comparison.']};
  return Object.fromEntries(VALIDATE_OUTPUTS.map(id=>[id,ValidateOutputSchema.parse({...common,data:
    id==='validate.verdict'?verdict:id==='validate.current_position'?{proposition:args.brief.currentProposition,source:args.brief.source,source_date:args.brief.sourceDate,supplied_by:args.brief.suppliedBy,territory:args.brief.currentTerritory,stage10:args.input.baseline['10']??null}:
    id==='validate.pressure_tests'?{stage11:args.input.baseline['11']??null,stage13:args.input.baseline['13']??null}:
    {gaps:verdict.reasons.filter(r=>/MISSING|UNSCORED|UNRESOLVED|NOT_CLIENT/.test(r.code)),evidence_standard:args.brief.evidenceStandard}})]));
}