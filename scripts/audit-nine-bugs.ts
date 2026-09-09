// Retroactive audit for the Tier 1 content-corruption bugs.
//
//  1. Propositions truncated by the "clean up" step (trigger phrases
//     "This speaks/works/refers/nods/plays/lands").
//  2. Stored stage output claiming a stage count that disagrees with the
//     numbered-stage total (the "29 stages" claim).
//  3. Rejected-proposition comparison lines missing from the summary.
//
// Read-only. Run:  bun scripts/audit-nine-bugs.ts
import { createClient } from "@supabase/supabase-js";
import { cleanProposition } from "../src/lib/clean-proposition";
import { deriveRunFacts } from "../src/lib/run-facts";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service credentials not available");
const sb = createClient(url, key, { auth: { persistSession: false } });

const TRIGGER = /[.!?]\s+This\s+(speaks|works|refers|nods|plays|lands)\b/i;
const STAGE_CLAIM = /\b(\d{1,3})\s+(?:pipeline\s+)?stages?\s+(?:were\s+)?(?:completed|run|executed)\b/gi;

const { data, error } = await sb
  .from("sessions")
  .select("*");
if (error) throw new Error(error.message);
const rows = data ?? [];

const truncated: string[] = [];
const stageClaims: string[] = [];

for (const r of rows as Array<Record<string, unknown>>) {
  const id = String(r.id);
  const brand = String(r.brand_name ?? "(unnamed)");
  const smp = typeof r.selected_smp === "string" ? r.selected_smp : "";

  if (smp) {
    const cleaned = cleanProposition(smp);
    if (cleaned.trim() !== smp.trim()) {
      truncated.push(
        `${brand} — ${id}\n    stored:   ${smp.trim()}\n    rendered: ${cleaned}`,
      );
    } else if (TRIGGER.test(smp)) {
      // Pattern present but no longer truncated — records that the case was
      // actually exercised, not merely absent from the data.
      truncated.push(`OK (pattern present, rendered in full): ${brand} — ${id}`);
    }
  }

  const facts = deriveRunFacts(r);
  for (const col of [
    "stage_16_agency_output",
    "stage_16_consulting_output",
    "stage_16_workshop_output",
    "stage_16_vision_output",
  ]) {
    const text = typeof r[col] === "string" ? (r[col] as string) : "";
    if (!text) continue;
    for (const m of text.matchAll(STAGE_CLAIM)) {
      const n = Number(m[1]);
      if (n !== facts.stagesCompleted) {
        stageClaims.push(
          `${brand} — ${id} — ${col}: claims "${m[0].trim()}" but ${facts.stagesCompleted} of ${facts.stagesTotal} numbered stages ran`,
        );
      }
    }
  }
}

console.log(`Sessions audited: ${rows.length}\n`);
console.log("── 1. Proposition truncation ─────────────────────────────");
console.log(truncated.length ? truncated.join("\n") : "None found.");
console.log("\n── 2. Stage-count claims in stored document output ───────");
console.log(stageClaims.length ? stageClaims.join("\n") : "None found.");

/* ── 3. Historic exposure ─────────────────────────────────────────────
   The clean-up step is already correctly scoped today, so nothing renders
   truncated now. Documents generated BEFORE that scoping would have been
   truncated, so the same field is re-tested against the original rule to
   name any session whose already-delivered documents are affected. */
const LEGACY = /\s*\(?this\s+(speaks|works|refers|nods|plays|lands)\b[\s\S]*$/i;
const historic = (rows as Array<Record<string, unknown>>)
  .filter((r) => {
    const smp = typeof r.selected_smp === "string" ? r.selected_smp : "";
    return smp && LEGACY.test(smp) && smp.replace(LEGACY, "").trim() !== smp.trim();
  })
  .map((r) => `${String(r.brand_name)} — ${String(r.id)}\n    ${String(r.selected_smp).trim()}`);
console.log("\n── 3. Sessions whose PRE-FIX documents would have been truncated ──");
console.log(historic.length ? historic.join("\n") : "None found.");
