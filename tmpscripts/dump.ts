import { SQL } from "bun";
import { writeFileSync } from "fs";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
const r:any = (await c`select * from sessions where id='6ab4ea96-7c3a-4e0a-91a9-24b601752b35'`)[0];
for (const k of Object.keys(r)) { const v=r[k]; if (typeof v==="string" && v.length>200) writeFileSync(`/tmp/j_${k}.txt`, v); }
console.log("selected_smp:", r.selected_smp);
await c.end();
