import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { getClientHoldings, removeClient } from "@/lib/bg-clients.functions";

/** Admin-only: archive or delete a whole client after typing its name. */
export function ClientRemoval({ clientId, clientName, onDone }: { clientId: string; clientName: string; onDone: () => void }) {
  const holdings = useServerFn(getClientHoldings);
  const remove = useServerFn(removeClient);
  const [mode, setMode] = useState<"archive" | "delete" | null>(null);
  const [info, setInfo] = useState<{ jobs: number; runs: number; archivedRuns: number } | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (m: "archive" | "delete") => {
    try {
      setInfo(await holdings({ data: { clientId } }));
      setTyped("");
      setMode(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  const confirm = async () => {
    if (!mode) return;
    setBusy(true);
    try {
      await remove({ data: { clientId, confirmName: typed, mode } });
      toast.success(mode === "archive" ? `${clientName} archived` : `${clientName} deleted`);
      setMode(null);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => start("archive")}>Archive client</Button>
      <Button size="sm" variant="outline" onClick={() => start("delete")}>Delete client</Button>
      <AlertDialog open={mode !== null} onOpenChange={(o) => !busy && !o && setMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === "archive" ? "Archive" : "Delete"} client “{clientName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {clientName} holds {info?.jobs ?? 0} job{info?.jobs === 1 ? "" : "s"} and {info?.runs ?? 0} run{info?.runs === 1 ? "" : "s"}
              {info?.archivedRuns ? ` (${info.archivedRuns} already archived)` : ""}.{" "}
              {mode === "archive"
                ? "Archiving hides the client and every run it holds from normal lists. Nothing is deleted; runs can be restored one at a time."
                : (info?.runs ?? 0) > 0
                  ? "A client that holds runs cannot be deleted. Archive it instead."
                  : "Deleting removes the client, its jobs and its Hub IDs. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-body-sm text-text-secondary">Type <strong>{clientName}</strong> to confirm.</p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the client name to confirm" />
          <AlertDialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
            <Button
              disabled={busy || typed !== clientName || (mode === "delete" && (info?.runs ?? 0) > 0)}
              onClick={confirm}
            >{busy ? "Working…" : mode === "archive" ? "Archive client" : "Delete client"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
