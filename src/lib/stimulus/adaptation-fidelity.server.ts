// CHANNEL ADAPTATION FIDELITY
//
// Step 3 generates one adaptation per channel from the single locked idea.
// The prompt binds it; this holds it to that binding afterwards. Two checks:
//
//   1. The verbatim campaign-line check — deterministic, no model involved.
//   2. The Stage 21 channel fidelity check (runChannelFidelityCheck), reused
//      verbatim so Step 3 is judged by exactly the same standard /detonation
//      applies to the Stage 21 briefs.
//
// The verdict is stored on the direction row (line_check) so it can never be
// read as a silent pass: a check that cannot complete records "drift".

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runChannelFidelityCheck } from "@/lib/stage21-fidelity.server";
import type { FidelityVerdict } from "@/lib/stage21-fidelity-types";
import type { AdaptationFidelity } from "./adaptation-fidelity-types";

export type { AdaptationFidelity };

/** Normalises smart quotes, dashes, case and whitespace — nothing else. */
function normalise(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function carriesLineVerbatim(adaptation: string, lockedLine: string | null): boolean {
  const line = (lockedLine ?? "").trim();
  if (!line) return true; // nothing locked to carry
  return normalise(adaptation).includes(normalise(line));
}

export function buildLeadExpression(args: {
  lockedIdea: string;
  lockedLine: string | null;
  lockedLens: string | null;
}): string {
  return [
    `LOCKED CAMPAIGN BIG IDEA (Creative Stimulus sweep, lens: ${args.lockedLens ?? "—"})`,
    args.lockedIdea.trim(),
    "",
    "LOCKED CAMPAIGN LINE — this adaptation must carry this line verbatim:",
    (args.lockedLine ?? "").trim() || "—",
  ].join("\n");
}

/** Runs both checks and persists the verdict onto the direction row. */
export async function checkAndStoreAdaptationFidelity(args: {
  sessionId: string;
  directionId: string;
  channelName: string;
  adaptation: string;
  lockedIdea: string;
  lockedLine: string | null;
  lockedLens: string | null;
}): Promise<AdaptationFidelity> {
  const lineVerbatim = carriesLineVerbatim(args.adaptation, args.lockedLine);

  const report = await runChannelFidelityCheck({
    sessionId: args.sessionId,
    leadExpression: buildLeadExpression({
      lockedIdea: args.lockedIdea,
      lockedLine: args.lockedLine,
      lockedLens: args.lockedLens,
    }),
    outputs: { [args.channelName]: args.adaptation },
  });

  const r = report.results[0];
  let verdict: FidelityVerdict = r?.verdict ?? "drift";
  const missing = [...(r?.missing ?? [])];

  // A missing campaign line is a contract failure regardless of how well the
  // idea itself survived — never let it pass.
  if (!lineVerbatim) {
    if (verdict === "pass") verdict = "drift";
    missing.unshift(
      `Locked campaign line not reproduced verbatim: "${(args.lockedLine ?? "").trim()}"`,
    );
  }

  const fidelity: AdaptationFidelity = {
    kind: "channel_adaptation_fidelity",
    verdict,
    score: r?.score ?? 0,
    reasoning:
      r?.reasoning?.trim() ||
      "The fidelity check returned no reasoning. Treat this adaptation as unverified.",
    missing,
    misreadingEvidence: r?.misreadingEvidence ?? "",
    lineVerbatim,
    lockedLine: (args.lockedLine ?? "").trim(),
    checkedAt: new Date().toISOString(),
  };

  await supabaseAdmin
    .from("stimulus_directions")
    .update({ line_check: fidelity as never })
    .eq("id", args.directionId);

  return fidelity;
}
