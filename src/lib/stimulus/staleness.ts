// Staleness of a Creative Engine channel run against the session's locked idea.
//
// A stimulus_run snapshots the Stage 21 channel brief at creation time. If the
// session's locked big idea / campaign line changes afterwards, that snapshot —
// and everything orchestrated from it — is built on a superseded proposition.

export type LockSnapshot = {
  locked_big_idea_at_generation: string | null;
  locked_line_at_generation: string | null;
};

export type SessionLock = {
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
};

export type Staleness = {
  stale: boolean;
  reason: string | null;
  /** Run predates the stamping change — lineage cannot be proven either way. */
  unverifiable: boolean;
};

const norm = (v: string | null | undefined) => (v ?? "").trim();

export function runStaleness(run: LockSnapshot, session: SessionLock): Staleness {
  const nowIdea = norm(session.locked_big_idea);
  const nowLine = norm(session.locked_campaign_line);
  const wasIdea = norm(run.locked_big_idea_at_generation);
  const wasLine = norm(run.locked_line_at_generation);

  if (!wasIdea && !wasLine) {
    if (!nowIdea && !nowLine) {
      return { stale: false, reason: null, unverifiable: false };
    }
    return {
      stale: true,
      reason:
        "This run was created before its campaign idea lineage was recorded, and the session now has a locked idea. Its brief cannot be proven to match the currently locked proposition.",
      unverifiable: true,
    };
  }

  if (wasLine && nowLine && wasLine !== nowLine) {
    return {
      stale: true,
      reason: `Locked campaign line changed since this run was created ("${wasLine}" → "${nowLine}").`,
      unverifiable: false,
    };
  }
  if (wasIdea && nowIdea && wasIdea !== nowIdea) {
    return {
      stale: true,
      reason: "The locked big idea changed since this run was created.",
      unverifiable: false,
    };
  }
  if ((wasIdea || wasLine) && !nowIdea && !nowLine) {
    return {
      stale: true,
      reason:
        "The campaign idea this run was built on is no longer locked on the session.",
      unverifiable: false,
    };
  }
  return { stale: false, reason: null, unverifiable: false };
}
