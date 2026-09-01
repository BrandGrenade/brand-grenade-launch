// Single source of truth for "which sweep is the operative one" and "which
// orchestration attempt actually shipped". Every surface that reports lens,
// direction or prompt figures must resolve them through here so the numbers
// agree across the app, the exports and the summary documents.
//
// Operative sweep: the big-idea run that holds the Gate One keeps. If no run
// holds a keep, the largest (most populated) run wins. Abandoned or superseded
// runs never contribute to the counts.
//
// Operative orchestration: the Gate Two-confirmed run, else the newest complete
// one. Superseded attempts are excluded — their prompts are not deliverables.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = { from: (t: string) => any };

export type OperativeSweep = {
  runId: string | null;
  /** Direction ids of the operative sweep, in sort order. */
  directionIds: string[];
  /** Distinct lens names in the operative sweep — the real lens count. */
  lensCount: number;
  /** Gate One approved direction ids for the session (all big-idea runs). */
  shortlistIds: string[];
};

export async function selectOperativeSweep(
  sb: Client,
  sessionId: string,
): Promise<OperativeSweep> {
  const { data: runs } = await sb
    .from("stimulus_runs")
    .select("id, created_at")
    .eq("session_id", sessionId)
    .eq("run_mode", "big_idea")
    .order("created_at", { ascending: false });
  const runIds: string[] = ((runs ?? []) as any[]).map((r) => String(r.id));
  if (!runIds.length) return { runId: null, directionIds: [], lensCount: 0, shortlistIds: [] };

  const { data: dirs } = await sb
    .from("stimulus_directions")
    .select("id, run_id, lens_name, sort_order, gate_one_approved, direction")
    .in("run_id", runIds)
    .order("sort_order", { ascending: true });
  const all = ((dirs ?? []) as any[]).filter(
    (d) => String(d.direction ?? "").trim().length > 0,
  );

  const order = new Map(runIds.map((id, i) => [id, i]));
  const byRun = new Map<string, any[]>();
  for (const d of all) {
    const list = byRun.get(d.run_id) ?? [];
    list.push(d);
    byRun.set(d.run_id, list);
  }
  const score = (rows: any[]) => rows.filter((d) => d.gate_one_approved).length;
  const runId =
    [...byRun.entries()].sort((a, b) => {
      const keeps = score(b[1]) - score(a[1]);
      if (keeps) return keeps;
      const size = b[1].length - a[1].length;
      if (size) return size;
      return (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0);
    })[0]?.[0] ?? null;

  const sweep = runId ? (byRun.get(runId) ?? []) : [];
  return {
    runId,
    directionIds: sweep.map((d) => d.id as string),
    lensCount: new Set(sweep.map((d) => d.lens_name).filter(Boolean)).size,
    shortlistIds: all.filter((d) => d.gate_one_approved).map((d) => d.id as string),
  };
}

/** The orchestration attempt whose prompts are the real deliverable. */
export async function selectOperativeOrchestration(
  sb: Client,
  sessionId: string,
): Promise<any | null> {
  const { data } = await sb
    .from("stimulus_orchestrations")
    .select("id, status, gate_two_confirmed, gate_two_confirmed_at, updated_at, registry_version")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as any[];
  return rows.find((r) => r.gate_two_confirmed) ?? rows.find((r) => r.status === "complete") ?? null;
}

/** Prompts belonging to the operative orchestration only. */
export async function countOperativePrompts(sb: Client, sessionId: string): Promise<number> {
  const orch = await selectOperativeOrchestration(sb, sessionId);
  if (!orch) return 0;
  const { count } = await sb
    .from("stimulus_prompts")
    .select("id", { count: "exact", head: true })
    .eq("orchestration_id", orch.id);
  return count ?? 0;
}
