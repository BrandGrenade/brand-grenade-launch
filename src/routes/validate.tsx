import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { getValidateSource, saveValidateAssessment } from '@/lib/validate.functions';
import { ValidateBriefSchema, type ValidateBrief } from '@/lib/validate-mode';

export const Route=createFileRoute('/validate')({
  validateSearch:s=>z.object({session:z.string().uuid().optional(),version:z.coerce.number().int().min(1).optional(),brand:z.string().optional()}).parse(s),
  head:()=>({meta:[{title:'Validate Current Position — Brand Grenade'},{name:'description',content:'Version-bound assessment of an existing brand proposition using saved evidence.'},{property:'og:title',content:'Validate Current Position — Brand Grenade'},{property:'og:description',content:'Keep, refresh or replace assessments with reason codes and source evidence.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:ValidatePage,
});
const empty:ValidateBrief={currentProposition:'',source:'',sourceDate:null,suppliedBy:'',currentTerritory:'',strategyOwner:'',strategyDate:null,priorDecisions:'',knownThreats:'',decisionQuestions:[],evidenceStandard:''};
function ValidatePage(){
  const search=Route.useSearch();
  const [sessionId,setSessionId]=useState(search.session??'');
  const [version,setVersion]=useState(search.version??1);
  const [brand,setBrand]=useState(search.brand??'');
  const [brief,setBrief]=useState<ValidateBrief>(empty);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [source,setSource]=useState<Awaited<ReturnType<typeof getValidateSource>>|null>(null);
  const [result,setResult]=useState<Record<string,unknown>|null>(null);
  const load=useServerFn(getValidateSource),save=useServerFn(saveValidateAssessment);
  const update=(key:keyof ValidateBrief,value:string)=>setBrief(b=>({...b,[key]:key==='decisionQuestions'?value.split('\n').map(s=>s.trim()).filter(Boolean):value}));
  async function loadSource(){setBusy(true);setError(null);try{const s=await load({data:{sessionId,version,subjectBrand:brand}});setSource(s);setBrief(b=>({...b,currentProposition:s.proposition,source:typeof s.manifest.proposition_source==='string'?s.manifest.proposition_source:'Saved source manifest',suppliedBy:s.sourceKind==='client'?'':'BG-derived, not client-supplied'}));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function assess(){setBusy(true);setError(null);try{const parsed=ValidateBriefSchema.parse(brief);const r=await save({data:{sessionId,version,subjectBrand:brand,brief:parsed}});setResult(r.outputs);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  return <div className="min-h-screen bg-background text-foreground"><TopNav/><main className="mx-auto max-w-4xl px-6 py-10"><h1 className="text-h1">Validate</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Locked run ID<input className="input-base mt-2 w-full" value={sessionId} disabled={!!source} onChange={e=>setSessionId(e.target.value)}/></label>
      <label className="text-sm">Run version<input type="number" min={1} className="input-base mt-2 w-full" value={version} disabled={!!source} onChange={e=>setVersion(Number(e.target.value))}/></label>
      <label className="text-sm">Subject brand<input className="input-base mt-2 w-full" value={brand} disabled={!!source} onChange={e=>setBrand(e.target.value)}/></label>
    </div>
    {!source&&<Button className="mt-4" disabled={busy} onClick={()=>void loadSource()}>{busy?'Loading…':'Load saved baseline'}</Button>}
    {source&&<><p className="mt-6 text-sm text-muted-foreground">Mode: Validate · v{source.version} · {source.sourceKind}</p><div className="mt-6 grid gap-4 sm:grid-cols-2">
      {(Object.keys(empty) as (keyof ValidateBrief)[]).map(key=><label key={key} className="text-sm">{({currentProposition:'Current proposition',source:'Proposition source',sourceDate:'Source date',suppliedBy:'Supplied by',currentTerritory:'Current territory',strategyOwner:'Strategy owner',strategyDate:'Strategy date',priorDecisions:'Prior decisions',knownThreats:'Known threats',decisionQuestions:'Decision questions',evidenceStandard:'Evidence standard required'})[key]}
      <textarea className="input-base mt-2 w-full" rows={key==='decisionQuestions'?3:2} readOnly={key==='currentProposition'||!!result} value={Array.isArray(brief[key])?(brief[key] as string[]).join('\n'):String(brief[key]??'')} onChange={e=>update(key,e.target.value)}/></label>)}
    </div>{!result&&<Button className="mt-6" disabled={busy||!ValidateBriefSchema.safeParse(brief).success} onClick={()=>void assess()}>{busy?'Assessing…':'Validate saved position'}</Button>}</>}
    {error&&<p role="alert" className="mt-6 text-destructive">{error}</p>}
    {result&&<section className="mt-8"><h2 className="text-h2">{String((result['validate.verdict'] as {data?:{verdict?:string}})?.data?.verdict??'Assessment')}</h2>{Object.entries(result).map(([id,content])=><details key={id} className="border-b border-border py-4"><summary className="cursor-pointer text-sm font-semibold">{id}</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(content,null,2)}</pre></details>)}</section>}
  </main></div>;
}