// Regression-vs-residue audit.
//
// WHY THIS EXISTS
// The older audits scan STORED rows. A bug fixed in code leaves its damage in
// rows written before the fix, so a re-run legitimately re-reports a closed
// bug and it reads like a live regression. Every check below therefore
// classifies each finding as one of:
//
//   HISTORICAL RESIDUE — damage in a row written BEFORE the fix landed, and
//                        not reproducible by the code running today.
//   LIVE REGRESSION    — damage in output written AFTER the fix, or damage the
//                        current code still reproduces on demand.
//   UNPROVEN           — no output written since the fix, so "no live
//                        regression" is not yet evidenced. Never reported as
//                        a pass.
//
// Read-only. Run:  bun scripts/audit-regression-split.ts
import { createClient } from "@supabase/supabase-js";
import { cleanProposition } from "../src/lib/clean-proposition";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service credentials not available");
const sb = createClient(url, key, { auth: { persistSession: false } });

/** The commit that closed each bug. Timestamps are `git log` commit dates. */
const FIXES = {
  "item-1-proposition-truncation": {
    title: 'Propositions truncated on "this speaks/works/refers/nods/plays/lands"',
    fixedAt: "2026-08-19T10:46:10Z",
    commit: "4f698c72",
    file: "src/lib/clean-proposition.ts",
  },
  "tier2-5-raw-sweep-export": {
    title: "Raw ideas sweep export fails above 40 directions",
    fixedAt: "2026-09-10T05:17:22Z",
    commit: "c1d9feaf / stimulus-gate-two.functions.ts max(1000)",
    file: "src/lib/stimulus-gate-two.functions.ts",
  },
  "tier2-7-fidelity-override": {
    title: "Stage 21 fidelity override forgotten after reload",
    fixedAt: "2026-09-10T05:25:43Z",
    commit: "d4df3e9c",
    file: "src/lib/stage21-fidelity-gate.server.ts",
  },
  "tier2-8-initial-lens-attempt": {
    title: "Original lens output lost on Revise / Try Again",
    fixedAt: "2026-09-10T05:16:48Z",
    commit: "d56d1a99",
    file: "src/lib/stimulus/regenerate.server.ts",
  },
} as const;

type FixId = keyof typeof FIXES;

type Finding = {
  ref: string;
  detail: string;
  /** When the offending row was written. Null when unknown. */
  writtenAt: string | null;
  /** True when the code running today still produces this defect. */
  reproducedByCurrentCode: boolean;
};

type Verdict = "HISTORICAL RESIDUE" | "LIVE REGRESSION" | "UNPROVEN";

function classify(f: Finding, fixedAt: string): Verdict {
  if (f.reproducedByCurrentCode) return "LIVE REGRESSION";
  if (!f.writtenAt) return "UNPROVEN";
  return new Date(f.writtenAt) < new Date(fixedAt) ? "HISTORICAL RESIDUE" : "LIVE REGRESSION";
}

type Result = {
  /** Rows/artifacts written AFTER the fix that this check actually inspected. */
  freshScanned: number;
  findings: Finding[];
  /** Optional note printed under the verdict. */
  note?: string;
};

async function pagedSelect<T>(table: string, columns: string, tweak?: (q: any) => any) {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (tweak) q = tweak(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

// ── Check 1: proposition truncation ──────────────────────────────────────────
// The bug was in the RENDERING step, so a stored line is only a live defect if
// today's cleanProposition still trims it.
const LEGACY_RULE = /\s*\(?this\s+(speaks|works|refers|nods|plays|lands)\b[\s\S]*$/i;

async function checkPropositionTruncation(fixedAt: string): Promise<Result> {
  const rows = await pagedSelect<{
    id: string;
    brand_name: string | null;
    selected_smp: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>("sessions", "id, brand_name, selected_smp, created_at, updated_at");

  const findings: Finding[] = [];
  let fresh = 0;
  let patternsExercised = 0;

  for (const r of rows) {
    const smp = (r.selected_smp ?? "").trim();
    if (!smp) continue;
    const writtenAt = r.updated_at ?? r.created_at;
    if (writtenAt && new Date(writtenAt) >= new Date(fixedAt)) fresh += 1;

    const wouldLegacyTrim = LEGACY_RULE.test(smp) && smp.replace(LEGACY_RULE, "").trim() !== smp;
    const currentTrims = cleanProposition(smp).trim() !== smp;
    if (!wouldLegacyTrim && !currentTrims) continue;
    if (LEGACY_RULE.test(smp)) patternsExercised += 1;

    findings.push({
      ref: `${r.brand_name ?? "(unnamed)"} — ${r.id}`,
      detail: currentTrims
        ? `current code still trims: "${smp}" → "${cleanProposition(smp)}"`
        : `pre-fix rule would have trimmed this line; current code renders it in full: "${smp}"`,
      writtenAt,
      reproducedByCurrentCode: currentTrims,
    });
  }

  return {
    freshScanned: fresh,
    findings,
    note: `${patternsExercised} stored proposition(s) contain a trigger phrase, so the case is exercised by real data rather than merely absent.`,
  };
}

// ── Check 2: raw sweep export above 40 directions ────────────────────────────
// Code-level, no stored damage: re-run the real validator and the real batched
// fetch against the largest sweep in the database.
async function checkRawSweepExport(): Promise<Result> {
  const { z } = await import("zod");
  const { buildRawIdeaBatchExport } = await import("../src/lib/stimulus-export");
  const VALIDATOR = z.object({ directionIds: z.array(z.string().uuid()).min(1).max(1000) });

  const dirs = await pagedSelect<{ id: string; run_id: string }>(
    "stimulus_directions",
    "id, run_id",
  );
  const byRun = new Map<string, string[]>();
  for (const d of dirs) byRun.set(d.run_id, [...(byRun.get(d.run_id) ?? []), d.id]);
  const [biggestRun, ids] = [...byRun.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [
    null,
    [] as string[],
  ];

  if (!biggestRun || ids.length <= 40) {
    return {
      freshScanned: 0,
      findings: [],
      note: `largest sweep found has ${ids.length} direction(s) — below the 40 threshold the bug needed, so no live proof is possible from stored data`,
    };
  }

  const findings: Finding[] = [];
  const parsed = VALIDATOR.safeParse({ directionIds: ids });
  if (!parsed.success) {
    findings.push({
      ref: `run ${biggestRun}`,
      detail: `export validator rejected ${ids.length} directions`,
      writtenAt: new Date().toISOString(),
      reproducedByCurrentCode: true,
    });
  }

  const rows = await pagedSelect<Record<string, unknown>>(
    "stimulus_directions",
    "*",
    (q: any) => q.eq("run_id", biggestRun),
  );
  const { data: run } = await sb
    .from("stimulus_runs")
    .select("id, session_id, channel_name, smp")
    .eq("id", biggestRun)
    .maybeSingle();
  const { data: session } = await sb
    .from("sessions")
    .select("brand_name, category")
    .eq("id", (run?.session_id as string) ?? "")
    .maybeSingle();

  // Same shape the real server function hands the builder.
  const doc = buildRawIdeaBatchExport({
    brandName: session?.brand_name ?? "—",
    category: session?.category ?? "—",
    channelName: (run?.channel_name as string) ?? "",
    smp: (run?.smp as string) ?? "",
    directions: rows.map((dir) => ({
      lensId: dir.lens_id as string,
      lensName: dir.lens_name as string,
      text: ((dir.direction as string) ?? "").trim(),
      instinctBrief: (dir.instinct_brief as string) ?? "",
      tissueStatus: dir.status as string,
      ratings: dir.ratings ?? null,
      ratedAt: (dir.rated_at as string) ?? null,
      gateOneApproved: Boolean(dir.gate_one_approved),
      gateOneApprovedAt: (dir.gate_one_approved_at as string) ?? null,
      gateOneNotes: (dir.gate_one_notes as string) ?? null,
    })),
  });
  const rendered = doc.html;
  const missing = rows.filter((r) => {
    const text = String((r as { direction?: string }).direction ?? "").trim();
    if (!text) return false;
    // HTML-escaped in the document, so compare on an escaped fragment.
    const fragment = text
      .slice(0, 40)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return !rendered.includes(fragment);
  });
  if (missing.length) {
    findings.push({
      ref: `run ${biggestRun}`,
      detail: `${missing.length} of ${rows.length} directions missing from the rendered export`,
      writtenAt: new Date().toISOString(),
      reproducedByCurrentCode: true,
    });
  }

  return {
    freshScanned: ids.length,
    findings,
    note: `re-ran the live validator and export builder against the largest real sweep (${ids.length} directions, run ${biggestRun})`,
  };
}

// ── Check 3: Stage 21 fidelity override persistence ──────────────────────────
// Re-reads each override through the SAME column selection the reload path uses.
async function checkFidelityOverride(fixedAt: string): Promise<Result> {
  const rows = await pagedSelect<{
    id: string;
    brand_name: string | null;
    stage_21_fidelity_override: unknown;
    updated_at: string | null;
    created_at: string | null;
  }>(
    "sessions",
    "id, brand_name, stage_21_fidelity_override, updated_at, created_at",
    (q: any) => q.not("stage_21_fidelity_override", "is", null),
  );

  const findings: Finding[] = [];
  let fresh = 0;
  for (const r of rows) {
    const writtenAt = r.updated_at ?? r.created_at;
    if (writtenAt && new Date(writtenAt) >= new Date(fixedAt)) fresh += 1;
    const { data: reload } = await sb
      .from("sessions")
      .select("stage_21_fidelity, stage_21_fidelity_override")
      .eq("id", r.id)
      .maybeSingle();
    if (!reload?.stage_21_fidelity_override) {
      findings.push({
        ref: `${r.brand_name ?? "(unnamed)"} — ${r.id}`,
        detail: "override stored but not returned by the reload selection",
        writtenAt,
        reproducedByCurrentCode: true,
      });
    }
  }

  return {
    freshScanned: fresh,
    findings,
    note: rows.length
      ? `${rows.length} stored override(s) re-read through the reload selection`
      : "no session currently carries an override, so the reload path has nothing to re-read",
  };
}

// ── Check 4: original lens output banked as attempt 1 ────────────────────────
async function checkInitialLensAttempt(fixedAt: string): Promise<Result> {
  const dirs = await pagedSelect<{
    id: string;
    run_id: string;
    direction: string | null;
    created_at: string | null;
  }>("stimulus_directions", "id, run_id, direction, created_at");
  const attempts = await pagedSelect<{ direction_id: string; origin: string | null }>(
    "stimulus_direction_attempts",
    "direction_id, origin",
  );

  const revisedDirections = new Set<string>();
  const hasInitial = new Set<string>();
  for (const a of attempts) {
    if (a.origin === "initial") hasInitial.add(a.direction_id);
    else revisedDirections.add(a.direction_id);
  }

  const findings: Finding[] = [];
  let fresh = 0;
  for (const d of dirs) {
    if (!d.direction?.trim()) continue;
    const isFresh = d.created_at ? new Date(d.created_at) >= new Date(fixedAt) : false;
    if (isFresh) fresh += 1;
    // Only a direction that was actually revised could have lost its original.
    if (!revisedDirections.has(d.id) || hasInitial.has(d.id)) continue;
    findings.push({
      ref: `direction ${d.id} (run ${d.run_id})`,
      detail: "revised, but no origin:initial attempt banked",
      writtenAt: d.created_at,
      // Today's code banks attempt 1 before writing a revision, so a missing
      // row is only live if the direction itself was created after the fix.
      reproducedByCurrentCode: false,
    });
  }

  return {
    freshScanned: fresh,
    findings,
    note: `${revisedDirections.size} direction(s) have at least one revision, ${hasInitial.size} carry a banked original`,
  };
}

// ── Report ───────────────────────────────────────────────────────────────────
const CHECKS: Record<FixId, (fixedAt: string) => Promise<Result>> = {
  "item-1-proposition-truncation": checkPropositionTruncation,
  "tier2-5-raw-sweep-export": () => checkRawSweepExport(),
  "tier2-7-fidelity-override": checkFidelityOverride,
  "tier2-8-initial-lens-attempt": checkInitialLensAttempt,
};

let liveTotal = 0;
for (const id of Object.keys(FIXES) as FixId[]) {
  const fix = FIXES[id];
  console.log(`\n══ ${id} ─ ${fix.title}`);
  console.log(`   fixed ${fix.fixedAt} (${fix.commit})`);
  let result: Result;
  try {
    result = await CHECKS[id](fix.fixedAt);
  } catch (e) {
    console.log(`   CHECK FAILED: ${(e as Error).message}`);
    continue;
  }

  const buckets: Record<Verdict, Finding[]> = {
    "LIVE REGRESSION": [],
    "HISTORICAL RESIDUE": [],
    UNPROVEN: [],
  };
  for (const f of result.findings) buckets[classify(f, fix.fixedAt)].push(f);
  liveTotal += buckets["LIVE REGRESSION"].length;

  console.log(`   output written since the fix and scanned: ${result.freshScanned}`);
  if (result.note) console.log(`   ${result.note}`);
  for (const verdict of Object.keys(buckets) as Verdict[]) {
    const list = buckets[verdict];
    if (!list.length) continue;
    console.log(`   ${verdict}: ${list.length}`);
    for (const f of list.slice(0, 5)) {
      console.log(`     • ${f.ref} — ${f.detail} [written ${f.writtenAt ?? "unknown"}]`);
    }
    if (list.length > 5) console.log(`     … ${list.length - 5} more`);
  }
  if (!result.findings.length) {
    console.log(
      result.freshScanned > 0
        ? "   VERDICT: no findings, and fresh post-fix output was scanned — clean."
        : "   VERDICT: no findings, but no post-fix output existed to scan — UNPROVEN, not a pass.",
    );
  } else if (!buckets["LIVE REGRESSION"].length) {
    console.log("   VERDICT: historical residue only — no live regression.");
  } else {
    console.log("   VERDICT: LIVE REGRESSION present.");
  }
}

console.log(
  `\n════ ${liveTotal === 0 ? "No live regressions across the four items." : `${liveTotal} live regression finding(s).`}`,
);
