import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { buildPhase1Document } from "@/lib/phase1-document-builder";
import {
  assertPropositionFraming,
  enforcePropositionFraming,
  findPropositionFramingViolations,
} from "@/lib/proposition-framing";

const id = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const { data: s } = await db.from("sessions").select("*").eq("id", id).single();
const smp = (s!.selected_smp ?? "").toString();
console.log("selected proposition:", smp.slice(0, 80));

// The exact original failure shape: a bullet, no full stop, plural comparison,
// naming the selected proposition so it survives scoping.
const bad = `- Of the propositions considered, “${smp}” ranked strongest against the others`;
console.log("\nviolations in the offending bullet:", findPropositionFramingViolations(bad, 1).length);
try {
  assertPropositionFraming(bad, 1, "old hard check");
  console.log("old hard check: no throw");
} catch (e) {
  console.log("old hard check: THREW —", (e as Error).message.slice(0, 90));
}
const repaired = enforcePropositionFraming(bad, 1, "new self-correcting check");
console.log("new check output:", JSON.stringify(repaired), "residual:", findPropositionFramingViolations(repaired, 1).length);

const poisoned = { ...s, stage_12_output: `${s!.stage_12_output ?? ""}\n\n${bad}\n- ${smp} holds\n` } as never;
for (const [label, sess] of [["stored", s], ["with offending bullet", poisoned]] as const) {
  try {
    const html = buildPhase1Document(sess as never, "agency");
    console.log(`agency (${label}): BUILT ${html.length} chars, residual ${findPropositionFramingViolations(html.replace(/<[^>]+>/g, " "), 1).length}`);
  } catch (e) {
    console.log(`agency (${label}): FAILED — ${(e as Error).message.slice(0, 120)}`);
  }
}
