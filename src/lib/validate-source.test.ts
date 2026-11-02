import { describe,it,expect } from 'vitest';
import { validateVerdict,buildValidateOutputs,VALIDATE_OUTPUTS,effectiveDerivation,CONFIRM_WITH_CLIENT_NOTE,OWNER_STATED_GAP } from './validate-mode';
import { sourceKindOf } from './validate-run';

const dim={score:7,justification:'Saved evidence'};
const base={status:'scored',line:'P',evidence_label:'Unverified',source:'S',source_date:'2024-11-19',is_current:true,excluded_from_selection:true};
const make=(sourceKind:'client'|'owner-stated'|'BG-derived'|'unverified')=>structuredClone({sourceKind,bestAlternativeComposite:70,baseline:{
  '10':{...base,smp:'P',field_name:'Current',fame:dim,truth_strength:dim,competitive_impossibility:{...dim,competitor:'R',competitor_claim:'C'},brand_permission:{...dim,evidence:'E'},clean_air:{...dim,occupier:'R',occupying_claim:'C'},commercial_precedent:{...dim,precedents:[]},composite:63,code_verdict:'PASS',code_verdict_reason:'',deltas:[]},
  '11':{...base,smp:'P',field_name:'Current',iconic_tier:false,tests:{T1:{result:'HOLDS',rationale:'E'},T2:{result:'HOLDS',rationale:'E'},T3:{result:'HOLDS',rationale:'E'},T4:{result:'HOLDS',rationale:'E'},T5:{result:'HOLDS',rationale:'E',counter_line:'R',classification:'UNCERTAIN'},T6:{result:'HOLDS',rationale:'E'},T7:{result:'HOLDS',rationale:'E',misreading:'N',guard_rail:'G'},T8:{result:'N/A',rationale:null}},verdict:'VALIDATED',fatal:[],flags:[],exposure_note:null,strategic_note:null,rewrite:null,iconic_final:'N/A'},
  '13':{...base,credibility:{product_truth_alignment:dim,audience_permission:dim,tonal_compatibility:dim,behavioural_capacity:dim,cultural_authority:dim,historical_consistency:dim},most_vulnerable:'historical_consistency'},
}});
const brief={currentProposition:'P',source:'JLR Media, press release',sourceDate:'2024-11-19',sourceQuote:'Copy Nothing',suppliedBy:'Owner',currentTerritory:'T',strategyOwner:'JLR',strategyDate:null,priorDecisions:'',knownThreats:'',decisionQuestions:['Keep?'],evidenceStandard:'Source'};
const cite={proposition_source:'JLR Media',proposition_source_date:'2024-11-19',proposition_source_quote:'Copy Nothing'};

describe('Validate proposition source values',()=>{
  it('CLIENT-SUPPLIED can KEEP',()=>expect(validateVerdict(make('client')).verdict).toBe('KEEP'));
  it('OWNER-STATED (PUBLIC) can KEEP by the existing rules',()=>expect(validateVerdict(make('owner-stated')).verdict).toBe('KEEP'));
  it('OWNER-STATED (PUBLIC) can REPLACE by the existing rules',()=>{const v=make('owner-stated');v.baseline['10'].truth_strength={...dim,score:4};v.baseline['11'].tests.T1.result='CRACKS';expect(validateVerdict(v).verdict).toBe('REPLACE');});
  it('OWNER-STATED (PUBLIC) can REFRESH by the existing rules',()=>{const v=make('owner-stated');v.baseline['10'].truth_strength={...dim,score:4};expect(validateVerdict(v).verdict).toBe('REFRESH');});
  it('BG-DERIVED is INSUFFICIENT EVIDENCE',()=>expect(validateVerdict(make('BG-derived'))).toMatchObject({verdict:'INSUFFICIENT EVIDENCE',reasons:[{code:'PROPOSITION_NOT_CLIENT_SUPPLIED'}]}));
  it('missing proposition is INSUFFICIENT EVIDENCE',()=>expect(validateVerdict({...make('owner-stated'),baseline:{}}).verdict).toBe('INSUFFICIENT EVIDENCE'));
  it('OWNER-STATED without a cited source, date or quote is treated as BG-DERIVED',()=>{
    expect(effectiveDerivation('Owner-stated (public)',{source:'JLR',date:'2024-11-19',quote:''})).toBe('BG-derived');
    expect(effectiveDerivation('Owner-stated (public)',{source:'',date:'2024-11-19',quote:'Q'})).toBe('BG-derived');
    expect(effectiveDerivation('Owner-stated (public)',{source:'JLR',date:null,quote:'Q'})).toBe('BG-derived');
    expect(sourceKindOf({derivation_label:'Owner-stated (public)',proposition_source:'JLR'})).toBe('BG-derived');
    expect(sourceKindOf({derivation_label:'Owner-stated (public)',...cite})).toBe('owner-stated');
    expect(sourceKindOf({derivation_label:'Client-supplied'})).toBe('client');
  });
  it('OWNER-STATED outputs mark the client-confirmation gap and carry the note on all four',()=>{
    const out=buildValidateOutputs({runId:'cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f',version:2,brief,input:make('owner-stated'),provenance:[],checkpoints:{}}) as Record<string,{confidence:{reversible_gaps:string};notes?:string[];limitations:string[]}>;
    for(const id of VALIDATE_OUTPUTS){expect(out[id].confidence.reversible_gaps).toContain(OWNER_STATED_GAP);expect(out[id].notes).toEqual([CONFIRM_WITH_CLIENT_NOTE]);expect(out[id].limitations).toContain(CONFIRM_WITH_CLIENT_NOTE);}
  });
  it('CLIENT-SUPPLIED outputs carry no client-confirmation note',()=>{
    const out=buildValidateOutputs({runId:'cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f',version:2,brief,input:make('client'),provenance:[],checkpoints:{}}) as Record<string,{notes?:string[];confidence:{reversible_gaps:string}}>;
    for(const id of VALIDATE_OUTPUTS){expect(out[id].notes).toBeUndefined();expect(out[id].confidence.reversible_gaps).not.toContain(OWNER_STATED_GAP);}
  });
});
