// Full-set idea convergence ledger — runnable without an HTTP caller so the
// background sweep driver can build it the moment the 37th lens lands.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runConvergenceLedger, type LedgerEntry } from "./convergence-ledger.server";

export async function buildLedgerForRun(
  runId: string,
  force = false,
): Promise<{ reused: boolean; entries: LedgerEntry[]; audited: number; collisions: number }> {
  const { data: run, error: runErr } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, convergence_ledger")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error("Stimulus run not found");

  if (!force && run.convergence_ledger) {
    const entries = run.convergence_ledger as unknown as LedgerEntry[];
    return {
      reused: true,
      entries,
      audited: entries.length,
      collisions: entries.filter((e) => e.verdict === "COLLIDES").length,
    };
  }

  const { data: rows, error } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id, lens_id, lens_name, root_tension, convergence, status")
    .eq("run_id", run.id)
    .eq("status", "generated")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const ideas = (rows ?? [])
    .filter((r) => (r.root_tension ?? "").trim())
    .map((r) => ({
      lensId: r.lens_id,
      lensName: r.lens_name,
      rootTension: (r.root_tension ?? "").trim(),
    }));
  if (ideas.length === 0) return { reused: false, entries: [], audited: 0, collisions: 0 };

  const entries = await runConvergenceLedger({ sessionId: run.session_id, ideas });

  const byLens = new Map(entries.map((e) => [e.lensId, e]));
  for (const r of rows ?? []) {
    const e = byLens.get(r.lens_id);
    if (!e) continue;
    const prior = (r.convergence ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("stimulus_directions")
      .update({
        convergence: {
          ...prior,
          fullSet: {
            verdict: e.verdict,
            collidesWith: e.collidesWith,
            why: e.why,
            forced: e.forced ?? false,
          },
        } as never,
      })
      .eq("id", r.id);
  }

  await supabaseAdmin
    .from("stimulus_runs")
    .update({
      convergence_ledger: entries as never,
      convergence_ledger_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return {
    reused: false,
    entries,
    audited: entries.length,
    collisions: entries.filter((e) => e.verdict === "COLLIDES").length,
  };
}
