// Wrong-slot protection for rewrite/regeneration requests.
//
// Every rewrite is keyed by a single direction UUID server-side, so the write
// itself can only ever touch one row. The failure mode this guards is one step
// earlier: the CALLER supplying the wrong row's id — a stale card, a
// copy-pasted instruction, a re-submitted request after the list re-sorted.
// The instruction text itself almost always names its intended target
// ("Rewrite idea #17, 'The Cultural Signal'"), so we can verify the caller's
// stated intent against the row actually being written and refuse a mismatch.

export interface ReviseTarget {
  /** 1-based slot number shown in the UI (sort_order + 1). */
  slot: number;
  lensName: string;
}

/** Extracts the idea number an instruction explicitly names, if any. */
export function namedSlotInNotes(notes: string): number | null {
  const m = /\bidea\s*#\s*(\d{1,2})\b/i.exec(notes) ?? /#\s*(\d{1,2})\b/.exec(notes);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null;
}

/**
 * Throws when the rewrite instruction names a different idea from the row the
 * request is about to write to, or when the caller's expected identity does not
 * match the stored row.
 */
export function assertReviseTarget(opts: {
  notes?: string;
  actual: ReviseTarget;
  expected?: { slot?: number | null; lensName?: string | null; lensId?: string | null };
  actualLensId?: string;
}): void {
  const { notes, actual, expected, actualLensId } = opts;

  if (expected?.slot != null && expected.slot !== actual.slot) {
    throw new Error(
      `Rewrite refused: this request was raised against idea #${expected.slot}, but the target row is idea #${actual.slot} (${actual.lensName}). Nothing was written.`,
    );
  }
  if (
    expected?.lensId &&
    actualLensId &&
    expected.lensId.trim().toLowerCase() !== actualLensId.trim().toLowerCase()
  ) {
    throw new Error(
      `Rewrite refused: this request was raised against lens "${expected.lensId}", but the target row is "${actualLensId}". Nothing was written.`,
    );
  }

  const named = notes ? namedSlotInNotes(notes) : null;
  if (named != null && named !== actual.slot) {
    throw new Error(
      `Rewrite refused: the instruction names idea #${named}, but this request targets idea #${actual.slot} (${actual.lensName}). Re-issue it from idea #${named}'s own card. Nothing was written.`,
    );
  }
}
