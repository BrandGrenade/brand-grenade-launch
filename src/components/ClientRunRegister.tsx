import { useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatAbsolute } from "@/lib/brand-register";
import type { ClientGroup, JobGroup, RegisterRun } from "@/lib/run-register";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ProjectClient } from "@/components/ProjectClient";

const linkCls = "text-[13px] font-medium text-text-secondary underline hover:text-text-primary";

/** Run-level actions apply to that one run only. There is no delete here. */
export function RunRowActions({ run, onArchived }: { run: RegisterRun; onArchived: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const archive = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("bg_set_run_archived", { _table: run.table, _run_id: run.id, _archived: true });
    setBusy(false);
    setConfirm(false);
    if (error) return toast.error(error.message);
    toast.success("Run archived. An admin can restore it.");
    onArchived();
  };
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <a href={run.openHref} className={linkCls}>Open</a>
      {run.documentsHref ? (
        <a href={run.documentsHref} className={`${linkCls} inline-flex items-center gap-1`}>
          <Download size={12} /> Download this run's documents
        </a>
      ) : (
        <span className="text-[12px] text-text-tertiary">No documents yet</span>
      )}
      <button type="button" className={linkCls} onClick={() => setConfirm(true)}>Archive run</button>
      <AlertDialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this run?</AlertDialogTitle>
            <AlertDialogDescription>
              Only this {run.room} run ({run.brand || "untitled"}, {formatAbsolute(run.date)}) is hidden from your lists. It is kept for audit,
              anything shared with the Hub stays valid, and an admin can restore it. Nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button>
            <Button disabled={busy} onClick={archive}>{busy ? "Archiving…" : "Archive run"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentsDialog({ scope, title, runs, open, onClose }: { scope: string; title: string; runs: RegisterRun[]; open: boolean; onClose: () => void }) {
  const withDocs = runs.filter((r) => r.documentsHref);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Download all documents ({scope}) — {title}</AlertDialogTitle>
          <AlertDialogDescription>
            {withDocs.length === 0 ? "No run here has documents yet." : `${withDocs.length} run${withDocs.length === 1 ? "" : "s"} with documents. Each opens that run's downloads.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {withDocs.map((r) => (
            <li key={`${r.table}:${r.id}`} className="flex items-center justify-between gap-3 text-[13px] text-text-primary">
              <span>{r.room} · {r.brand || "—"} · {new Date(r.date).toLocaleDateString("en-GB")}</span>
              <a href={r.documentsHref!} target="_blank" rel="noreferrer" className={linkCls}>Download</a>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GroupHeaderActions({ scope, title, runs, onViewAll, expanded }: { scope: "client-wide" | "job-wide"; title: string; runs: RegisterRun[]; onViewAll: () => void; expanded: boolean }) {
  const [docs, setDocs] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={linkCls} onClick={onViewAll}>
        {expanded ? "Hide runs" : `View all runs (${scope})`}
      </button>
      <button type="button" className={linkCls} onClick={() => setDocs(true)}>Download all documents ({scope})</button>
      <DocumentsDialog scope={scope} title={title} runs={runs} open={docs} onClose={() => setDocs(false)} />
    </div>
  );
}

function RunTable({ job, onChanged }: { job: JobGroup; onChanged: () => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] text-text-primary">
        <thead className="text-left text-label text-text-tertiary">
          <tr>
            <th className="px-2 py-2">Job</th><th className="px-2">Room</th><th className="px-2">Brand</th><th className="px-2">Brief type</th>
            <th className="px-2">Run type</th><th className="px-2">Date</th><th className="px-2">Status</th><th className="px-2" />
          </tr>
        </thead>
        <tbody>
          {job.runs.map((r) => (
            <tr key={`${r.table}:${r.id}`} className="border-t border-border" data-testid="run-row">
              <td className="px-2 py-2">{job.name}</td>
              <td className="px-2">{r.room}</td>
              <td className="px-2">{r.brand || "—"}</td>
              <td className="px-2">{r.briefType ?? "—"}</td>
              <td className="px-2">{r.runType ?? "—"}</td>
              <td className="px-2" title={formatAbsolute(r.date)}>{new Date(r.date).toLocaleDateString("en-GB")}</td>
              <td className="px-2">{r.status}</td>
              <td className="px-2"><div className="flex items-center gap-3">{!r.clientId && <ProjectClient table={r.table} id={r.id} unlinked onAttached={onChanged} />}<RunRowActions run={r} onArchived={onChanged} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobSection({ job, clientName, onChanged }: { job: JobGroup; clientName: string; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-text-primary">
          {job.engagementId === null && job.key.startsWith("brand:") ? "Brand" : "Job"}: {job.name} <span className="font-normal text-text-tertiary">· {job.runs.length} run{job.runs.length === 1 ? "" : "s"}</span>
        </div>
        <GroupHeaderActions scope="job-wide" title={`${clientName} · ${job.name}`} runs={job.runs} expanded={open} onViewAll={() => setOpen((v) => !v)} />
      </div>
      {open && <div className="mt-2"><RunTable job={job} onChanged={onChanged} /></div>}
    </div>
  );
}

export function ClientRunRegister({ groups, onChanged }: { groups: ClientGroup[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (key: string) => expanded[key] ?? (key === "__none__" || key === groups[0]?.key);
  const toggle = (key: string) => setExpanded((previous) => ({ ...previous, [key]: !isExpanded(key) }));
  return (
    <div className="space-y-3">
      {groups.map((c) => {
        const isOpen = isExpanded(c.key);
        const all = c.jobs.flatMap((j) => j.runs);
        return (
          <section key={c.key} className="rounded-lg border border-border bg-card-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-2 text-left text-text-primary">
                <ChevronRight size={14} className="text-text-tertiary transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : undefined }} />
                <span className="text-body font-semibold">Client: {c.name}</span>
                <span className="text-[12px] text-text-tertiary">
                  {c.jobs.filter((j) => j.engagementId).length} job{c.jobs.filter((j) => j.engagementId).length === 1 ? "" : "s"} · {c.runCount} run{c.runCount === 1 ? "" : "s"}
                </span>
              </button>
              <GroupHeaderActions scope="client-wide" title={c.name} runs={all} expanded={isOpen} onViewAll={() => toggle(c.key)} />
            </div>
            {isOpen && c.jobs.map((j) => <JobSection key={j.key} job={j} clientName={c.name} onChanged={onChanged} />)}
          </section>
        );
      })}
    </div>
  );
}
