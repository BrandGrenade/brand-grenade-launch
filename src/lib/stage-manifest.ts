/**
 * Client-safe canonical stage manifest. No server-only imports may be added
 * here — UI code depends on it for stage totals.
 */
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
  { id: "9",   numericStage: 9,  phase: 1, label: "Distinctiveness Check",                   columns: ["stage_9_output", "stage_9_leftofcentre_output"] },
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


/** Count of primary numbered stages (1-22), excluding sub-stages. */
export const NUMBERED_STAGE_COUNT = new Set(
  STAGE_MANIFEST.map((entry) => entry.numericStage),
).size;

/** Count of every executable step, including sub-stages (1b, 4b, 13b, …). */
export const TOTAL_PIPELINE_STEPS = STAGE_MANIFEST.length;
