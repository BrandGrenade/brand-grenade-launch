// Central model + reasoning-effort policy for every Anthropic pipeline call.
//
// Why this file exists
// --------------------
// Claude Opus 5.5 (released 22 Sep 2026) is cheaper and stronger than Opus 5,
// but it changes two things that matter to this platform:
//
//  1. `tool_choice: {type:"any"|"tool"}` is rejected outright (HTTP 400,
//     "tool_choice: type \"tool\" and \"any\" are not supported for this
//     model"), where Opus 5 accepted it. Verified live 23 Sep 2026.
//     This codebase uses no forced tool choice anywhere, so nothing breaks —
//     but the ban is recorded here so it is not reintroduced.
//
//  2. The default reasoning effort dropped from high to medium. Effort is NOT
//     a top-level `effort` field (that 400s with "Extra inputs are not
//     permitted"); the API's own error text names the correct location:
//     `output_config.effort`. Verified live across low/medium/high/xhigh/max.
//
// Migration is deliberately stage-by-stage: STAGE_MODEL is the ledger. A stage
// id absent from it stays on Opus 5.
export const OPUS_5 = "claude-opus-5";
export const OPUS_5_5 = "claude-opus-5-5";
export const DEFAULT_MODEL = OPUS_5;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Lowercased stage id -> model. Absent = still on the platform default. */
const STAGE_MODEL: Record<string, string> = {
  // ─── Migrated to Opus 5.5 ───────────────────────────────────────────
  // Wave 1 (low stakes: brief-gap review, no scoring, no downstream lock).
  "1b": OPUS_5_5,
};

/**
 * Stages whose output quality depends on reasoning depth rather than speed.
 * These get an explicit `high` effort so the Opus 5.5 default drop to medium
 * cannot quietly thin them out. Everything else runs on the model default.
 */
const HIGH_EFFORT_STAGES = new Set<string>([
  // Scoring / integrity / selection — numeric rubrics and pass-fail gates.
  "8", "9", "9-loc", "9-loc-validation", "10", "11", "12",
  "13", "13b", "15", "16", "18", "20", "20b", "21", "21f",
  // Brand-world and territory reasoning.
  "14", "14b", "14c", "00a", "ie", "ie-r",
  // Briefing Room: diagnosis and tension collision are the reasoning core.
  "br1", "br2", "br4", "br5",
  // Anchor gate is a hard admissibility check.
  "anchor-gate",
]);

/**
 * Models that accept `output_config.effort`.
 *
 * Verified live 23 Sep 2026: opus-5, opus-5-5, sonnet-5 and sonnet-4-6 accept
 * `output_config.effort`; `claude-haiku-4-5` rejects it with HTTP 400
 * ("output_config.effort: Extra inputs are not permitted"). This allow-list is
 * the single capability gate — every request body is built through
 * `effortConfig()`, so an unsupported model can never receive the field.
 */
export function modelSupportsEffort(model: string): boolean {
  return (
    model.startsWith("claude-opus-5") ||
    model.startsWith("claude-sonnet-5") ||
    model.startsWith("claude-sonnet-4-6") ||
    model.startsWith("claude-fable-5")
  );
}

export function resolveModel(stageNumber?: string, explicit?: string): string {
  if (explicit) return explicit;
  if (stageNumber && STAGE_MODEL[stageNumber.toLowerCase()]) {
    return STAGE_MODEL[stageNumber.toLowerCase()]!;
  }
  return DEFAULT_MODEL;
}

/**
 * Returns the `output_config` fragment to merge into the request body, or an
 * empty object when this model/stage combination should use the model default.
 */
export function effortConfig(
  model: string,
  stageNumber?: string,
  explicit?: Effort,
): { output_config?: { effort: Effort } } {
  if (!modelSupportsEffort(model)) return {};
  const effort =
    explicit ??
    (stageNumber && HIGH_EFFORT_STAGES.has(stageNumber.toLowerCase()) ? "high" : undefined);
  return effort ? { output_config: { effort } } : {};
}

export const __policyInternals = { STAGE_MODEL, HIGH_EFFORT_STAGES, modelSupportsEffort };
