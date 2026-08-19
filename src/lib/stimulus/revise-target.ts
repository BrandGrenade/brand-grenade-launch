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

/**
 * Extracts the idea number an instruction explicitly names AS ITS OWN TARGET.
 *
 * Only an imperative rewrite phrase counts ("rewrite idea #17", "redo #4").
 * A comparative or referential mention — "make this more like idea #3",
 * "closer in tone to #9" — is about a different card and must never block the
 * write (Issue 3).
 */
const TARGETING_VERB = /(rewrite|redo|regenerate|revise|replace|change|fix|update|amend|reword)/i;
const REFERENTIAL_LEAD = /(like|as|similar to|closer to|compare|compared to|reference|referencing|inspired by|see|per|unlike|than|from)\s+(idea\s*)?$/i;

export function namedSlotInNotes(notes: string): number | null {
  const re = /(?:\bidea\s*)?#\s*(\d{1,2})\b/gi;
  for (let m = re.exec(notes); m; m = re.exec(notes)) {
    const before = notes.slice(0, m.index);
    // Skip comparative references: "... more like idea #3".
    if (REFERENTIAL_LEAD.test(before.replace(/\s+$/, " "))) continue;
    // Only an imperative targeting verb within the preceding clause counts.
    const clause = before.split(/[.;\n]/).pop() ?? "";
    if (!TARGETING_VERB.test(clause)) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 99) return n;
  }
  return null;
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
