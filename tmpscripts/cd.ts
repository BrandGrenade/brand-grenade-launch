import { SQL } from "bun";
import { writeFileSync } from "fs";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
const c = new SQL({ url: process.env.DB_URL!, prepare: false });
const r = (await c`select * from sessions where id='6ab4ea96-7c3a-4e0a-91a9-24b601752b35'`)[0];
writeFileSync("/tmp/cd.html", buildConsultingDeliveryDocument(r as never, { appendix: "full" }));
console.log("ok", r.brand_name);
await c.end();
