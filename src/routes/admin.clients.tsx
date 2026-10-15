import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBgClient,
  createBgEngagement,
  createBgMapping,
  getLinkingOverview,
  linkRun,
} from "@/lib/bg-clients.functions";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({
    meta: [
      { title: "Clients and run linking — Brand Grenade" },
      { name: "description", content: "Admin: clients, engagements, Hub mappings and run linking." },
      { property: "og:title", content: "Clients and run linking — Brand Grenade" },
      { property: "og:description", content: "Admin: clients, engagements, Hub mappings and run linking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: ClientsAdmin,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-body-sm text-text-primary";

function ClientsAdmin() {
  const overview = useServerFn(getLinkingOverview);
  const addClient = useServerFn(createBgClient);
  const addEng = useServerFn(createBgEngagement);
  const addMap = useServerFn(createBgMapping);
  const link = useServerFn(linkRun);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bg-linking"], queryFn: () => overview(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["bg-linking"] });

  const [clientName, setClientName] = useState("");
  const [engClient, setEngClient] = useState("");
  const [engName, setEngName] = useState("");
  const [mapClient, setMapClient] = useState("");
  const [mapSystem, setMapSystem] = useState<"hub_client" | "hub_job">("hub_client");
  const [mapEng, setMapEng] = useState("");
  const [mapId, setMapId] = useState("");
  const [choice, setChoice] = useState<Record<string, { client: string; eng: string }>>({});

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const d = q.data;
  const clientName_ = useMemo(() => new Map((d?.clients ?? []).map((c: any) => [c.id, c.name])), [d]);
  const engName_ = useMemo(() => new Map((d?.engagements ?? []).map((e: any) => [e.id, e.name])), [d]);
  const engFor = (clientId: string) => (d?.engagements ?? []).filter((e: any) => e.bg_client_id === clientId);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1180px] px-6 py-10">
        <h1 className="text-h2 text-text-primary">Clients and run linking</h1>
        {q.isError ? (
          <p className="mt-4 text-text-secondary">This page is available to platform admins only.</p>
        ) : !d ? (
          <p className="mt-4 text-text-secondary">Loading…</p>
        ) : (
          <>
            <Card className="mt-6 overflow-x-auto p-6">
              <h2 className="text-h3 text-text-primary">Runs per Room</h2>
              <table className="mt-3 w-full text-body-sm text-text-primary">
                <thead className="text-text-secondary">
                  <tr><th className="py-1 text-left">Room</th><th className="text-right">Linked</th><th className="text-right">Unlinked</th><th className="text-right">Legacy</th></tr>
                </thead>
                <tbody>
                  {Object.entries(d.counts).map(([room, c]) => (
                    <tr key={room} className="border-t border-border">
                      <td className="py-1">{room}</td><td className="text-right">{c.linked}</td><td className="text-right">{c.unlinked}</td><td className="text-right">{c.legacy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <h2 className="text-h3 text-text-primary">New client</h2>
                <Input className="mt-3" placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                <Button className="mt-3" disabled={!clientName.trim()} onClick={() => run(async () => { await addClient({ data: { name: clientName } }); setClientName(""); }, "Client added")}>Add client</Button>
              </Card>
              <Card className="p-6">
                <h2 className="text-h3 text-text-primary">New engagement</h2>
                <select className={`${selectCls} mt-3 w-full`} value={engClient} onChange={(e) => setEngClient(e.target.value)}>
                  <option value="">Client…</option>
                  {d.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input className="mt-3" placeholder="Engagement name" value={engName} onChange={(e) => setEngName(e.target.value)} />
                <Button className="mt-3" disabled={!engClient || !engName.trim()} onClick={() => run(async () => { await addEng({ data: { clientId: engClient, name: engName } }); setEngName(""); }, "Engagement added")}>Add engagement</Button>
              </Card>
              <Card className="p-6">
                <h2 className="text-h3 text-text-primary">Map a Hub id</h2>
                <select className={`${selectCls} mt-3 w-full`} value={mapClient} onChange={(e) => { setMapClient(e.target.value); setMapEng(""); }}>
                  <option value="">Client…</option>
                  {d.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={`${selectCls} mt-3 w-full`} value={mapSystem} onChange={(e) => setMapSystem(e.target.value as "hub_client" | "hub_job")}>
                  <option value="hub_client">Hub client id</option>
                  <option value="hub_job">Hub job id (to an engagement)</option>
                </select>
                {mapSystem === "hub_job" ? (
                  <select className={`${selectCls} mt-3 w-full`} value={mapEng} onChange={(e) => setMapEng(e.target.value)}>
                    <option value="">Engagement…</option>
                    {engFor(mapClient).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                ) : null}
                <Input className="mt-3" placeholder="Exact Hub id" value={mapId} onChange={(e) => setMapId(e.target.value)} />
                <Button
                  className="mt-3"
                  disabled={!mapClient || !mapId.trim() || (mapSystem === "hub_job" && !mapEng)}
                  onClick={() => run(async () => { await addMap({ data: { clientId: mapClient, engagementId: mapEng || null, system: mapSystem, externalId: mapId } }); setMapId(""); }, "Mapping added")}
                >Add mapping</Button>
              </Card>
            </div>

            <Card className="mt-6 overflow-x-auto p-6">
              <h2 className="text-h3 text-text-primary">Clients, engagements and Hub ids</h2>
              {d.clients.length === 0 ? <p className="mt-3 text-text-secondary">No clients yet.</p> : (
                <table className="mt-3 w-full text-body-sm text-text-primary">
                  <thead className="text-text-secondary"><tr><th className="py-1 text-left">Client</th><th className="text-left">Engagements</th><th className="text-left">Hub ids</th></tr></thead>
                  <tbody>
                    {d.clients.map((c: any) => (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="py-2">{c.name}</td>
                        <td>{engFor(c.id).map((e: any) => e.name).join(", ") || "—"}</td>
                        <td>
                          {d.mappings.filter((m: any) => m.bg_client_id === c.id).map((m: any) => (
                            <div key={m.id}>{m.system === "hub_client" ? "Client" : `Job → ${engName_.get(m.engagement_id) ?? "?"}`}: {m.external_id}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="mt-6 overflow-x-auto p-6">
              <h2 className="text-h3 text-text-primary">Unlinked and legacy runs</h2>
              <p className="mt-1 text-body-sm text-text-secondary">Link one run at a time. Each link records who made it and when.</p>
              <table className="mt-3 w-full text-body-sm text-text-primary">
                <thead className="text-text-secondary">
                  <tr><th className="py-1 text-left">Brand</th><th className="text-left">Room</th><th className="text-left">Date</th><th className="text-left">Status</th><th className="text-left">Link</th><th className="text-left">Client / engagement</th><th /></tr>
                </thead>
                <tbody>
                  {d.runs.map((r) => {
                    const key = `${r.table}:${r.id}`;
                    const ch = choice[key] ?? { client: "", eng: "" };
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="py-2">{r.brand || "—"}</td>
                        <td>{r.room}</td>
                        <td>{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                        <td>{r.status ?? "—"}</td>
                        <td>{r.link_status}</td>
                        <td className="flex gap-2 py-2">
                          <select className={selectCls} value={ch.client} onChange={(e) => setChoice({ ...choice, [key]: { client: e.target.value, eng: "" } })}>
                            <option value="">Client…</option>
                            {d.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <select className={selectCls} value={ch.eng} onChange={(e) => setChoice({ ...choice, [key]: { ...ch, eng: e.target.value } })}>
                            <option value="">Engagement…</option>
                            {engFor(ch.client).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!ch.client || !ch.eng}
                            onClick={() => run(() => link({ data: { table: r.table, runId: r.id, clientId: ch.client, engagementId: ch.eng } }), `Linked to ${clientName_.get(ch.client)}`)}
                          >Link</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
