import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * ─── CANONICAL STAGE MANIFEST ─────────────────────────────────────────
 * Single source of truth for the pipeline's ordered stage list, including
 * every sub-stage (1b, 4b, 13b, 14b/14c, 17b, 20b) placed at its correct
 * position in execution order.
 *
 * Consumed by:
 *   - assertStageOutput / assertUpstreamStageOutput (upstream gate checks)
 *   - retry.functions.ts (reset-and-cascade order for Phase 1)
 *   - full-run-document.ts (Complete Pipeline Run deliverable)
 *
 * Adding or renaming a stage? Edit this array only.
 */
export interface StageManifestEntry {
  /** Stable stage id including sub-stages: "1", "1b", "2", … "22". */
  id: string;
  /** The primary numeric stage this entry belongs to (1-22). Multiple entries share the same numericStage when sub-stages exist. */
  numericStage: number;
  /** Which phase this stage runs in. */
  phase: 1 | 2;
  /** Human-readable label used in deliverables and diagnostics. */
  label: string;
  /** DB column(s) that hold this stage's persisted output. */
  columns: readonly string[];
}

export const STAGE_MANIFEST: readonly StageManifestEntry[] = [
  { id: "1",   numericStage: 1,  phase: 1, label: "Brief Analysis",                          columns: ["stage_1_output"] },
  { id: "1b",  numericStage: 1,  phase: 1, label: "Brief Enhancement",                       columns: ["stage_1b_output"] },
  { id: "2",   numericStage: 2,  phase: 1, label: "Category Intelligence",                   columns: ["stage_2_output"] },
  { id: "3",   numericStage: 3,  phase: 1, label: "Strategic Frameworks",                    columns: ["stage_3_output"] },
  { id: "4",   numericStage: 4,  phase: 1, label: "Strategic Universes",                     columns: ["stage_4_output"] },
  { id: "4b",  numericStage: 4,  phase: 1, label: "Asset Mining & Product Facts",            columns: ["stage_4b_output"] },
  { id: "5",   numericStage: 5,  phase: 1, label: "Insight Generation",                      columns: ["stage_5_output"] },
  { id: "6",   numericStage: 6,  phase: 1, label: "Insight Validation",                      columns: ["stage_6_output"] },
  { id: "7",   numericStage: 7,  phase: 1, label: "Territory Synthesis",                     columns: ["stage_7_output"] },
  { id: "8",   numericStage: 8,  phase: 1, label: "Proposition Generation",                  columns: ["stage_8_output"] },
  { id: "9",   numericStage: 9,  phase: 1, label: "Distinctiveness Check",                   columns: ["stage_9_output"] },
  { id: "10",  numericStage: 10, phase: 1, label: "Proposition Scoring",                     columns: ["stage_10_output"] },
  { id: "11",  numericStage: 11, phase: 1, label: "Integrity Testing",                       columns: ["stage_11_output"] },
  { id: "12",  numericStage: 12, phase: 1, label: "Proposition Selection",                   columns: ["stage_12_output"] },
  { id: "13",  numericStage: 13, phase: 1, label: "Brand Fit Validation",                    columns: ["stage_13_output"] },
  { id: "13b", numericStage: 13, phase: 1, label: "Historical Validation",                   columns: ["stage_13b_output"] },
  { id: "14",  numericStage: 14, phase: 1, label: "Territory Mapping",                       columns: ["stage_14_output"] },
  { id: "14b", numericStage: 14, phase: 1, label: "Channel Expression",                      columns: ["stage_14b_output"] },
  { id: "14c", numericStage: 14, phase: 1, label: "Brand World Definition",                  columns: ["stage_14c_output"] },
  { id: "15",  numericStage: 15, phase: 1, label: "Coherence Audit",                         columns: ["stage_15_output"] },
  { id: "16",  numericStage: 16, phase: 1, label: "Document Assembly",                       columns: ["stage_16_consulting_output", "stage_16_agency_output", "stage_16_workshop_output", "stage_16_vision_output"] },
  { id: "17",  numericStage: 17, phase: 2, label: "Detonation Territory",                    columns: ["stage_17_output"] },
  { id: "17b", numericStage: 17, phase: 2, label: "Detonation Intelligence",                 columns: ["stage_17b_output"] },
  { id: "18",  numericStage: 18, phase: 2, label: "The Detonation",                          columns: ["stage_18_output"] },
  { id: "19",  numericStage: 19, phase: 2, label: "Activation Architecture",                 columns: ["stage_19_output"] },
  { id: "20",  numericStage: 20, phase: 2, label: "Master Detonation Brief",                 columns: ["stage_20_output"] },
  { id: "20b", numericStage: 20, phase: 2, label: "Channel Strategy and Audience Intelligence", columns: ["stage_20b_output"] },
  { id: "21",  numericStage: 21, phase: 2, label: "Channel Detonation Briefs",               columns: ["stage_21_outputs"] },
  { id: "22",  numericStage: 22, phase: 2, label: "Brand Architecture",                      columns: ["stage_22_output"] },
];

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
}
