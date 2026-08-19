import { supabase } from "@/integrations/supabase/client";
import { ensureLockedSmpScored } from "./rescore-smp.functions";

export type LiveDocumentSession = Record<string, unknown> & {
  id?: string;
  locked_big_idea_run_id?: string | null;
  locked_big_idea?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea_lens?: string | null;
  locked_big_idea_at?: string | null;
  locked_source_fallback?: string | null;
};

/** Surface a visible warning when a document falls back to cached locked values. */
function warnFallback(reason: string) {
  const message = `Using saved locked creative idea — ${reason}. Document may not reflect the latest re-lock.`;
  console.warn(`[document-live-source] ${message}`);
  void import("sonner")
    .then(({ toast }) => toast.warning("Locked idea served from saved copy", { description: message, duration: 8000 }))
    .catch(() => {});
}


/**
 * Resolves Room 04 from its authoritative relational records at the instant a
 * user opens a document. The sessions.locked_* columns remain a denormalised
 * display cache only and are never allowed to override the winning run.
 */
export async function resolveLiveDocumentSession<T extends LiveDocumentSession>(
  supplied: T,
): Promise<T> {
  if (!supplied.id) return supplied;

  // Governance rule: every document must report a real score for the exact
  // proposition it recommends. The score is cached against the proposition
  // text, so this is a single cheap read; when the proposition has changed the
  // scoring pass runs in the BACKGROUND and the user is told, rather than the
  // open blocking on three live scoring calls (Issue 1).
  try {
    const r = (await ensureLockedSmpScored({ data: { sessionId: supplied.id } })) as {
      status?: string;
    };
    if (r?.status === "scheduled") {
      void import("sonner")
        .then(({ toast }) =>
          toast.info("Scoring the recommended proposition", {
            description:
              "This proposition was finalised after Stage 10, so it is being scored in the background. The document opens now; its score appears once scoring completes — reopen the document to see it.",
            duration: 9000,
          }),
        )
        .catch(() => {});
    }
  } catch {
    /* never block document rendering on the re-score */
  }


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
      .select("id,session_id,winning_direction_id,winning_line_direction_id,winning_line,locked_at")
      .eq("id", runId)
      .eq("session_id", supplied.id)
      .eq("run_mode", "big_idea")
      .maybeSingle();
    run = result.data;
  }
  if (!run) {
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

  const storedIdea = (current.locked_big_idea as string | null) ?? supplied.locked_big_idea ?? null;
  const storedLine =
    (current.locked_campaign_line as string | null) ?? supplied.locked_campaign_line ?? null;
  const storedLens =
    (current.locked_big_idea_lens as string | null) ?? supplied.locked_big_idea_lens ?? null;
  const storedAt = (current.locked_big_idea_at as string | null) ?? supplied.locked_big_idea_at ?? null;

  if (!run) {
    if (storedIdea || storedLine) {
      warnFallback("the winning creative run could not be found");
      return {
        ...merged,
        locked_big_idea_run_id: (current.locked_big_idea_run_id as string | null) ?? null,
        locked_big_idea: storedIdea,
        locked_campaign_line: storedLine,
        locked_big_idea_lens: storedLens,
        locked_big_idea_at: storedAt,
        locked_source_fallback: "run-lookup-failed",
      };
    }
    return {
      ...merged,
      locked_big_idea_run_id: null,
      locked_big_idea: null,
      locked_campaign_line: null,
      locked_big_idea_lens: null,
      locked_big_idea_at: null,
    };
  }
  const ids = [run.winning_direction_id, run.winning_line_direction_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: directions } = ids.length
    ? await supabase
        .from("stimulus_directions")
         .select("id,run_id,lens_name,direction,campaign_line")
         .eq("run_id", run.id)
        .in("id", ids)
    : { data: [] };
  const idea = directions?.find((row) => row.id === run?.winning_direction_id);
  const line = directions?.find((row) => row.id === run?.winning_line_direction_id);

  const resolvedIdea = idea?.direction ?? null;
  const resolvedLine = line?.campaign_line ?? run.winning_line ?? null;

  const ideaFallback = !resolvedIdea && Boolean(storedIdea);
  const lineFallback = !resolvedLine && Boolean(storedLine);
  if (ideaFallback || lineFallback) {
    warnFallback("the locked creative direction row could not be read");
  }

  return {
    ...merged,
    locked_big_idea_run_id: runId,
    locked_big_idea: resolvedIdea ?? storedIdea,
    locked_big_idea_lens: idea?.lens_name ?? (ideaFallback ? storedLens : null),
    locked_campaign_line: resolvedLine ?? storedLine,
    locked_big_idea_at: run.locked_at ?? (ideaFallback || lineFallback ? storedAt : null),
    ...(ideaFallback || lineFallback
      ? { locked_source_fallback: "direction-lookup-failed" }
      : {}),
  };
}
