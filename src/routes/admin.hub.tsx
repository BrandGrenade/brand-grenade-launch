import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHubAdminStatus, retryFailedHub, sendHubConnectionTest } from "@/lib/hub.functions";

export const Route = createFileRoute("/admin/hub")({
  head: () => ({
    meta: [
      { title: "Hub connection — Brand Grenade" },
      { name: "description", content: "Partner Hub delivery status and connection test." },
      { property: "og:title", content: "Hub connection — Brand Grenade" },
      { property: "og:description", content: "Partner Hub delivery status and connection test." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: HubAdmin,
});

function HubAdmin() {
  const status = useServerFn(getHubAdminStatus);
  const retry = useServerFn(retryFailedHub);
  const test = useServerFn(sendHubConnectionTest);
  const q = useQuery({ queryKey: ["hub-admin"], queryFn: () => status(), retry: false });
  const [clientRef, setClientRef] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1080px] px-6 py-10">
        <h1 className="text-h2 text-text-primary">Hub connection</h1>
        {q.isError ? (
          <p className="mt-4 text-text-secondary">This page is available to platform admins only.</p>
        ) : !q.data ? (
          <p className="mt-4 text-text-secondary">Loading…</p>
        ) : (
          <>
            <Card className="mt-6 grid gap-4 p-6 md:grid-cols-5">
              <Stat label="Hub address" value={q.data.urlSet ? "Set" : "Not set"} />
              <Stat label="Hub key" value={q.data.keySet ? "Set" : "Not set"} />
              <Stat label="Sent" value={String(q.data.sent)} />
              <Stat label="Pending" value={String(q.data.pending)} />
              <Stat label="Failed" value={String(q.data.failed)} />
            </Card>

            <Card className="mt-6 flex flex-wrap items-end gap-3 p-6">
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await retry();
                  setReply(`Requeued ${r.requeued} item(s).`);
                  await q.refetch();
                  setBusy(false);
                }}
              >
                Retry failed
              </Button>
              <div className="ml-auto flex items-end gap-2">
                <Input placeholder="Hub client id" value={clientRef} onChange={(e) => setClientRef(e.target.value)} className="w-56" />
                <Button
                  disabled={busy || !clientRef.trim()}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await test({ data: { clientRef: clientRef.trim() } });
                      setReply(`Hub replied ${r.status || "no response"}: ${r.body}`);
                    } catch (e) {
                      setReply(e instanceof Error ? e.message : "Test failed");
                    }
                    setBusy(false);
                  }}
                >
                  Send connection test
                </Button>
              </div>
              {reply ? <pre className="w-full whitespace-pre-wrap text-[12px] text-text-secondary">{reply}</pre> : null}
            </Card>

            <Card className="mt-6 overflow-x-auto p-0">
              <table className="w-full text-[12px]">
                <thead className="text-left text-text-secondary">
                  <tr>
                    {["Created", "Client / job", "Room", "Event", "Title", "Status", "Tries", "Error"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.map((r: any) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.hub_client}{r.hub_job ? ` / ${r.hub_job}` : ""}</td>
                      <td className="px-3 py-2">{r.payload?.room}</td>
                      <td className="px-3 py-2">{r.payload?.event_type}</td>
                      <td className="px-3 py-2">{r.payload?.title}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.attempts}</td>
                      <td className="px-3 py-2 max-w-[260px] break-words text-text-secondary">{r.last_error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-label text-text-secondary">{label}</div>
      <div className="mt-1 text-h4 text-text-primary">{value}</div>
    </div>
  );
}
