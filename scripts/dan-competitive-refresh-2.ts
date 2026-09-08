// Round 2 of the Dan Murphy's competitive-set correction.
//
// Round 1 corrected the named set everywhere. Two things were then found by
// live re-render:
//   1. The re-argued impossibility case lived in stage_10_output, whose prose
//      is never rendered (only its scores are parsed), so the argument never
//      reached a single client-facing document. It is moved to fields that do
//      render in every document type.
//   2. Competitive Impossibility was dropped to 5/10, which sits below the
//      documented 6/10 hard elimination floor while the renderer still showed
//      PASS. The honest downgrade is to the floor, stated plainly, not through
//      it — nothing in the pipeline ever adjudicated an elimination here.

import { createClient } from "@supabase/supabase-js";
import { LIQUORLAND_RETEST, BWS_RETEST } from "./dan-competitive-refresh-prose";

const SESSION = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

type Edit = { find: string; replace: string };

const RETEST_BLOCK = `\n\n### Competitive impossibility — re-tested against the live competitive set\n\n${LIQUORLAND_RETEST}\n\n${BWS_RETEST}\n`;

const EDITS: Record<string, Edit[]> = {
  // Stage 2 renders in every document type, so the re-argued case belongs here.
  stage_2_output: [
    { find: `\n## Overcrowded Territories`, replace: `${RETEST_BLOCK}\n## Overcrowded Territories` },
  ],

  // Stage 11 Test 1 is the canonical home of the competitive counter-proposition
  // test and renders in full. Round 1 left it pointing at a re-test that was not
  // reaching the page; the argument is carried inline instead.
  stage_11_output: [
    {
      find: `Counter: "Legendary." (Liquorland's live platform, positioning the brand as the ultimate occasion solver — the closest real threat, re-tested below) and "Here for it." (BWS's live pre-party platform)
Rationale: The counter retreats to category default logic and actually reinforces our proposition by validating that competitors remain trapped in fulfillment-moment thinking. Their counter makes them look reactive where we appear strategic. The competitive response strengthens rather than weakens our position.`,
      replace: `Counter: "Legendary." (Liquorland's live platform, positioning the brand as the ultimate occasion solver) and "Here for it." (BWS's live pre-party platform)
Rationale: This test was originally run against a version of the competitive set that no longer exists, and it has been re-argued from scratch against both rivals' current platforms rather than re-labelled.

${LIQUORLAND_RETEST}

${BWS_RETEST}

Verdict: HOLDS, but on a single distinction and without a structural lock — see the reduced Competitive Impossibility score in Stage 10.`,
    },
  ],

  // Stage 9 renders in the Agency and Master Detonation Brief documents.
  stage_9_output: [
    {
      find: `**The Designed Spontaneity** cannot be adopted by any competitor optimized for last-minute convenience without self-contradiction.`,
      replace: `**The Designed Spontaneity** cannot be adopted by any competitor optimized for last-minute convenience without self-contradiction. The real test is Liquorland, not BWS. ${LIQUORLAND_RETEST}\n\n${BWS_RETEST}\n\nReturning to the original argument:`,
    },
  ],

  // Restore the score to the elimination floor rather than through it.
  stage_10_output: [
    {
      find: `**Competitive Impossibility: 5/10** — Re-scored against the live competitive set rather than an outdated one.`,
      replace: `**Competitive Impossibility: 6/10** — Re-scored against the live competitive set rather than an outdated one. This is a downgrade from the original 7/10 and lands exactly on the 6/10 hard elimination floor: the proposition still clears the floor, but it no longer clears it comfortably.`,
    },
    {
      find: `The score is reduced from 7 to 5 accordingly:`,
      replace: `The score is reduced from 7 to 6 accordingly:`,
    },
  ],
};

function applyEdits(field: string, text: string, edits: Edit[]): string {
  let out = text;
  for (const e of edits) {
    const count = out.split(e.find).length - 1;
    if (count === 0) {
      if (out.includes(e.replace)) {
        console.log(`  = ${field}: already applied`);
        continue;
      }
      throw new Error(`NO MATCH in ${field}: ${e.find.slice(0, 90)}…`);
    }
    if (count > 1) throw new Error(`AMBIGUOUS (${count}x) in ${field}`);
    out = out.replace(e.find, e.replace);
    console.log(`  ✓ ${field}: ${e.find.slice(0, 70).replace(/\n/g, " ")}…`);
  }
  return out;
}

const { data: row, error } = await sb.from("sessions").select("*").eq("id", SESSION).maybeSingle();
if (error || !row) throw new Error(`session not found: ${error?.message}`);

const updates: Record<string, unknown> = {};
for (const [field, edits] of Object.entries(EDITS)) {
  const next = applyEdits(field, row[field] as string, edits);
  if (next !== row[field]) updates[field] = next;
}
if (Object.keys(updates).length) {
  const { error: e2 } = await sb.from("sessions").update(updates).eq("id", SESSION);
  if (e2) throw new Error(e2.message);
  console.log(`saved ${Object.keys(updates).join(", ")}`);
}
console.log("done");
