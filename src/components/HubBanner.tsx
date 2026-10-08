import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  captureHubContextFromUrl,
  clearHubContext,
  onHubContextChange,
  readHubContext,
  type HubContext,
} from "@/lib/hub/context";
import { findPriorHubWork, stampHubContext } from "@/lib/hub.functions";

// Capture at first load, before any sign-in redirect rewrites the address.
if (typeof window !== "undefined") captureHubContextFromUrl();

type Table = "sessions" | "intelligence_sessions" | "briefing_room_workspaces" | "synthesiser_runs";
type RoomMatch = { table: Table; id: string | null; openPath: (id: string) => string };

function matchRoom(pathname: string, search: string): RoomMatch | null {
  const sessionQ = new URLSearchParams(search).get("session");
  const seg = pathname.split("/").filter(Boolean);
  const uuid = (s?: string) => (s && /^[0-9a-f-]{36}$/i.test(s) ? s : null);
  switch (seg[0]) {
    case "synthesiser":
      return { table: "synthesiser_runs", id: null, openPath: () => "/intelligence" };
    case "intelligence":
      return { table: "intelligence_sessions", id: uuid(seg[1]), openPath: (id) => `/intelligence/${id}` };
    case "briefing-room":
      return { table: "briefing_room_workspaces", id: uuid(seg[1]), openPath: (id) => `/briefing-room/${id}` };
    case "brief":
    case "pipeline":
    case "complete":
    case "detonation":
      return { table: "sessions", id: uuid(sessionQ ?? undefined), openPath: (id) => `/pipeline?session=${id}` };
    case "walkthrough":
    case "creative":
      return { table: "sessions", id: uuid(seg[1]), openPath: (id) => `/pipeline?session=${id}` };
    default:
      return null;
  }
}

export function HubBanner() {
  const loc = useRouterState({ select: (s) => s.location });
  const [hub, setHub] = useState<HubContext | null>(null);
  const [prior, setPrior] = useState<{ id: string; created_at: string } | null>(null);
  const stamp = useServerFn(stampHubContext);
  const findPrior = useServerFn(findPriorHubWork);
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  const room = matchRoom(loc.pathname, searchStr);

  useEffect(() => {
    captureHubContextFromUrl();
    setHub(readHubContext());
    return onHubContextChange(() => setHub(readHubContext()));
  }, [loc.href]);

  useEffect(() => {
    setPrior(null);
    if (!hub || !room) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      try {
        if (room.id) await stamp({ data: { table: room.table, id: room.id, hub } });
        const p = await findPrior({ data: { table: room.table, client: hub.client, job: hub.job, excludeId: room.id } });
        if (!cancelled) setPrior(p);
      } catch {
        /* never block the Room */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub?.client, hub?.job, room?.table, room?.id]);

  if (!room) return null;

  if (!hub) {
    return (
      <div className="border-b border-border bg-background px-5 py-1 text-[11px] text-muted-foreground">
        Not linked to a hub client, nothing sent
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-muted px-5 py-1.5 text-[12px] text-foreground">
      <span>
        Working for <strong>{hub.client}</strong>
        {hub.job ? (
          <>
            {" "}on <strong>{hub.job}</strong>
          </>
        ) : null}
      </span>
      {prior ? (
        <span className="text-muted-foreground">
          Already produced on {new Date(prior.created_at).toLocaleDateString()} ·{" "}
          <Link to={room.openPath(prior.id) as never} className="underline">
            Open
          </Link>
        </span>
      ) : null}
      <button type="button" onClick={clearHubContext} className="ml-auto text-muted-foreground underline hover:text-foreground">
        Not this client
      </button>
    </div>
  );
}
