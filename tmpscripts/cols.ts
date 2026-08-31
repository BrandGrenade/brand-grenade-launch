import { SQL } from "bun";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
const r:any = (await c`select * from sessions where id='6ab4ea96-7c3a-4e0a-91a9-24b601752b35'`)[0];
for (const k of Object.keys(r)) { const v=r[k]; if (v!=null && (typeof v!=="string"||v.length<=400)) console.log(k, "=", typeof v==="object"?JSON.stringify(v).slice(0,300):String(v).slice(0,300)); }
await c.end();
