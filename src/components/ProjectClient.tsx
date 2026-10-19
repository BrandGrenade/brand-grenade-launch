import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsAdmin } from "@/lib/demo-mode";
import { attachProjectClient, getClientOptions, getProjectClient, type ClientOption } from "@/lib/bg-clients.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Table = "sessions" | "intelligence_sessions" | "briefing_room_workspaces" | "synthesiser_runs" | "saved_briefs" | "stimulus_runs";

/** Admin-only, once-only attachment for the exact project ID, never its name. */
export function ProjectClient({ table, id }: { table: Table; id: string }) {
  const admin = useIsAdmin();
  const options = useServerFn(getClientOptions);
  const attach = useServerFn(attachProjectClient);
  const getProject = useServerFn(getProjectClient);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    void Promise.all([
      options(),
      getProject({ data: { table, runId: id } }),
    ]).then(([rows, result]) => {
      if (cancelled) return;
      setClients([...new Map(rows.map((r) => [r.client_id, r])).values()]);
      setClientId(result.clientId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [admin, table, id, options, getProject]);
  if (!admin || clientId === undefined || !clients.length) return null;
  if (clientId) return <span className="text-body-sm text-muted-foreground">{clients.find((c) => c.client_id === clientId)?.client_name ?? "Client assigned"}</span>;
  return <Select disabled={busy} onValueChange={async (value) => {
    setBusy(true);
    try { await attach({ data: { table, runId: id, clientId: value } }); setClientId(value); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Client could not be attached"); }
    finally { setBusy(false); }
  }}>
    <SelectTrigger className="w-40" aria-label="Client"><SelectValue placeholder="Client" /></SelectTrigger>
    <SelectContent>{clients.map((c) => <SelectItem key={c.client_id} value={c.client_id}>{c.client_name}</SelectItem>)}</SelectContent>
  </Select>;
}