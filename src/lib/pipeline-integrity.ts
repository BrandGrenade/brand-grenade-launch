import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type { StageManifestEntry } from "./stage-manifest";
export { STAGE_MANIFEST, NUMBERED_STAGE_COUNT, TOTAL_PIPELINE_STEPS } from "./stage-manifest";
import { STAGE_MANIFEST } from "./stage-manifest";

/**
 * Legacy numeric-keyed map preserved for `assertStageOutput` / upstream gate
 * checks. Derived from STAGE_MANIFEST — only the primary entry for each
 * numeric stage contributes columns, matching pre-manifest behaviour.
 */
export const STAGE_OUTPUT_COLUMNS: Record<number, readonly string[]> = (() => {
  const out: Record<number, string[]> = {};
  for (const entry of STAGE_MANIFEST) {
    // Primary entry = the one whose id equals its numericStage (no sub-stage suffix).
    if (entry.id === String(entry.numericStage)) {
      out[entry.numericStage] = [...entry.columns];
    }
  }
  return out;
})();

function hasPersistedOutput(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

export async function assertStageOutput(
  sessionId: string,
  upstreamStage: number,
  forStageLabel?: string,
): Promise<void> {
  const columns = STAGE_OUTPUT_COLUMNS[upstreamStage];
  if (!columns) return;
  const selectColumns = columns.join(", ");
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(selectColumns)
    .eq("id", sessionId)
    .single();
  const label = forStageLabel ?? `Stage ${upstreamStage + 1}`;
  if (error) throw new Error(`Failed to verify Stage ${upstreamStage} output before ${label}: ${error.message}`);
  const row = data as unknown as Record<string, unknown> | null;
  const hasOutput = columns.some((column) => hasPersistedOutput(row?.[column]));
  if (!hasOutput) {
    throw new Error(`${label} cannot run because Stage ${upstreamStage} output is missing`);
  }
}

export async function assertUpstreamStageOutput(
  sessionId: string,
  stageNumber: number,
): Promise<void> {
  if (stageNumber < 2) return;
  // Stage 16 (document assembly) intentionally runs AFTER Phase 2 completes,
  // not between Stage 15 and Stage 17. So Stage 17's upstream is Stage 15.
  const upstream = stageNumber === 17 ? 15 : stageNumber - 1;
  await assertStageOutput(sessionId, upstream, `Stage ${stageNumber}`);

  // Every stage from Brand Fit Validation onward consumes the selected
  // proposition, and several of them (13, 13b, 14x, 15) can legitimately
  // refine its wording. Running the content-keyed score guarantee here means
  // any downstream stage entry re-scores a changed proposition automatically —
  // one choke point rather than a hook per stage.
  if (stageNumber >= 13) {
    const { ensureSmpScoredInBackground } = await import("./rescore-smp.server");
    ensureSmpScoredInBackground(sessionId);
  }
}
