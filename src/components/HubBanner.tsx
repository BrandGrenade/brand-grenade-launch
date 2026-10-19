import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findPriorHubWork } from "@/lib/hub.functions";
import { clearHubContext } from "@/lib/hub/context";
import { useHubClient } from "./HubClientProvider";
import { Button } from "@/components/ui/button";

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
  const { hub, name } = useHubClient();
  const findPrior = useServerFn(findPriorHubWork);
  const [prior, setPrior] = useState<{ id: string; created_at: string } | null>(null);
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  const room = matchRoom(loc.pathname, searchStr);

  useEffect(() => {
    setPrior(null);
    if (!hub || !name || !room) return;
    let cancelled = false;
    void findPrior({ data: { table: room.table, client: hub.client, job: hub.job, excludeId: room.id } })
      .then((row) => { if (!cancelled) setPrior(row); }).catch(() => {});
    return () => { cancelled = true; };
  }, [hub?.client, hub?.job, name, room?.table, room?.id, findPrior]);

  if (!room || !hub || !name) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted px-5 py-1.5 text-[12px] text-foreground">
      <span>
        <strong>Client: {name}</strong>
      </span>
      {prior ? <a className="text-muted-foreground underline" href={room.openPath(prior.id)}>Open previous work</a> : null}
      <Button type="button" variant="ghost" size="sm" onClick={clearHubContext} className="ml-auto">
        Not this client
      </Button>
    </div>
  );
}
