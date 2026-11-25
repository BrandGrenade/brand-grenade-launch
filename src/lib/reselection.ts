/** Fix pack (25 Nov): reselection, locking and selection-screen rules shared by UI and server. */
export type ReselectRun = {
  locked_at?: string | null;
  lock_reason?: string | null;
  validate_brief?: unknown;
  strategy_signoff_confirmed?: boolean | null;
  checkpoint_c_confirmed?: boolean | null;
  selected_smp?: string | null;
  stage_12_output?: string | null;
  stage_status?: string | null;
};

/** Whether the user may go back to Stage 11/12 and choose again. Locking applies at the final checkpoint only. */
export function reselectAvailability(run: ReselectRun): { allowed: boolean; reason: string | null } {
  if (run.locked_at) return { allowed: false, reason: lockedNote(run.lock_reason) };
  if (run.validate_brief) return { allowed: false, reason: "Validate runs keep comparators only, so there is no selection to change." };
  if (run.strategy_signoff_confirmed) return { allowed: false, reason: "The final checkpoint has been signed off, so the selection can no longer change." };
  if (!run.stage_12_output) return { allowed: false, reason: "Stage 12 has not produced the proposition set yet." };
  if (!run.checkpoint_c_confirmed || !run.selected_smp) return { allowed: false, reason: null };
  if ((run.stage_status ?? "").startsWith("running")) return { allowed: false, reason: "A stage is still running. Choose again once it finishes." };
  return { allowed: true, reason: null };
}

/** Plain-words note shown instead of Retry on a locked run. */
export function lockedNote(reason?: string | null): string {
  return `This run is locked${reason ? ` (${reason})` : ""}. Its stages can't be retried or changed.`;
}

/** Retry (with or without notes) is offered only on unlocked runs. */
export function retryAllowed(run: { locked_at?: string | null }): boolean {
  return !run.locked_at;
}

/** Stage 13 verdict that sends the user back to choose again. */
export function stage13ReturnsToStage12(output: string | null | undefined): boolean {
  return /return\s+to\s+stage\s*12/i.test(output ?? "");
}

/** Label on every left-of-centre score so it is never compared like for like with Stage 11-validated cores. */
export const LOC_SCORE_LABEL = "Scored on future potential; not yet integrity-tested";

/** Single selection only: picking a card replaces any earlier pick (combining was removed — it never travelled downstream). */
export function pickSingle(previous: number | null, idx: number): number | null {
  return previous === idx ? null : idx;
}
