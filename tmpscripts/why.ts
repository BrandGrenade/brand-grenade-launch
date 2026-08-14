import { extractVerification, extractScoring, extractProof } from "../src/lib/exec-summary-sections";
import { deriveMintoContent } from "../src/lib/minto-content";
import { Client } from "pg";
const c = new Client({ connectionString: process.env.DB_URL });
await c.connect();
const ids = ["55a48e67-b303-4b98-bb17-c2eaaa414163","6ab4ea96-7c3a-4e0a-91a9-24b601752b35","df8a6e1d-4fa2-4a4c-a1c6-d6a35486b925"];
for (const id of ids) {
  const r = (await c.query("select * from sessions where id=$1",[id])).rows[0];
  const v = extractVerification(r as any);
  const sc = extractScoring(r as any);
  const pr = extractProof(r as any, sc);
  const d = deriveMintoContent(r as any, { appendix: { mode: "brief" } });
  console.log("=====", r.brand_name);
  console.log("verdict:", v.verdict, "tests:", v.tests.length, JSON.stringify(v.tests.slice(0,3)));
  console.log("proof:", JSON.stringify(pr));
  console.log("derived why len:", (d.content.why_this_wins||"").length, (d.content.why_this_wins||"").slice(0,300));
}
await c.end();
