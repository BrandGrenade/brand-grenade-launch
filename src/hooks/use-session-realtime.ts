import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SessionRow = Record<string, unknown> & { id: string };

/**
 * Subscribes to realtime updates for a single session row. Returns the
 * latest snapshot. Initial fetch is performed once on mount.
 */
export function useSessionRealtime(sessionId: string | undefined) {
  const [session, setSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (active && data) setSession(data as SessionRow);
    })();

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (!active) return;
          setSession(payload.new as SessionRow);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return session;
}
