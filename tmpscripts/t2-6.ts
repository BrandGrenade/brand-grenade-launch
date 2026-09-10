// Item 6 live check: build the real Agency Strategy Platform document from a
// real stored session, including the bullet-without-full-stop case that used
// to throw.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { buildPhase1Document } from "@/lib/phase1-document-builder";
import { findPropositionFramingViolations } from "@/lib/proposition-framing";

const ids = ["c5142f1d-a381-44aa-9b88-c21875cc7996", "6ab4ea96-7c3a-4e0a-91a9-24b601752b35"];
for (const id of ids) {
  const { data: s, error } = await db.from("sessions").select("*").eq("id", id).single();
  if (error) throw error;
  // Reproduce the original failure condition: an unpunctuated bullet using
  // plural proposition language inside a stage the Agency doc renders.
  const poisoned = {
    ...s,
    stage_12_output:
      (s.stage_12_output ?? "") +
      "\n\n- These propositions differ in how far they push the brand\n- A clean closing bullet\n",
  } as never;
  for (const [label, sess] of [["stored", s], ["with offending bullet", poisoned]] as const) {
    try {
      const html = buildPhase1Document(sess as never, "agency");
      const leftover = findPropositionFramingViolations(html.replace(/<[^>]+>/g, " "), 1);
      console.log(`${id.slice(0, 8)} agency (${label}): BUILT ${html.length} chars, residual violations ${leftover.length}`);
    } catch (e) {
      console.log(`${id.slice(0, 8)} agency (${label}): FAILED — ${(e as Error).message.slice(0, 160)}`);
    }
  }
}
