import { supabase } from "@/integrations/supabase/client";
import { ensureLockedSmpScored } from "./rescore-smp.functions";

export type LiveDocumentSession = Record<string, unknown> & {
  id?: string;
  locked_big_idea_run_id?: string | null;
  locked_big_idea?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea_lens?: string | null;
  locked_big_idea_at?: string | null;
};

/**
 * Resolves Room 04 from its authoritative relational records at the instant a
 * user opens a document. The sessions.locked_* columns remain a denormalised
 * display cache only and are never allowed to override the winning run.
 */
export async function resolveLiveDocumentSession<T extends LiveDocumentSession>(
  supplied: T,
): Promise<T> {
  if (!supplied.id) return supplied;

  const { data: current, error } = await supabase
    .from("sessions")
    .select("*, locked_big_idea_run_id")
    .eq("id", supplied.id)
    .maybeSingle();
  if (error || !current) return supplied;

  const merged = { ...supplied, ...current } as T;
  let runId = current.locked_big_idea_run_id as string | null;
  let run: {
    id: string;
    winning_direction_id: string | null;
    winning_line_direction_id: string | null;
    winning_line: string | null;
    locked_at: string | null;
  } | null = null;

  if (runId) {
    const result = await supabase
      .from("stimulus_runs")
      .select("id,winning_direction_id,winning_line_direction_id,winning_line,locked_at")
      .eq("id", runId)
      .maybeSingle();
    run = result.data;
  } else {
    const result = await supabase
      .from("stimulus_runs")
      .select("id,winning_direction_id,winning_line_direction_id,winning_line,locked_at")
      .eq("session_id", supplied.id)
      .eq("run_mode", "big_idea")
      .not("locked_at", "is", null)
      .order("locked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    run = result.data;
    runId = run?.id ?? null;
  }

  if (!run) return merged;
  const ids = [run.winning_direction_id, run.winning_line_direction_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: directions } = ids.length
    ? await supabase
        .from("stimulus_directions")
        .select("id,lens_name,direction,campaign_line")
        .in("id", ids)
    : { data: [] };
  const idea = directions?.find((row) => row.id === run?.winning_direction_id);
  const line = directions?.find((row) => row.id === run?.winning_line_direction_id);

  return {
    ...merged,
    locked_big_idea_run_id: runId,
    locked_big_idea: idea?.direction ?? merged.locked_big_idea ?? null,
    locked_big_idea_lens: idea?.lens_name ?? merged.locked_big_idea_lens ?? null,
    locked_campaign_line:
      line?.campaign_line ?? run.winning_line ?? merged.locked_campaign_line ?? null,
    locked_big_idea_at: run.locked_at ?? merged.locked_big_idea_at ?? null,
  };
}