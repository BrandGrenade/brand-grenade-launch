// Live re-render verification for the Dan Murphy's competitive-set correction.
// Renders every document type that exists for the brand and asserts:
//   1. no retired banner appears as a live competitor
//   2. Liquorland and BWS carry their current, real platforms
//   3. the re-argued impossibility case is present where the reasoning appears
//
//   bun scripts/verify-dan-competitive.ts

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { buildPhase1Document, buildStage16VisionDocument } from "../src/lib/phase1-document-builder";
import { buildSummaryDocument } from "../src/lib/summary-document";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildPhase2Document } from "../src/lib/phase2-document-generator";

const SESSION = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const OUT = "/tmp/dan-render";

const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});
const { data: s, error } = await sb.from("sessions").select("*").eq("id", SESSION).maybeSingle();
if (error || !s) throw new Error(`load failed: ${error?.message}`);

mkdirSync(OUT, { recursive: true });

const docs: Record<string, string> = {
  "Board_Strategy_Recommendation": buildBoardStrategyDocument(s as never),
  "Agency_Strategy_Platform": buildPhase1Document(s as never, "agency"),
  "Consulting_Delivery": buildPhase1Document(s as never, "consulting"),
  "Workshop": buildPhase1Document(s as never, "workshop"),
  "Strategy_and_Creative_Vision": buildStage16VisionDocument((s as any).brand_name, (s as any).selected_smp, (s as any).stage_16_vision_output),
  "Brand_Strategy_and_Creative_Development_Summary": buildSummaryDocument(s as never, undefined as never),
  "Master_Detonation_Brief": buildPhase2Document(s as never, "master_brief"),
};

// A retired banner may only appear inside the consolidation history sentence.
const HISTORICAL = /(absorb|absorbing|absorbed|retir|retiring|retired|converting|consolidat)/i;

let failures = 0;
for (const [name, html] of Object.entries(docs)) {
  writeFileSync(`${OUT}/${name}.html`, html);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const issues: string[] = [];

  for (const m of text.matchAll(/.{0,160}(Vintage Cellars|First Choice).{0,60}/gi)) {
    if (!HISTORICAL.test(m[0])) issues.push(`live mention of retired banner: …${m[0].slice(0, 170)}…`);
  }
  if (/five (named )?(rivals|competitors|players)/i.test(text)) issues.push("stale five-competitor count");

  const mentionsLiquorland = /Liquorland/i.test(text);
  if (mentionsLiquorland && !/Legendary/i.test(text)) issues.push("Liquorland named without its live platform");
  if (/BWS/.test(text) && !/Here for it|Refreshingly BWS/i.test(text))
    issues.push("BWS named without its live platform");
  if (/Competitive Impossibility|competitive-impossibility|cannot be adopted|no rival/i.test(text) &&
      mentionsLiquorland && !/re-tested against Liquorland/i.test(text))
    issues.push("impossibility reasoning present without the Liquorland re-test");

  console.log(`${issues.length ? "FAIL" : "PASS"}  ${name}  (${Math.round(html.length / 1024)} KB)`);
  for (const i of issues) console.log(`        - ${i}`);
  failures += issues.length;
}

console.log(`\n${failures} issue(s). Rendered to ${OUT}`);
process.exit(failures ? 1 : 0);
