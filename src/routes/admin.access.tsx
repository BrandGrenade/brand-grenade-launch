import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAccessKey, listAccessKeys, revokeAccessKey } from "@/lib/access/access-admin.functions";

export const Route = createFileRoute("/admin/access")({
  head: () => ({
    meta: [
      { title: "Access keys — Brand Grenade" },
      { name: "description", content: "Admin: read-only access point keys and request log." },
      { property: "og:title", content: "Access keys — Brand Grenade" },
      { property: "og:description", content: "Admin: read-only access point keys and request log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AccessAdmin,
});

type Scope = "hub_tools" | "second_brain" | "admin";
const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-body-sm text-text-primary";

function AccessAdmin() {
  const list = useServerFn(listAccessKeys);
  const create = useServerFn(createAccessKey);
  const revoke = useServerFn(revokeAccessKey);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bg-access"], queryFn: () => list(), retry: false });
  const [scope, setScope] = useState<Scope>("hub_tools");
  const [label, setLabel] = useState("");
  const [shown, setShown] = useState<string | null>(null);

  const onCreate = async () => {
    try {
      const r = await create({ data: { scope, label } });
      setShown(r.key);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["bg-access"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create key");
    }
  };
  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this key? It stops working immediately and cannot be restored.")) return;
    try {
      await revoke({ data: { id } });
      qc.invalidateQueries({ queryKey: ["bg-access"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke key");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <h1 className="text-h2 text-text-primary">Access keys</h1>
        {q.isError && <p className="text-body-sm text-destructive">Admins only.</p>}
        <Card className="space-y-3 p-5">
          <h2 className="text-h4 text-text-primary">Create a key</h2>
          <div className="flex flex-wrap gap-2">
            <select className={selectCls} value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Scope">
              <option value="hub_tools">Hub tools</option>
              <option value="second_brain">Second Brain</option>
              <option value="admin">Admin (lists and manifests only)</option>
            </select>
            <Input className="max-w-xs" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button onClick={onCreate} disabled={!label.trim()}>Create</Button>
          </div>
          {shown && (
            <div className="space-y-2 rounded-md border border-border bg-muted p-3">
              <p className="text-body-sm text-text-primary">Copy this key now. It will not be shown again.</p>
              <code className="block break-all text-body-sm text-text-primary">{shown}</code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(shown)}>Copy</Button>
                <Button size="sm" variant="ghost" onClick={() => setShown(null)}>Done</Button>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-h4 text-text-primary">Keys</h2>
          <table className="w-full text-body-sm">
            <thead><tr className="text-left text-text-secondary"><th>Label</th><th>Scope</th><th>Created</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(q.data?.keys ?? []).map((k: any) => (
                <tr key={k.id} className="border-t border-border text-text-primary">
                  <td className="py-2">{k.label}</td>
                  <td>{k.scope}</td>
                  <td>{new Date(k.created_at).toLocaleString()}</td>
                  <td>{k.revoked_at ? `Revoked ${new Date(k.revoked_at).toLocaleDateString()}` : "Active"}</td>
                  <td className="text-right">{!k.revoked_at && <Button size="sm" variant="outline" onClick={() => onRevoke(k.id)}>Revoke</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-h4 text-text-primary">Request log</h2>
          <table className="w-full text-body-sm">
            <thead><tr className="text-left text-text-secondary"><th>Time</th><th>Scope</th><th>Request</th><th>Client</th><th>Output</th><th>Outcome</th></tr></thead>
            <tbody>
              {(q.data?.log ?? []).map((l: any) => (
                <tr key={l.request_id} className="border-t border-border text-text-primary">
                  <td className="py-2">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.scope ?? "—"}</td>
                  <td>{l.request ?? "—"}</td>
                  <td>{l.client_ref ?? "—"}</td>
                  <td>{l.output_id ?? "—"}</td>
                  <td>{l.error_code ?? l.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
