import { SQL } from "bun";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
for (const id of ["c5142f1d-a381-44aa-9b88-c21875cc7996","6ab4ea96-7c3a-4e0a-91a9-24b601752b35"]) {
  const r: any = (await c`select brand_name, stage_12_output from sessions where id=${id}`)[0];
  const t = (r.stage_12_output ?? "") as string;
  console.log("=====", r.brand_name, t.length);
  for (const line of t.split("\n")) {
    if (/each of the (following|these)|read each|these (four|five|six|three) propositions|collectively|choose between|Q[1-6][.:) ]/i.test(line)) console.log("  |", line.trim().slice(0,160));
  }
}
await c.end();
