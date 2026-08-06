// Tier Two severity classification.
//
// Failures are NOT equal. This module maps every failed check to one of four
// severities based on the OBJECTIVE impact on output/pipeline integrity,
// hardcoded by check-id + failure signature. It is triage, not leniency:
//
//   BLOCKER   — affects output correctness or pipeline completion. Only
//               blockers trigger "do not present live / do not run pipelines".
//   DEGRADED  — platform works and produces correct output but something is
//               suboptimal (slow stage, excessive retries, non-critical output
//               shorter than target). Shown as a warning; does NOT block use.
//   HARNESS   — the CHECK itself is wrong, not the platform (drift between a
//               check and the runtime rule, stale remediation text, a check
//               testing an outdated rule). Shown as "test needs updating";
//               never blocks use.
//   TRANSIENT — external/infrastructure fault, not a platform bug (Claude
//               returns empty, Worker dies with no partial output and no
//               persisted error, watchdog catches it). Shown as "transient
//               fault — re-run"; does NOT block use. IF the same check
//               transient-fails across multiple consecutive runs, it is
//               escalated to BLOCKER — a "transient" that recurs every run
//               is a real bug.
//
// SKIPPED is a distinct rendered state, not a severity: a cascade-skip
// because an earlier check failed. Skipped checks are NOT counted as
// failures. Right now one real failure shows as seven, which is misleading;
// this fixes that.
//
// Severity assignments are hardcoded per failure pattern per check-id.
// They are not user-tunable. A real blocker must always read as a blocker;
// a recurring transient must escalate to blocker.

import type { FullCheckId, FullCheckResult } from "./preflight-tier-two.functions";

export type Severity = "blocker" | "degraded" | "harness" | "transient";

export type ClassifiedStatus =
  | { kind: "pass" }
  | { kind: "pending" }
  | { kind: "running" }
  | { kind: "skipped"; dependencyDetail: string }
  | { kind: "fail"; severity: Severity; reason: string; note?: string };

export interface SeveritySummary {
  blocker: number;
  degraded: number;
  harness: number;
  transient: number;
  skipped: number;
  passed: number;
  pending: number;
  running: number;
}

// -----------------------------------------------------------------------------
// Pattern → severity mapping. Patterns are checked in order; first match wins.
// Each check-id has an ordered list ending with its DEFAULT severity for
// unmatched failure text (so classification is total).
// -----------------------------------------------------------------------------

interface Rule {
  match: RegExp;
  severity: Severity;
  reason: string;
  note?: string;
}

// Patterns that apply to every check (external faults, watchdog trips) and are
// checked BEFORE per-check rules so a Worker death is called transient no
// matter which stage it hit.
const GLOBAL_TRANSIENT_RULES: Rule[] = [
  {
    // Claude returned literally nothing. Not a platform bug — the API blipped.
    match: /empty response|Claude returned an empty|no content from Claude/i,
    severity: "transient",
    reason: "External API returned empty; platform code was correct.",
    note: "Re-run. If this recurs across consecutive runs it will auto-escalate to BLOCKER.",
  },
  {
    // Watchdog trip. With the new stream-liveness heartbeat, a trip means
    // either (a) Worker died with no tokens flowing (true external death →
    // TRANSIENT) or (b) Anthropic stream stalled mid-response (also external
    // → TRANSIENT). The old DB-write watchdog false-killed live streams; that
    // class is fixed by per-stage thresholds + heartbeat, so trips are now
    // safely called transient.
    match: /Watchdog:.*no stream heartbeat|Watchdog:.*no DB write|Server Worker presumed dead/i,
    severity: "transient",
    reason: "Watchdog tripped — Worker presumed dead or Anthropic stream stalled.",
    note:
      "Inspect the preserved session: partial output present = harness false-kill (raise per-stage threshold); output NULL = genuine external death (re-run).",
  },
  {
    // Anthropic 5xx / rate-limit / overloaded errors surface with these words.
    match: /overloaded|rate.?limit|529|503 |ECONNRESET|ETIMEDOUT|fetch failed/i,
    severity: "transient",
    reason: "External API/network fault surfaced through Anthropic client.",
  },
];

const PER_CHECK_RULES: Record<FullCheckId, Rule[]> = {
  stage_1_brief_analysis: [
    // Default: brief analysis breaking is a blocker — nothing downstream can run.
    { match: /.*/, severity: "blocker", reason: "Stage 1 unable to analyse the brief; pipeline entry point failed." },
  ],
  phase1a_chain_2_to_7: [
    // A specific stage inside the chain threw a wiring / schema error.
    {
      match: /Zod|invalid_type|Required|schema|missing (?:input|field)/i,
      severity: "blocker",
      reason: "Schema / field-wiring failure inside Phase 1A chain.",
    },
    { match: /.*/, severity: "blocker", reason: "A Phase 1A stage failed to complete." },
  ],
  stage_8_checkpoint_b: [
    {
      match: /checkpoint.*(?:not|failed).*(?:fire|persist|confirm)/i,
      severity: "blocker",
      reason: "Checkpoint B gate failed to fire — user confirmation flow is broken.",
    },
    { match: /.*/, severity: "blocker", reason: "Stage 8 / Checkpoint B did not complete." },
  ],
  stage_prompts_integrity: [
    // This check reads prompt files. Any failure is a structural check on
    // the harness's own file list — never a runtime platform problem.
    { match: /.*/, severity: "harness", reason: "Structural check on system-prompt files; test list may need updating." },
  ],
  stage_9_edt_guard_output: [
    {
      // A conditional word appearing in a column when the runtime gate would
      // have allowed it is drift between the check and the runtime rule.
      // These are false failures — HARNESS, not BLOCKER.
      match: /conditional.*banned|banned in the (?:core|left.?of.?centre) column/i,
      severity: "harness",
      reason: "Check enforces stricter rule than the runtime gate — check drift, not a leak.",
      note: "Align this check's word-list logic with stage9-banned-words.ts (conditional words are only blocked when a competitor owns them).",
    },
    {
      // An ACTUAL banned word reaching persisted output is a real leak.
      match: /banned word.*(?:persisted|output|leaked|reached)/i,
      severity: "blocker",
      reason: "Banned word reached persisted stage output — sanitiser bypass.",
    },
    { match: /.*/, severity: "blocker", reason: "Stage 9 EDT guard produced invalid output." },
  ],
  stage_10_11_evaluation_chain: [
    { match: /.*/, severity: "blocker", reason: "Evaluation chain failed to score / rank propositions." },
  ],
  stage_12_smp_selection: [
    {
      match: /no VALIDATED SMPs|empty validated set|Stage 11 produced no/i,
      severity: "blocker",
      reason: "Stage 11 eliminated every SMP — nothing to feed Stage 12.",
      note: "Content-quality failure — inspect Stage 9 propositions and Stage 11 verdicts in preserved session.",
    },
    {
      match: /rationale|selection.*(?:missing|not persisted)/i,
      severity: "blocker",
      reason: "SMP selection / rationale did not persist.",
    },
    { match: /.*/, severity: "blocker", reason: "Stage 12 SMP selection failed." },
  ],
  phase1_completion_13_to_16: [
    {
      match: /Stage 16 gate.*(?:not|failed).*lock/i,
      severity: "blocker",
      reason: "Stage 16 gate failed to lock pre-Phase 2 — assembly ran too early.",
    },
    {
      match: /shorter than target|below (?:target|minimum) length|word count/i,
      severity: "degraded",
      reason: "Output present but below target length; usable but sub-optimal.",
    },
    { match: /.*/, severity: "blocker", reason: "A Stage 13–15 output failed to persist." },
  ],
  sanitiser_and_token_caps: [
    {
      match: /token cap.*(?:missing|not set|out of range)|sanitiser.*(?:not applied|missing|misconfigured)/i,
      severity: "harness",
      reason: "Static configuration check — usually reflects test drift when a cap is intentionally changed.",
    },
    {
      match: /banned word.*(?:leaked|reached|persisted)/i,
      severity: "blocker",
      reason: "Sanitiser bypass — banned content reached persisted output.",
    },
    { match: /.*/, severity: "harness", reason: "Structural check on sanitiser / token-cap configuration." },
  ],
  phase2_detonation_chain: [
    {
      match: /Zod|invalid_type|Required|audienceInput|schema/i,
      severity: "blocker",
      reason: "Phase 2 schema / field-wiring failure.",
    },
    { match: /.*/, severity: "blocker", reason: "A Phase 2 stage (17–22) failed to complete." },
  ],
  canvas_to_detonation_navigation: [
    {
      match: /route not (?:found|registered)|404|not registered/i,
      severity: "harness",
      reason: "Route registration check — usually test drift after a route rename.",
    },
    { match: /.*/, severity: "blocker", reason: "Canvas → Detonation navigation broken." },
  ],
  concurrent_session_integrity: [
    {
      match: /cross.?talk|session.*(?:leak|contaminat)|shared state/i,
      severity: "blocker",
      reason: "Concurrent sessions contaminated each other — session isolation broken.",
    },
    { match: /.*/, severity: "blocker", reason: "Concurrent Stage 1 integrity check failed." },
  ],
  loc_track_integrity: [
    {
      match: /rate.?limit|overloaded|529|timed? ?out/i,
      severity: "transient",
      reason: "LOC engines hit an upstream model rate limit / overload — re-run.",
      note: "If this recurs across consecutive runs it will auto-escalate to BLOCKER.",
    },
    {
      match: /engines returned no usable output|engines never reported|missing from loc_decision_packages|not a single word/i,
      severity: "blocker",
      reason: "One or more of the 13 LOC engines silently produced nothing — the Engine 12 failure class.",
    },
    {
      match: /anchor|validation|nulled/i,
      severity: "blocker",
      reason: "LOC anchor gate or validation pass degraded — candidates would reach Checkpoint C unvalidated.",
    },
    { match: /.*/, severity: "blocker", reason: "Left-of-Centre track integrity check failed." },
  ],
  smp_verbatim_carriage_20_20b_21: [
    {
      match: /rate.?limit|overloaded|529|timed? ?out/i,
      severity: "transient",
      reason: "Stage 20/20B/21 regeneration hit an upstream model overload — re-run.",
    },
    {
      match: /No selected_smp|no Stage 2[01]|outputs missing/i,
      severity: "harness",
      reason: "The TestBrand session never reached Stage 21, so carriage could not be sampled.",
    },
    {
      match: /.*/,
      severity: "blocker",
      reason: "The SMP did not survive Stage 20 → 20B → 21 verbatim — channel briefs are reinterpreting the platform.",
    },
  ],
};

// -----------------------------------------------------------------------------
// Classifier
// -----------------------------------------------------------------------------

function isSkippedDetail(detail: string | null): boolean {
  if (!detail) return false;
  return /^\s*Skipped:/i.test(detail) || /^\s*Check \d+ failed: Skipped:/i.test(detail);
}

function matchRules(rules: Rule[], detail: string): Rule | null {
  for (const r of rules) if (r.match.test(detail)) return r;
  return null;
}

/**
 * Classify a single check result. Recurrence data (prior run details for the
 * same check) is used to escalate a repeating transient into a blocker.
 */
export function classifyResult(
  result: FullCheckResult,
  priorFailureDetails: string[] = [],
): ClassifiedStatus {
  if (result.status === "pass") return { kind: "pass" };
  if (result.status === "pending") return { kind: "pending" };
  if (result.status === "running") return { kind: "running" };

  const detail = result.detail ?? "";
  if (isSkippedDetail(detail)) {
    return { kind: "skipped", dependencyDetail: detail.replace(/^\s*(Check \d+ failed:\s*)?Skipped:\s*/i, "") };
  }

  // Global patterns first (external/infra faults trump per-check reasons).
  const globalHit = matchRules(GLOBAL_TRANSIENT_RULES, detail);
  const perCheck = PER_CHECK_RULES[result.id as FullCheckId];
  const perCheckHit = perCheck ? matchRules(perCheck, detail) : null;

  let hit: Rule = globalHit ?? perCheckHit ?? {
    match: /.*/,
    severity: "blocker",
    reason: "Unclassified failure — treated as blocker.",
  };

  // Recurrence escalation: a transient that recurs across runs is a real bug.
  // Threshold: same check transient-failed in >=2 of the prior runs (i.e. this
  // is the 3rd consecutive transient with a matching signature).
  if (hit.severity === "transient" && priorFailureDetails.length >= 2) {
    const priorTransientCount = priorFailureDetails.filter((d) => {
      const g = matchRules(GLOBAL_TRANSIENT_RULES, d);
      return g?.severity === "transient";
    }).length;
    if (priorTransientCount >= 2) {
      hit = {
        ...hit,
        severity: "blocker",
        reason: `Recurring transient — same check failed transient-style in ${priorTransientCount + 1} consecutive runs; escalated to BLOCKER.`,
        note: "A transient that repeats is a real bug: investigate the stage, not the infrastructure.",
      };
    }
  }

  return { kind: "fail", severity: hit.severity, reason: hit.reason, note: hit.note };
}

/**
 * Summarise severities across the whole run. Skipped checks are NOT counted
 * as failures.
 */
export function summariseSeverities(
  results: FullCheckResult[],
  priorRuns: FullCheckResult[][] = [],
): { summary: SeveritySummary; classified: Array<{ result: FullCheckResult; classified: ClassifiedStatus }> } {
  const summary: SeveritySummary = {
    blocker: 0,
    degraded: 0,
    harness: 0,
    transient: 0,
    skipped: 0,
    passed: 0,
    pending: 0,
    running: 0,
  };
  const classified = results.map((result) => {
    const priorDetails = priorRuns
      .map((run) => run.find((r) => r.id === result.id))
      .filter((r): r is FullCheckResult => !!r && r.status === "fail" && !isSkippedDetail(r.detail))
      .map((r) => r.detail ?? "");
    const c = classifyResult(result, priorDetails);
    switch (c.kind) {
      case "pass": summary.passed += 1; break;
      case "pending": summary.pending += 1; break;
      case "running": summary.running += 1; break;
      case "skipped": summary.skipped += 1; break;
      case "fail": summary[c.severity] += 1; break;
    }
    return { result, classified: c };
  });
  return { summary, classified };
}

/** Only blockers trigger "do not present live". */
export function shouldBlockPresentation(summary: SeveritySummary): boolean {
  return summary.blocker > 0;
}

export const SEVERITY_LABEL: Record<Severity | "skipped", string> = {
  blocker: "BLOCKER",
  degraded: "DEGRADED",
  harness: "HARNESS",
  transient: "TRANSIENT",
  skipped: "SKIPPED",
};

export const SEVERITY_COLOR: Record<Severity | "skipped", { text: string; bg: string; border: string }> = {
  blocker:   { text: "text-red-300",    bg: "bg-red-950/40",    border: "border-red-700/60" },
  degraded:  { text: "text-amber-300",  bg: "bg-amber-950/40",  border: "border-amber-700/60" },
  harness:   { text: "text-sky-300",    bg: "bg-sky-950/40",    border: "border-sky-700/60" },
  transient: { text: "text-neutral-300", bg: "bg-neutral-900/40", border: "border-neutral-700/60" },
  skipped:   { text: "text-neutral-400", bg: "bg-neutral-900/40", border: "border-neutral-700/40" },
};
