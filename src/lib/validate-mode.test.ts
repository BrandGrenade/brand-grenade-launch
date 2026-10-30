import { describe,it,expect } from 'vitest';
import { validateVerdict,buildValidateOutputs,VALIDATE_OUTPUTS,ValidateOutputSchema } from './validate-mode';
import fixture from './access/fixtures/jlr-access-contracts.json';

// Contract fixture has historical payloads; build concrete baseline records
// independently so ordered rule tests do not depend on model scoring.
const dim={score:7,justification:'Saved evidence'};
const base={status:'scored',line:'Existing promise',evidence_label:'Client-supplied',source:'Client',source_date:'2026-10-30',is_current:true,excluded_from_selection:true};
const make=()=>({sourceKind:'client' as const,bestAlternativeComposite:70,baseline:{
  '10':{...base,smp:'Existing promise',field_name:'Current',fame:dim,truth_strength:dim,competitive_impossibility:{...dim,competitor:'Rival',competitor_claim:'Saved claim'},brand_permission:{...dim,evidence:'Evidence'},clean_air:{...dim,occupier:'Rival',occupying_claim:'Claim'},commercial_precedent:{...dim,precedents:[]},composite:63,code_verdict:'PASS',code_verdict_reason:'',deltas:[]},
  '11':{...base,smp:'Existing promise',field_name:'Current',iconic_tier:false,tests:{T1:{result:'HOLDS',rationale:'Evidence'},T2:{result:'HOLDS',rationale:'Evidence'},T3:{result:'HOLDS',rationale:'Evidence'},T4:{result:'HOLDS',rationale:'Evidence'},T5:{result:'HOLDS',rationale:'Evidence',counter_line:'Rival',classification:'UNCERTAIN'},T6:{result:'HOLDS',rationale:'Evidence'},T7:{result:'HOLDS',rationale:'Evidence',misreading:'None',guard_rail:'Proof'},T8:{result:'N/A',rationale:null}},verdict:'VALIDATED',fatal:[],flags:[],exposure_note:null,strategic_note:null,rewrite:null,iconic_final:'N/A'},
  '13':{...base,credibility:{product_truth_alignment:dim,audience_permission:dim,tonal_compatibility:dim,behavioural_capacity:dim,cultural_authority:dim,historical_consistency:dim},most_vulnerable:'historical_consistency'},
}});
describe('Validate ordered verdicts',()=>{
  it('keeps floors >=5/6, VALIDATED, gap below 10 and credibility above 5',()=>expect(validateVerdict(make()).verdict).toBe('KEEP'));
  it('insufficient client provenance wins over replace',()=>{const v=make();v.baseline['10'].truth_strength={...dim,score:4};v.baseline['11'].tests.T1.result='CRACKS';expect(validateVerdict({...v,sourceKind:'BG-derived'}).verdict).toBe('INSUFFICIENT EVIDENCE');});
  it('missing baseline is insufficient',()=>{const v=make();expect(validateVerdict({...v,baseline:{'10':v.baseline['10'],'13':v.baseline['13']}}).verdict).toBe('INSUFFICIENT EVIDENCE');});
  it('two unscored credibility dimensions are insufficient',()=>{const v=make();expect(validateVerdict({...v,baseline:{...v.baseline,'13':{credibility:{}}}}).reasons.some(r=>r.code==='TWO_OR_MORE_CREDIBILITY_DIMENSIONS_UNSCORED')).toBe(true);});
  it('replaces truth below 5 plus fatal T1 crack',()=>{const v=make();v.baseline['10'].truth_strength={...dim,score:4};v.baseline['11'].tests.T1.result='CRACKS';expect(validateVerdict(v).verdict).toBe('REPLACE');});
  it('replaces competitive impossibility below 6 plus T4 crack',()=>{const v=make();v.baseline['10'].competitive_impossibility.score=5;v.baseline['11'].tests.T4.result='CRACKS';expect(validateVerdict(v).verdict).toBe('REPLACE');});
  it('refreshes at exactly 10 of 90 below best',()=>{expect(validateVerdict({...make(),bestAlternativeComposite:73}).verdict).toBe('REFRESH');});
  for(const verdict of ['VALIDATED — EXPOSED','VALIDATED WITH STRATEGIC NOTE'])it(`refreshes ${verdict}`,()=>{const v=make();v.baseline['11'].verdict=verdict;expect(validateVerdict(v).verdict).toBe('REFRESH');});
  it('refreshes credibility at 5',()=>{const v=make();v.baseline['13'].credibility.audience_permission={...dim,score:5};expect(validateVerdict(v).verdict).toBe('REFRESH');});
  it('same shared inputs yield entry-path parity',()=>{expect(validateVerdict(structuredClone(make()))).toEqual(validateVerdict(make()));});
  it('all four outputs satisfy versioned contracts',()=>{const outputs=buildValidateOutputs({runId:'cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f',version:97,brief:{currentProposition:'Existing promise',source:'Client',sourceDate:null,suppliedBy:'Owner',currentTerritory:'Territory',strategyOwner:'Owner',strategyDate:null,priorDecisions:'',knownThreats:'',decisionQuestions:['Keep?'],evidenceStandard:'Source-level evidence'},input:make(),provenance:[],checkpoints:{}});for(const id of VALIDATE_OUTPUTS)expect(ValidateOutputSchema.safeParse(outputs[id]).success).toBe(true);expect(fixture).toBeDefined();});
});