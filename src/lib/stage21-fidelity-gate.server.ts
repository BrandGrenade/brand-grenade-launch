// Server-side enforcement of the Stage 21 channel fidelity gate.
// Mirrors src/lib/checkpoint-gate.ts: re-reads the session row and throws a
// hard, user-visible error rather than ever silently continuing.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { FidelityReport } from "./stage21-fidelity-types";
import {
  fidelityBlockReason,
  type FidelityOverride,
} from "./stage21-fidelity-gate";

export async function requireNoFidelityBreak(
  sessionId: string,
  consumerLabel: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("stage_21_fidelity, stage_21_fidelity_override")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error(
      `Channel fidelity gate could not verify the session (${sessionId}): ${
        error?.message ?? "no row returned"
      }`,
    );
  }

  const row = data as unknown as {
    stage_21_fidelity: FidelityReport | null;
    stage_21_fidelity_override: FidelityOverride | null;
  };

  const reason = fidelityBlockReason(row.stage_21_fidelity, row.stage_21_fidelity_override);
  if (reason) throw new Error(`${consumerLabel} is blocked. ${reason}`);
}
