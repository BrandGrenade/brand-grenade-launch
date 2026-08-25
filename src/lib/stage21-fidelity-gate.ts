// STAGE 21 FIDELITY ENFORCEMENT — shared, browser-safe rules.
//
// A "break" verdict means a channel brief is executing a different idea, or
// has landed in the misreading the campaign must never make. Previously the
// verdict was recorded and displayed but nothing acted on it. It is now a hard
// gate in the same shape as the checkpoint gate: downstream stages refuse to
// run while a break stands, and the only way past it is a recorded human
// override with a written reason.

import type { FidelityReport } from "./stage21-fidelity-types";

export interface FidelityOverride {
  kind: "stage_21_fidelity_override";
  reason: string;
  overriddenBy: string;
  /** Channels that were in break at the moment of override. */
  channels: string[];
  /** Timestamp of the report the override was granted against. */
  reportCheckedAt: string;
  at: string;
}

export function brokenChannels(report: FidelityReport | null | undefined): string[] {
  if (!report?.results) return [];
  return report.results.filter((r) => r.verdict === "break").map((r) => r.channel);
}

/** True when the override was granted against this exact report. */
export function overrideCoversReport(
  report: FidelityReport | null | undefined,
  override: FidelityOverride | null | undefined,
): boolean {
  if (!override || !report) return false;
  if (override.reportCheckedAt !== report.checkedAt) return false;
  const outstanding = brokenChannels(report);
  return outstanding.every((c) => override.channels.includes(c));
}

/**
 * Returns a human-readable block reason, or null when work may proceed.
 * A stale override (granted against an earlier check) does not unblock.
 */
export function fidelityBlockReason(
  report: FidelityReport | null | undefined,
  override: FidelityOverride | null | undefined,
): string | null {
  const broken = brokenChannels(report);
  if (broken.length === 0) return null;
  if (overrideCoversReport(report, override)) return null;
  return (
    `Channel fidelity BREAK on ${broken.length} brief${broken.length === 1 ? "" : "s"}: ` +
    `${broken.join(", ")}. ${broken.length === 1 ? "This brief is" : "These briefs are"} executing a different idea ` +
    `to the locked campaign big idea and must not propagate. Regenerate ${broken.length === 1 ? "it" : "them"} and re-run the ` +
    `fidelity check, or record a human override with a written reason to proceed anyway.`
  );
}
