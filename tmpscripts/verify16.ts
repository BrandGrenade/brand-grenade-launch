import { SQL } from "bun";
import { deriveRunFacts, runFactsBlock } from "../src/lib/run-facts";
import { parseScoredCandidates } from "../src/lib/minto-content";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
for (const id of ["c5142f1d-a381-44aa-9b88-c21875cc7996","6ab4ea96-7c3a-4e0a-91a9-24b601752b35"]) {
  const r: any = (await c`select * from sessions where id=${id}`)[0];
  if (!r) { console.log(id, "missing"); continue; }
  console.log("=====", r.brand_name);
  for (const f of ["agency","consulting","workshop","vision"] as const) {
    const facts = deriveRunFacts(r, f);
    console.log(f, JSON.stringify({s:facts.stagesCompleted,c:facts.propositionsConsidered,sc:facts.propositionsScored,p:facts.propositionsPassed,d:facts.documentsProduced,g:`${facts.gatesConfirmed}/${facts.gatesTotal}`}));
  }
  const cands = parseScoredCandidates(r.stage_10_output ?? "");
  for (const cand of cands) console.log("  ", cand.composite, JSON.stringify(cand.dims), cand.name.slice(0,50));
}
await c.end();
