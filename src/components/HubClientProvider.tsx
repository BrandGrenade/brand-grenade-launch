import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/context/AuthContext";
import { lookupHubClient } from "@/lib/hub.functions";
import { captureHubContextFromUrl, onHubContextChange, readHubContext, HUB_SYNC_MESSAGE, type HubContext } from "@/lib/hub/context";
import { Button } from "@/components/ui/button";

const HubClient = createContext<{ hub: HubContext | null; name: string | null; pending: boolean; retry: () => void }>({ hub: null, name: null, pending: false, retry: () => {} });
export const useHubClient = () => useContext(HubClient);

export function HubClientProvider({ children }: { children: ReactNode }) {
  const loc = useRouterState({ select: (s) => s.location });
  const { user, isAuthReady } = useAuth();
  const lookup = useServerFn(lookupHubClient);
  const [hub, setHub] = useState<HubContext | null>(null);
  const [resolved, setResolved] = useState<{ client: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((v) => v + 1), []);
  useEffect(() => {
    const read = () => setHub(readHubContext());
    captureHubContextFromUrl(); read();
    return onHubContextChange(read);
  }, [loc.href]);
  useEffect(() => {
    setResolved(null);
    if (!hub || !isAuthReady || !user) { setPending(false); return; }
    let cancelled = false;
    setPending(true);
    void lookup({ data: { client: hub.client } }).then((client) => {
      if (!cancelled) setResolved(client ? { client: hub.client, name: client.name } : null);
    }).catch(() => {}).finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
  }, [hub?.client, user?.id, isAuthReady, attempt, lookup]);
  const name = resolved?.client === hub?.client ? resolved?.name ?? null : null;
  return <HubClient.Provider value={{ hub, name, pending, retry }}>{children}</HubClient.Provider>;
}

/** No unknown client can reach a Room's start action; Retry only repeats lookup. */
export function HubArrivalGate({ children }: { children: ReactNode }) {
  const { hub, name, pending, retry } = useHubClient();
  const { user, isAuthReady } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const room = /^\/(synthesiser|intelligence|briefing-room|brief|pipeline|creative|complete|detonation|walkthrough)(\/|$)/.test(pathname);
  if (!room || !hub || !isAuthReady || !user || name) return children;
  return <main className="mx-auto max-w-xl px-6 py-20">
    <p className="text-body text-foreground">{pending ? "Syncing client…" : HUB_SYNC_MESSAGE}</p>
    <Button className="mt-4" variant="outline" onClick={retry} disabled={pending}>Retry</Button>
  </main>;
}