import { describe, it, expect } from "vitest";
import fixture from "./fixtures/jlr-saved-evidence.json";
import { recoverSavedStage, recoverStage12 } from "./saved-stage-records";
import { resolveStructuredRecord, saveStructuredStage } from "./structured-stage-save";
import { handleAccess, type Db, type LogEntry } from "./access/core";

describe("saved JLR evidence recovery", () => {
  it("Stage 10 recovers all six actual candidates, with unchanged saved scores", () => {
    const r = recoverSavedStage("10", fixture["10"]);
    expect(r?.smps_scored).toBe(6);
    const scores = r?.scores as { smp: string; fame: {score:number}; composite:number }[];
    expect(scores[1]).toMatchObject({ smp: "The jaguar doesn't share its name lightly.", fame:{score:8}, composite:70.5 });
  });
  it("Stage 11 preserves all eight written test outcomes for every candidate", () => {
    const r = recoverSavedStage("11", fixture["11"]);
    const blocks = r?.blocks as {tests:Record<string,{result:string}>}[];
    expect(blocks).toHaveLength(6);
    for(const b of blocks) expect(Object.keys(b.tests)).toHaveLength(8);
    expect(blocks[0].tests.T1.result).toBe("HOLDS");
    expect(blocks[0].tests.T4.result).toBe("WOBBLES");
    expect(blocks[0].tests.T7.result).toBe("CRACKS");
    expect(blocks[0].tests.T8.result).toBe("N/A");
    expect(r?.surviving_set).toHaveLength(4);
    expect(r?.exposed_count).toBe(2);
  });
  it("Stage 13 recovers the actual forcing path and saved credibility scores", () => {
    const r = recoverSavedStage("13",fixture["13"]);
    expect(r).toMatchObject({verdict:"CONFIRMED WITH ADJUSTMENTS — PROCEED",credibility:{behavioural_capacity:{score:4}},forcing_test:{verdict:"FORCING PROPOSITION"}});
    expect((r?.forcing_test as {path_or_reason:string}).path_or_reason).toContain("author and publish a range-wide ownership standard");
    expect(r?.commitments).toHaveLength(5);
  });
  it("Stage 12 preserves full paragraphs and exposes all four presentation cards", () => {
    const r = recoverStage12(fixture["12"]);
    const cards = r?.propositions as {number:number;smp:string;owns:string;scores:Record<string,number>}[];
    expect(cards).toHaveLength(4);
    expect(cards[2]).toMatchObject({number:3,smp:"The jaguar doesn't share its name lightly.",scores:{fame:8}});
    expect(cards[2].owns.length).toBeGreaterThan(300);
  });
  it("unsupported or incomplete evidence never becomes invented structured data", () => {
    for(const n of ["10","11","13"] as const) expect(recoverSavedStage(n,"Incomplete document")).toBeNull();
    expect(recoverSavedStage("11",fixture["11"].replace("T7 — Interpretation Drift: CRACKS", "T7 — Interpretation Drift: UNKNOWN"))).toBeNull();
  });
  it("a malformed structured block recovers without a stage rerun; unrecoverable errors are explicit", () => {
    expect(resolveStructuredRecord("10","{}",fixture["10"],{expectedCount:4}).structured?.smps_scored).toBe(6);
    expect(resolveStructuredRecord("11",null,"missing").error).toContain("Platform structured-data error after retry");
  });
  it("atomic structured save retries once", async () => {
    let calls=0; let errors=0;
    expect(await saveStructuredStage(async()=>({error:++calls===1?{message:"transient"}:null}),async()=>{errors++;return {error:null}},"Stage 10")).toEqual({error:null});
    expect(calls).toBe(2);expect(errors).toBe(0);
  });
  it("exhausted save retries durably record the platform error", async () => {
    let calls=0;let recorded="";
    const result=await saveStructuredStage(async()=>{calls++;return {error:{message:"save failed"}}},async message=>{recorded=message;return {error:null}},"Stage 11");
    expect(calls).toBe(2);expect(recorded).toContain("Platform structured-data save error after retry");expect(result.error?.message).toBe(recorded);
  });
  for(const brief_type of ["campaign","deal"]) it(`${brief_type} full runs serve version-matched evidence through list_runs and get_output`,async()=>{
    const id="3470f1ad-b322-4230-8e3d-bf0072e95b7a";
    const row:Record<string,unknown>={id,created_at:"2026-10-20T10:49:01Z",status:"complete",run_mode:"full",brief_type,link_status:"linked",bg_client_id:"client",locked_at:"2026-10-26",stage_9_output:"saved",stage_9_structured:{propositions:[{id:"P1"}]}};
    for(const n of ["10","11","12","13"] as const) row[`stage_${n}_output`]=fixture[n];
    const db={resolveClient:async()=>"client",findRun:async()=>({id,table:"sessions",row}),versions:async()=>[],actorName:async()=>null,listLinkedRuns:async()=>[{id,table:"sessions",row}]} as unknown as Db;
    const call=(request:string,params:Record<string,unknown>)=>handleAccess(db,{id:"verified-test",scope:"hub_tools"},{request,params},{scope:null,key_id:null,client_ref:null,run_id:null,request:null,output_id:null} as LogEntry);
    const snapshot=JSON.stringify(row);
    const listed=await call("list_runs",{client_ref:"hub-client"});
    expect((listed.content as {runs:{run_id:string;version:number}[]}).runs[0]).toMatchObject({run_id:id,version:1});
    for(const output_id of ["stage09","stage10","stage11","stage13","stage12_propositions"]){
      const out=await call("get_output",{client_ref:"hub-client",run_id:id,version:1,output_id});expect(out.content_status).toBe("structured");
    }
    expect((await call("get_output",{client_ref:"hub-client",run_id:id,version:1,output_id:"stage10_current_position"})).content_status).toBe("not_produced");
    expect(JSON.stringify(row)).toBe(snapshot);
  });
  it("historical versions recover from their own text, never current records",async()=>{
    const id="3470f1ad-b322-4230-8e3d-bf0072e95b7a";
    const row={created_at:"2026-10-20",run_mode:"full",link_status:"linked",bg_client_id:"c",stage_10_output:fixture["10"].replace("Fame: 7/10","Fame: 9/10")};
    const db={resolveClient:async()=>"c",findRun:async()=>({id,table:"sessions",row}),versions:async()=>[{field:"stage_10_output",version_no:1,content:fixture["10"],reason:"retry",created_at:"2026-10-21"}],actorName:async()=>null} as unknown as Db;
    const out=await handleAccess(db,{id:"test",scope:"hub_tools"},{request:"get_output",params:{client_ref:"hub",run_id:id,version:1,output_id:"stage10"}},{scope:null,key_id:null,client_ref:null,run_id:null,request:null,output_id:null});
    expect((out.content as {record:{scores:{fame:{score:number}}[]}}).record.scores[0].fame.score).toBe(7);
  });
});