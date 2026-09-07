import { SQL } from "bun";
import { stripDocumentMetadata } from "../src/lib/strip-document-metadata";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
for (const id of ["c5142f1d-a381-44aa-9b88-c21875cc7996","6ab4ea96-7c3a-4e0a-91a9-24b601752b35"]) {
  const r: any = (await c`select brand_name, stage_12_output from sessions where id=${id}`)[0];
  const out = stripDocumentMetadata(r.stage_12_output ?? "", "test");
  const bad = out.split("\n").filter((l:string)=>/each of the following|read each proposition|these four propositions|Q[1-6] \(/i.test(l));
  console.log(r.brand_name, "remaining framing lines:", bad.length, "len", (r.stage_12_output??"").length, "->", out.length);
  bad.slice(0,3).forEach((b:string)=>console.log("  !", b.slice(0,100)));
}
await c.end();
