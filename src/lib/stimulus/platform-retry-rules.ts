// Browser-safe rules for Creative Engine platform retries. Governing principle:
// when the platform fails to apply an instruction it retries, then surfaces a
// plain platform error. The user is never pushed into rejecting, dropping or
// downgrading work to get past a platform fault.

/** Automatic retries after the first attempt (so three attempts in total). */
export const MAX_PLATFORM_RETRIES = 2;
/** Fidelity scores below this are retried, then held for an explicit decision. */
export const FIDELITY_FLOOR = 6;

export type IssueKind = "mandate" | "amendment" | "fidelity";
export interface IssueResolution {
  kind: IssueKind;
  action: "approved_with_issue";
  note: string;
  by: string;
  at: string;
}

export function rewriteFailureMessage(reason: string): string {
  return `Rewrite failed (platform error): ${reason.trim() || "unknown error"}. Your idea is unchanged.`;
}

/** Mandate/amendment compliance verdict → amendment record. */
export function amendmentStatus(verdict: string): "applied" | "partly" | "not_applied" {
  return verdict === "present" ? "applied" : verdict === "weak" ? "partly" : "not_applied";
}

/** True when another automatic attempt is allowed after `retriesUsed` retries. */
export function canRetry(retriesUsed: number): boolean {
  return retriesUsed < MAX_PLATFORM_RETRIES;
}

export function fidelityBelow(score: number | null | undefined): boolean {
  return typeof score === "number" && score < FIDELITY_FLOOR;
}

export function hasResolution(resolutions: unknown, kind: IssueKind): boolean {
  return Array.isArray(resolutions) && resolutions.some((r) => r?.kind === kind && r?.action === "approved_with_issue" && !r?.superseded_at);
}

export interface ApprovalHistoryEntry {
  kind: string;
  state: "current" | "superseded";
  by: string;
  at: string;
  note: string;
  supersededAt: string | null;
}

/** Every saved noted-issue approval, newest first, marked current or superseded. */
export function approvalHistory(resolutions: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(resolutions)) return [];
  return resolutions
    .filter((r) => r?.action === "approved_with_issue")
    .map((r) => ({
      kind: String(r.kind ?? ""),
      state: r.superseded_at ? ("superseded" as const) : ("current" as const),
      by: String(r.by ?? "unknown"),
      at: String(r.at ?? ""),
      note: String(r.note ?? ""),
      supersededAt: r.superseded_at ? String(r.superseded_at) : null,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Locked Field 1 must appear verbatim; Field 2 needs a placement statement. */
function norm(s: string) {
  return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
}
export function linesCheck(prompt: string, field1: string | null, field2: string | null): string | null {
  const p = norm(prompt);
  if (field1?.trim() && !p.includes(norm(field1))) return `Field 1 "${field1.trim()}" is not carried verbatim.`;
  if (field2?.trim() && !/field 2 placement:/i.test(prompt)) return "The prompt does not state where Field 2 appears or why this format cannot carry it.";
  return null;
}
export function field2Placement(prompt: string): string | null {
  const m = prompt.match(/FIELD 2 PLACEMENT:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

export interface GateTwoPromptRow {
  channel_name?: string | null;
  gate_two_approved?: boolean | null;
  mandate_compliance?: string | null;
  amendment_status?: string | null;
  fidelity_status?: string | null;
  issue_resolutions?: unknown;
}

/** Channels with an unresolved platform issue, each named with its reason. */
export function unresolvedIssues(active: GateTwoPromptRow[]): string[] {
  const out: string[] = [];
  for (const p of active) {
    const name = p.channel_name ?? "unnamed";
    if (p.mandate_compliance === "absent" && !hasResolution(p.issue_resolutions, "mandate"))
      out.push(`${name}: mandate absent after 2 platform retries`);
    if (p.amendment_status === "platform_failed" && !hasResolution(p.issue_resolutions, "amendment"))
      out.push(`${name}: platform could not apply the amendment`);
    if (p.fidelity_status === "below" && !hasResolution(p.issue_resolutions, "fidelity"))
      out.push(`${name}: below fidelity after 2 platform retries`);
  }
  return out;
}

export function gateTwoBlockReason(active: GateTwoPromptRow[], approvedCount: number): string | null {
  if (approvedCount === 0) return "Sign off at least one prompt before confirming Gate Two.";
  const issues = unresolvedIssues(active);
  if (issues.length > 0)
    return `Platform issues need a decision first — adapt for the channel, or approve with a noted issue: ${issues.join("; ")}.`;
  const outstanding = active.filter((p) => !p.gate_two_approved);
  if (outstanding.length > 0)
    return `${outstanding.length} prompt(s) still awaiting a Gate Two decision — sign off or send back each one first.`;
  return null;
}
